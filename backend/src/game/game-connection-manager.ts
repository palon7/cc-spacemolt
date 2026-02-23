import fs, { watch, type FSWatcher } from 'fs';
import path from 'path';
import type { GameState, GameEvent, TravelHistoryEntry } from '../state/types.js';
import type { StateUpdatePayload } from './types.js';
import { SpaceMoltClient } from './spacemolt-client.js';
import { mergeStateUpdate } from './message-transformer.js';
import { PoiCache } from './game-data-cache.js';
import { loadEnv } from '../utils/env.js';
import { debug } from '../logger/debug-logger.js';
import consola from 'consola';

const SPACEMOLT_API_BASE = 'https://game.spacemolt.com/api/v1';

export interface GameStatusInfo {
  status: 'connecting' | 'connected' | 'error' | 'paused';
  message?: string;
}

export interface GameBroadcastCallbacks {
  onStateUpdate: (state: GameState) => void;
  onGameEvent: (event: GameEvent) => void;
  onGameStatus: (status: GameStatusInfo) => void;
  onTravelHistoryUpdate: (entry: TravelHistoryEntry) => void;
}

export class GameConnectionManager {
  private readonly client: SpaceMoltClient;
  private readonly workspacePath: string;
  private readonly poiCache = new PoiCache();
  private envWatcher: FSWatcher | null = null;
  private _gameStatus: GameStatusInfo = {
    status: 'paused',
    message: 'No agent session active',
  };
  private lastUsername = '';
  private lastPassword = '';
  private broadcaster: GameBroadcastCallbacks | null = null;
  private paused = true;
  private previousSystem: string | null = null;
  private travelHistory: TravelHistoryEntry[] = [];
  private stateFilePath: string | null = null;
  private currentSessionId: string | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private restState: GameState | null = null;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;

    this.client = new SpaceMoltClient({
      onStateUpdate: (state) => this.handleStateUpdate(state),
      onGameEvent: (event) => this.broadcaster?.onGameEvent(event),
      onConnected: () => {
        this._gameStatus = { status: 'connected' };
        debug('game', 'SpaceMolt game connected');
        this.broadcaster?.onGameStatus(this._gameStatus);
      },
      onDisconnected: () => {
        this._gameStatus = { status: 'connecting', message: 'Reconnecting...' };
        consola.log('SpaceMolt game disconnected, reconnecting...');
        debug('game', 'SpaceMolt game disconnected');
        this.broadcaster?.onGameStatus(this._gameStatus);
      },
      onError: (msg) => {
        this._gameStatus = { status: 'error', message: msg };
        consola.error(`SpaceMolt error: ${msg}`);
        this.broadcaster?.onGameStatus(this._gameStatus);
      },
    });

