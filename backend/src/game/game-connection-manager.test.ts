import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameConnectionManager } from './game-connection-manager.js';

// Mock SpaceMoltClient to avoid real WS connections
vi.mock('./spacemolt-client.js', () => ({
  SpaceMoltClient: vi.fn().mockImplementation(() => ({
    currentState: null,
    currentEvents: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
  })),
}));

// Mock PoiCache
vi.mock('./game-data-cache.js', () => ({
  PoiCache: vi.fn().mockImplementation(() => ({
    hasSystem: () => false,
    fetchSystem: () => Promise.resolve(),
    getPoiName: () => undefined,
  })),
}));

// Mock env to return credentials
vi.mock('../utils/env.js', () => ({
  loadEnv: () => ({
    SPACEMOLT_USERNAME: 'TestUser',
    SPACEMOLT_PASSWORD: 'test-pass',
  }),
}));

describe('GameConnectionManager.fetchInitialState', () => {
  let gcm: GameConnectionManager;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    gcm = new GameConnectionManager('/tmp/test-workspace');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    gcm.cleanup();
  });

  it('should fetch and cache initial state via REST API', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session: { id: 'test-session-id' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              player: {
                username: 'TestUser',
                empire: 'voidborn',
                credits: 500,
                current_system: 'nexus',
                current_poi: 'nexus_sun',
              },
              ship: {
                class_id: 'starter_mining',
                name: 'TestShip',
                hull: 100,
                max_hull: 100,
              },
            },
          }),
      });

    await gcm.fetchInitialState();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const state = gcm.currentState;
    expect(state).not.toBeNull();
    expect(state!.player.username).toBe('TestUser');
    expect(state!.player.credits).toBe(500);
    expect(state!.ship.name).toBe('TestShip');
  });

  it('should handle session creation failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });

    await gcm.fetchInitialState();

    expect(gcm.currentState).toBeNull();
  });

  it('should handle login failure gracefully', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session: { id: 'test-session-id' } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    await gcm.fetchInitialState();

    expect(gcm.currentState).toBeNull();
  });

  it('should broadcast state to connected clients', async () => {
    const onStateUpdate = vi.fn();
    gcm.setBroadcaster({
      onStateUpdate,
      onGameEvent: vi.fn(),
      onGameStatus: vi.fn(),
      onTravelHistoryUpdate: vi.fn(),
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session: { id: 'sid' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              player: { username: 'TestUser', current_system: 'nexus', current_poi: 'nexus_sun' },
              ship: { name: 'Ship' },
            },
          }),
      });

    await gcm.fetchInitialState();
    // Wait for PoI enrichment microtask to settle
    await new Promise((r) => setTimeout(r, 0));

    // Called at least once for initial broadcast, possibly twice for PoI re-enrichment
    expect(onStateUpdate).toHaveBeenCalled();
    expect(onStateUpdate.mock.calls[0][0].player.username).toBe('TestUser');
  });
});

describe('GameConnectionManager.setTravelHistory', () => {
  let gcm: GameConnectionManager;

  beforeEach(() => {
    gcm = new GameConnectionManager('/tmp/test-workspace');
  });

  afterEach(() => {
    gcm.cleanup();
  });

  it('should replace travel history with a defensive copy', () => {
    const history = [{ from: 'a', to: 'b', ts: '2026-01-01T00:00:00.000Z' }];

    gcm.setTravelHistory(history, 'session-1');
    history.push({ from: 'b', to: 'c', ts: '2026-01-01T00:01:00.000Z' });

    expect(gcm.currentTravelHistory).toEqual([
      { from: 'a', to: 'b', ts: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('should clear in-memory history on clearSessionDir', () => {
    gcm.setTravelHistory([{ from: 'a', to: 'b', ts: '2026-01-01T00:00:00.000Z' }], 'session-1');

    gcm.clearSessionDir();

    expect(gcm.currentTravelHistory).toEqual([]);
  });
});
