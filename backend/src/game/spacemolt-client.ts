// ---------------------------------------------------------------------------
// SpaceMolt WebSocket client — connects to wss://game.spacemolt.com/ws
// ---------------------------------------------------------------------------

import WebSocket from 'ws';
import type { GameState, GameEvent } from '../state/types.js';
import type { SpaceMoltMessage, StateUpdatePayload } from './types.js';
import { mergeStateUpdate, transformEventMessage } from './message-transformer.js';
import { debug } from '../logger/debug-logger.js';

const WS_URL = 'wss://game.spacemolt.com/ws';
const INITIAL_RECONNECT_MS = 2_000;
const MAX_RECONNECT_MS = 30_000;
const HEALTH_CHECK_INTERVAL_MS = 60_000;
const PONG_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_EVENTS = 500;

export interface SpaceMoltClientCallbacks {
  onStateUpdate: (state: GameState) => void;
  onGameEvent: (event: GameEvent) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (message: string) => void;
}

// Message types that should NOT produce a GameEvent (they update state instead)
const STATE_ONLY_TYPES = new Set(['welcome', 'logged_in', 'state_update', 'tick']);

// Auth errors — do not retry
const AUTH_ERROR_CODES = new Set(['invalid_credentials', 'auth_failed', 'banned']);

export class SpaceMoltClient {
  private ws: WebSocket | null = null;
  private callbacks: SpaceMoltClientCallbacks;
  private maxEvents: number;

  private username = '';
  private password = '';

  private latestState: GameState | null = null;
  private recentEvents: GameEvent[] = [];

  private reconnectMs = INITIAL_RECONNECT_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private intentionalClose = false;

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMessageAt = 0;

  constructor(callbacks: SpaceMoltClientCallbacks, maxEvents = DEFAULT_MAX_EVENTS) {
    this.callbacks = callbacks;
    this.maxEvents = maxEvents;
  }

  get currentState(): GameState | null {
    return this.latestState;
  }

  get currentEvents(): GameEvent[] {
    return this.recentEvents;
  }

  connect(username: string, password: string): void {
    this.username = username;
    this.password = password;
    this.intentionalClose = false;
    this.shouldReconnect = true;
    this.doConnect();
  }

  reconnect(username: string, password: string): void {
    this.disconnect();
    this.connect(username, password);
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.shouldReconnect = false;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private doConnect(): void {
    debug('spacemolt', `Connecting to ${WS_URL}`);

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.on('open', () => {
      debug('spacemolt', 'WebSocket open');
      this.reconnectMs = INITIAL_RECONNECT_MS;
      this.lastMessageAt = Date.now();
      this.startHealthCheck();
    });

    ws.on('message', (data) => {
      this.lastMessageAt = Date.now();

      let msg: SpaceMoltMessage;
      try {
        msg = JSON.parse(data.toString()) as SpaceMoltMessage;
      } catch {
        debug('spacemolt', 'Failed to parse message');
        return;
      }

      this.handleMessage(msg);
    });

    ws.on('pong', () => {
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
    });

    ws.on('close', () => {
      debug('spacemolt', 'WebSocket closed');
      this.clearTimers();
      if (!this.intentionalClose) {
        this.callbacks.onDisconnected();
        this.scheduleReconnect();
      }
    });

    ws.on('error', (err) => {
      debug('spacemolt', `WebSocket error: ${err.message}`);
    });
  }

  private handleMessage(msg: SpaceMoltMessage): void {
    const { type, payload } = msg;
    debug('spacemolt', `Received: ${type}`);

    switch (type) {
      case 'welcome':
        debug('spacemolt', `Server welcome: ${JSON.stringify(payload)}`);
        this.sendWs({
          type: 'login',
          payload: { username: this.username, password: this.password },
        });
        break;

      case 'logged_in': {
        debug('spacemolt', 'Logged in successfully');
        const state = mergeStateUpdate(this.latestState, payload as StateUpdatePayload);
        this.latestState = state;
        this.callbacks.onStateUpdate(state);
        this.callbacks.onConnected();
        break;
      }

      case 'state_update': {
        const state = mergeStateUpdate(this.latestState, payload as StateUpdatePayload);
        this.latestState = state;
        this.callbacks.onStateUpdate(state);
        break;
      }

      case 'tick': {
        const tickPayload = payload as { tick?: number } | undefined;
        if (this.latestState && tickPayload?.tick != null) {
          this.latestState = { ...this.latestState, tick: tickPayload.tick };
          this.callbacks.onStateUpdate(this.latestState);
        }
        break;
      }

      case 'error': {
        const ep = payload as { code?: string; message?: string } | undefined;
        const code = ep?.code ?? '';
        const message = ep?.message ?? 'Unknown error';
        debug('spacemolt', `Error: code=${code} message=${message}`);

        if (AUTH_ERROR_CODES.has(code)) {
          this.shouldReconnect = false;
          this.callbacks.onError(`Auth error: ${message}`);
          this.ws?.close();
          return;
        }

        // Still produce a GameEvent for non-auth errors
        const event = transformEventMessage(type, payload);
        this.pushEvent(event);
        this.callbacks.onGameEvent(event);
        break;
      }

      case 'state_change': {
        // state_change indicates arrival — clear travel state
        if (this.latestState) {
          this.latestState = {
            ...this.latestState,
            travel_progress: null,
            travel_destination: null,
            travel_type: null,
            travel_arrival_tick: null,
          };
          this.callbacks.onStateUpdate(this.latestState);
        }
        const scEvent = transformEventMessage(type, payload);
        this.pushEvent(scEvent);
        this.callbacks.onGameEvent(scEvent);
        break;
      }

      default:
        // Event messages
        if (!STATE_ONLY_TYPES.has(type)) {
          const event = transformEventMessage(type, payload);
          this.pushEvent(event);
          this.callbacks.onGameEvent(event);
        }
        break;
    }
  }

  private pushEvent(event: GameEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents = this.recentEvents.slice(-this.maxEvents);
    }
  }

  private sendWs(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ---------------------------------------------------------------------------
  // Reconnection (exponential backoff)
  // ---------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    debug('spacemolt', `Reconnecting in ${this.reconnectMs}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.reconnectMs);

    this.reconnectMs = Math.min(this.reconnectMs * 2, MAX_RECONNECT_MS);
  }

  // ---------------------------------------------------------------------------
  // Health check (ping/pong)
  // ---------------------------------------------------------------------------

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const elapsed = Date.now() - this.lastMessageAt;
      if (elapsed >= HEALTH_CHECK_INTERVAL_MS) {
        debug('spacemolt', 'Sending ping (no messages for 60s)');
        this.ws.ping();
        this.pongTimer = setTimeout(() => {
          debug('spacemolt', 'Pong timeout — closing connection');
          this.ws?.terminate();
        }, PONG_TIMEOUT_MS);
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHealthCheck();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
