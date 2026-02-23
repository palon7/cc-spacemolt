import path from 'path';
import fsp from 'fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { SessionManager } from './state/session-manager.js';
import type {
  ClientMessage,
  ServerMessage,
  ParsedEntry,
  SessionMeta,
  AgentStatus,
  TravelHistoryEntry,
} from './state/types.js';
import type { GameConnectionManager } from './game/game-connection-manager.js';
import { debug } from './logger/debug-logger.js';

/**
 * Sync game WS connection based on agent status.
 * Connect only when agent is actively running; pause otherwise.
 */
export function syncGameConnection(
  status: AgentStatus,
  gameConnectionManager: GameConnectionManager,
): void {
  if (status === 'starting' || status === 'running') {
    gameConnectionManager.resume();
  } else {
    gameConnectionManager.pause();
  }
}

export interface WsHandlerOptions {
  server: Server;
  sessionManager: SessionManager;
  gameConnectionManager: GameConnectionManager;
  initialPrompt: string;
  logDir: string;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export function setupWebSocket({
  server,
  sessionManager,
  gameConnectionManager,
  initialPrompt,
  logDir,
}: WsHandlerOptions): void {
  const wss = new WebSocketServer({ server: server as never });

  // Set callbacks once — all callbacks broadcast to wss.clients, so
  // they remain correct regardless of which clients are connected.
  sessionManager.setCallbacks({
    onEntry: (entry: ParsedEntry) => broadcast(wss, { type: 'entry', entry }),
    onMeta: (m: SessionMeta) => broadcast(wss, { type: 'meta', meta: m }),
    onStatus: (status: AgentStatus) => {
      broadcast(wss, { type: 'status', status });
      syncGameConnection(status, gameConnectionManager);
    },
    onClearStreaming: () => broadcast(wss, { type: 'clear_streaming' }),
    onError: (message: string) => broadcast(wss, { type: 'error', message }),
    onSessionStarted: (sessionId: string) => {
      gameConnectionManager.setSessionDir(path.join(logDir, sessionId), sessionId);
    },
  });

  const alive = new WeakMap<WebSocket, boolean>();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        debug('ws', 'Heartbeat timeout — terminating dead client');
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));

    debug('ws', 'Client connected');

    // Send config (initialPrompt for UI placeholder)
    send(ws, { type: 'config', initialPrompt });

    // Send current state to newly connected client
    const meta = sessionManager.currentMeta;
    if (meta) {
      send(ws, { type: 'meta', meta });
    }
    send(ws, { type: 'status', status: sessionManager.status });

    // Send existing entries for reconnection
    for (const entry of sessionManager.currentEntries) {
      send(ws, { type: 'entry', entry });
    }

    // Send game connection status
    const gs = gameConnectionManager.gameStatus;
    send(ws, { type: 'game_status', status: gs.status, message: gs.message });

    // Send cached game state and events
    const gameState = gameConnectionManager.currentState;
    if (gameState) {
      send(ws, { type: 'state_update', state: gameState });
    }
    const events = gameConnectionManager.currentEvents;
    if (events.length > 0) {
      send(ws, { type: 'game_events', events });
    }
    const travelHistory = gameConnectionManager.currentTravelHistory;
    send(ws, { type: 'travel_history', history: travelHistory });

    ws.on('message', (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        debug('ws', 'Invalid message:', data.toString().slice(0, 200));
        return;
      }

      debug('ws', `Received: ${msg.type}`);

      switch (msg.type) {
        case 'start':
          sessionManager.start(msg.instructions).catch((err) => {
            debug('ws', `Session start error: ${err}`);
          });
          break;
        case 'send_message':
          if (sessionManager.status === 'interrupted' || sessionManager.status === 'done') {
            sessionManager.resume(msg.text).catch((err) => {
              debug('ws', `Session resume error: ${err}`);
            });
          } else {
            sessionManager.sendMessage(msg.text);
          }
          break;
        case 'resume':
          // Resume requires a message to unblock the CLI stdin
          sessionManager.resume(msg.message || 'Continue.').catch((err) => {
            debug('ws', `Session resume error: ${err}`);
          });
          break;
        case 'interrupt':
          sessionManager.interrupt();
          break;
        case 'abort':
          sessionManager.abort();
          break;
        case 'reset':
          sessionManager.reset();
          gameConnectionManager.clearSessionDir();
          broadcast(wss, { type: 'reset' });
          break;
        case 'select_session':
          if (sessionManager.status === 'running' || sessionManager.status === 'starting') {
            send(ws, { type: 'error', message: 'Cannot switch session while active' });
          } else {
            selectSession(wss, sessionManager, logDir, msg.sessionId);
          }
          break;
      }
    });

    ws.on('close', () => {
      debug('ws', 'Client disconnected');
    });
  });

  // Wire game connection manager broadcasts
  gameConnectionManager.setBroadcaster({
    onStateUpdate: (state) => broadcast(wss, { type: 'state_update', state }),
    onGameEvent: (event) => broadcast(wss, { type: 'game_event', event }),
    onGameStatus: (status) =>
      broadcast(wss, { type: 'game_status', status: status.status, message: status.message }),
    onTravelHistoryUpdate: (entry) => broadcast(wss, { type: 'travel_history_update', entry }),
  });
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(wss: WebSocketServer, message: ServerMessage): void {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

async function loadTravelHistory(sessionDir: string): Promise<TravelHistoryEntry[]> {
  try {
    const data = await fsp.readFile(path.join(sessionDir, 'travel-history.json'), 'utf-8');
    return JSON.parse(data) as TravelHistoryEntry[];
  } catch {
    return [];
  }
}

function selectSession(
  wss: WebSocketServer,
  sessionManager: SessionManager,
  logDir: string,
  sessionId: string,
): void {
  broadcast(wss, { type: 'reset' });
  sessionManager
    .loadFromHistory(sessionId)
    .then(async () => {
      const history = await loadTravelHistory(path.join(logDir, sessionId));
      broadcast(wss, { type: 'travel_history', history });
    })
    .catch((err) => {
      debug('ws', `Load from history error: ${err}`);
    });
}