    this.watchEnvFile();
  }

  /** Called when a new agent session starts. Saves travel history alongside session files. */
  setSessionDir(dir: string, sessionId: string): void {
    if (this.currentSessionId !== sessionId) {
      this.travelHistory = [];
      this.currentSessionId = sessionId;
    }
    this.stateFilePath = path.join(dir, 'travel-history.json');
  }

  /** Called on session reset — stops writing until next session starts. */
  clearSessionDir(): void {
    this.stateFilePath = null;
  }

  /** Set broadcast callbacks (typically wired to WebSocket broadcast by the server). */
  setBroadcaster(callbacks: GameBroadcastCallbacks): void {
    this.broadcaster = callbacks;
  }

  get currentState(): GameState | null {
    const state = this.client.currentState ?? this.restState;
    return state ? this.enrichState(state) : null;
  }

  get currentEvents(): GameEvent[] {
    return this.client.currentEvents;
  }

  get currentTravelHistory(): TravelHistoryEntry[] {
    return this.travelHistory;
  }

  get gameStatus(): GameStatusInfo {
    return this._gameStatus;
  }

  cleanup(): void {
    this.envWatcher?.close();
    this.client.disconnect();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.client.disconnect();
    this.lastUsername = '';
    this.lastPassword = '';
    this._gameStatus = { status: 'paused', message: 'Agent not running' };
    this.broadcaster?.onGameStatus(this._gameStatus);
    debug('game', 'GameConnectionManager paused');
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    debug('game', 'GameConnectionManager resuming');
    this.tryConnect();
  }

  /**
   * Fetch player state via REST API (session + login) for initial display.
   * Does not maintain a persistent connection. The result is cached in restState.
   */
  async fetchInitialState(): Promise<void> {
    const env = loadEnv(this.workspacePath);
    const username = env.SPACEMOLT_USERNAME ?? '';
    const password = env.SPACEMOLT_PASSWORD ?? '';

    if (!username || !password) {
      debug('game', 'fetchInitialState: credentials not set, skipping');
      return;
    }

    try {
      const sessionRes = await fetch(`${SPACEMOLT_API_BASE}/session`, { method: 'POST' });
      if (!sessionRes.ok) {
        debug('game', `fetchInitialState: session creation failed (${sessionRes.status})`);
        return;
      }
      const sessionData = (await sessionRes.json()) as { session?: { id?: string } };
      const sessionId = sessionData.session?.id;
      if (!sessionId) {
        debug('game', 'fetchInitialState: no session id returned');
        return;
      }

      const loginRes = await fetch(`${SPACEMOLT_API_BASE}/login`, {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!loginRes.ok) {
        debug('game', `fetchInitialState: login failed (${loginRes.status})`);
        return;
      }
      const loginData = (await loginRes.json()) as { result?: StateUpdatePayload };
      if (!loginData.result) {
        debug('game', 'fetchInitialState: no result in login response');
        return;
      }

      this.restState = mergeStateUpdate(null, loginData.result);
      // Seed previousSystem so the first WebSocket state_update doesn't
      // misidentify the initial position as a system change.
      if (this.restState.player?.current_system) {
        this.previousSystem = this.restState.player.current_system;
      }
      debug('game', 'fetchInitialState: cached initial state via REST');

      // Broadcast to any connected clients
      const enriched = this.enrichState(this.restState);
      this.broadcaster?.onStateUpdate(enriched);

      // Enrich PoI in background
      const systemId = this.restState.player?.current_system;
      if (systemId && !this.poiCache.hasSystem(systemId)) {
        this.poiCache.fetchSystem(systemId).then(() => {
          if (this.restState) {
            this.broadcaster?.onStateUpdate(this.enrichState(this.restState));
          }
        });
      }
    } catch (err) {
      debug('game', `fetchInitialState: ${err}`);
    }
  }

  /** Enrich state with PoI name and broadcast. Fetches system PoIs if not cached. */
  private handleStateUpdate(state: GameState): void {
    const systemId = state.player?.current_system;

    // Try to enrich synchronously from cache
    const enriched = this.enrichState(state);
    this.broadcaster?.onStateUpdate(enriched);

    const currentSystem = state.player?.current_system;
    if (currentSystem && this.previousSystem && currentSystem !== this.previousSystem) {
      const entry: TravelHistoryEntry = {
        from: this.previousSystem,
        to: currentSystem,
        ts: new Date().toISOString(),
      };
      this.travelHistory.push(entry);
      this.broadcaster?.onTravelHistoryUpdate(entry);
      if (this.stateFilePath) {
        const data = JSON.stringify(this.travelHistory, null, 2);
        const filePath = this.stateFilePath;
        this.writeQueue = this.writeQueue.then(() =>
          fs.promises.writeFile(filePath, data).catch((err) => {
            debug('game', `Failed to write travel history: ${err}`);
          }),
        );
      }
    }
    if (currentSystem) {
      this.previousSystem = currentSystem;
    }

    // If system not cached yet, fetch in background and re-broadcast
    if (systemId && !this.poiCache.hasSystem(systemId)) {
      this.poiCache.fetchSystem(systemId).then(() => {
        // Re-enrich with newly cached data and broadcast again
        const latest = this.client.currentState;
        if (latest) {
          this.broadcaster?.onStateUpdate(this.enrichState(latest));
        }
      });
    }
  }

  /** Add current_poi_name to state if the PoI is in cache. */
  private enrichState(state: GameState): GameState {
    const poiId = state.player?.current_poi;
    if (!poiId) return state;

    const poiName = this.poiCache.getPoiName(poiId);
    if (!poiName) return state;

    return {
      ...state,
      player: { ...state.player, current_poi_name: poiName },
    };
  }

  private tryConnect(): void {
    if (this.paused) return;
    const env = loadEnv(this.workspacePath);
    const username = env.SPACEMOLT_USERNAME ?? '';
    const password = env.SPACEMOLT_PASSWORD ?? '';

    if (!username || !password) {
      this._gameStatus = {
        status: 'error',
        message: 'SPACEMOLT_USERNAME / SPACEMOLT_PASSWORD not set in .env',
      };
      this.broadcaster?.onGameStatus(this._gameStatus);
      this.lastUsername = '';
      this.lastPassword = '';
      return;
    }

    if (username === this.lastUsername && password === this.lastPassword) return;

    this.lastUsername = username;
    this.lastPassword = password;

    if (this._gameStatus.status === 'connected' || this._gameStatus.status === 'connecting') {
      debug('game', 'Credentials changed, reconnecting SpaceMolt');
      this.client.reconnect(username, password);
    } else {
      this.client.connect(username, password);
    }
  }

  private watchEnvFile(): void {
    // Watch the directory instead of the file so we detect .env creation
    try {
      this.envWatcher = watch(this.workspacePath, (_, filename) => {
        if (filename === '.env') {
          debug('game', '.env changed, re-reading credentials');
          if (this.paused) return;
          this.tryConnect();
        }
      });
    } catch {
      debug(
        'game',
        `.env watch failed for ${this.workspacePath}, will not auto-reconnect on changes`,
      );
    }
  }
}
