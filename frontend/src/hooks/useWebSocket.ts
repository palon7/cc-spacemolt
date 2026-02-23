import { useState, useEffect, useRef, useCallback } from 'react';
import { MAX_GAME_EVENTS } from '@cc-spacemolt/shared';
import type {
  ParsedEntry,
  SessionMeta,
  AgentStatus,
  ClientMessage,
  ServerMessage,
  GameState,
  GameEvent,
  GameConnectionStatus,
  TravelHistoryEntry,
} from '@cc-spacemolt/shared';

export function useWebSocket() {
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameStatus, setGameStatus] = useState<{ status: GameConnectionStatus; message?: string }>({
    status: 'connecting',
  });
  const [initialPrompt, setInitialPrompt] = useState('');
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [travelHistory, setTravelHistory] = useState<TravelHistoryEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect on manual close
      wsRef.current.close();
      wsRef.current = null;
    }
    clearTimeout(reconnectTimer.current);

    if (!mountedRef.current) return;

    const host = window.location.hostname;
    const port = import.meta.env.DEV ? '3001' : window.location.port;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}:${port}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
      const isActive = wsRef.current === ws;
      if (isActive) {
        wsRef.current = null;
      }
      // Only reconnect if still mounted and this is the active connection.
      // Checking isActive prevents a stale socket's close event from
      // queuing a duplicate reconnect timer after a new connection is already open.
      if (mountedRef.current && isActive) {
        reconnectTimer.current = setTimeout(connect, 2000);
      }
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case 'entry': {
          const entry = msg.entry;
          setEntries((prev) => {
            const existingIndex = prev.findIndex((e) => e.id === entry.id);
            if (existingIndex !== -1) {
              const next = [...prev];
              next[existingIndex] = entry;
              return next;
            }
            return [...prev, entry];
          });
          break;
        }
        case 'clear_streaming':
          setEntries((prev) =>
            prev.filter((e) => {
              if ((e.kind === 'text' || e.kind === 'thinking') && e.isStreaming) return false;
              if (e.kind === 'tool_call' && Object.keys(e.input).length === 0) return false;
              return true;
            }),
          );
          break;
        case 'reset':
          setEntries([]);
          setSessionMeta(null);
          setStatus('idle');
          setTravelHistory([]);
          break;
        case 'config':
          setInitialPrompt(msg.initialPrompt);
          break;
        case 'meta':
          setSessionMeta(msg.meta);
          break;
        case 'status':
          setStatus(msg.status);
          break;
        case 'state_update':
          setGameState(msg.state);
          break;
        case 'game_events':
          setEvents(msg.events);
          break;
        case 'game_status':
          setGameStatus({ status: msg.status, message: msg.message });
          break;
        case 'game_event':
          setEvents((prev) => {
            const updated = [msg.event, ...prev];
            return updated.length > MAX_GAME_EVENTS ? updated.slice(0, MAX_GAME_EVENTS) : updated;
          });
          break;
        case 'travel_history':
          setTravelHistory(msg.history);
          break;
        case 'travel_history_update':
          setTravelHistory((prev) => [...prev, msg.entry]);
          break;
        case 'error':
          console.error('Server error:', msg.message);
          break;
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on cleanup close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  const startAgent = useCallback(
    (instructions?: string) => send({ type: 'start', instructions: instructions || undefined }),
    [send],
  );

  const sendMessage = useCallback((text: string) => send({ type: 'send_message', text }), [send]);

  const interrupt = useCallback(() => send({ type: 'interrupt' }), [send]);

  const abort = useCallback(() => send({ type: 'abort' }), [send]);

  const resetSession = useCallback(() => send({ type: 'reset' }), [send]);

  const selectSession = useCallback(
    (sessionId: string) => send({ type: 'select_session', sessionId }),
    [send],
  );

  return {
    entries,
    sessionMeta,
    status,
    connected,
    gameState,
    gameStatus,
    events,
    travelHistory,
    initialPrompt,
    startAgent,
    sendMessage,
    interrupt,
    abort,
    resetSession,
    selectSession,
  };
}
