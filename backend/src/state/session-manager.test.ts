import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from './session-manager.js';
import type { SessionManagerCallbacks } from './session-manager.js';
import type { AgentProvider, ProviderCallbacks } from '../agent/provider.js';
import type { AutoResumeConfig } from '../config.js';
import { DEFAULT_AUTO_RESUME_CONFIG } from '../config.js';
import type { RuntimeSettings } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProvider(overrides?: Partial<AgentProvider>): AgentProvider {
  return {
    name: 'mock',
    supportsInput: true,
    sessionId: 'test-session',
    start: vi.fn<AgentProvider['start']>().mockResolvedValue(undefined),
    sendMessage: vi.fn(),
    interrupt: vi.fn(),
    abort: vi.fn(),
    setResumeSessionId: vi.fn(),
    ...overrides,
  };
}

function createMockCallbacks(): SessionManagerCallbacks & {
  settingsHistory: RuntimeSettings[];
} {
  const settingsHistory: RuntimeSettings[] = [];
  return {
    onEntry: vi.fn(),
    onMeta: vi.fn(),
    onStatus: vi.fn(),
    onClearStreaming: vi.fn(),
    onError: vi.fn(),
    onSessionStarted: vi.fn(),
    onSettingsChange: vi.fn((settings: RuntimeSettings) => {
      settingsHistory.push(structuredClone(settings));
    }),
    settingsHistory,
  };
}

function makeAutoResumeConfig(overrides?: Partial<AutoResumeConfig>): AutoResumeConfig {
  return { ...DEFAULT_AUTO_RESUME_CONFIG, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionManager auto-resume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // getAutoResumeState / getRuntimeSettings
  // -------------------------------------------------------------------------

  describe('getAutoResumeState', () => {
    it('returns default disabled state', () => {
      const sm = new SessionManager(
        createMockProvider(),
        1000,
        '/tmp/logs',
        makeAutoResumeConfig(),
      );
      expect(sm.getAutoResumeState()).toEqual({
        enabled: false,
        timeoutMinutes: 0,
        startedAt: null,
        stopping: false,
      });
    });

    it('returns config-based initial state when enabled in config', () => {
      const sm = new SessionManager(
        createMockProvider(),
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true, timeoutMinutes: 60 }),
      );
      expect(sm.getAutoResumeState().enabled).toBe(true);
      expect(sm.getAutoResumeState().timeoutMinutes).toBe(60);
    });
  });

  describe('getRuntimeSettings', () => {
    it('wraps autoResume in RuntimeSettings', () => {
      const sm = new SessionManager(
        createMockProvider(),
        1000,
        '/tmp/logs',
        makeAutoResumeConfig(),
      );
      const settings = sm.getRuntimeSettings();
      expect(settings).toEqual({ autoResume: sm.getAutoResumeState() });
    });
  });

  // -------------------------------------------------------------------------
  // setAutoResume
  // -------------------------------------------------------------------------

  describe('setAutoResume', () => {
    it('enables auto-resume and sets startedAt', () => {
      const sm = new SessionManager(
        createMockProvider(),
        1000,
        '/tmp/logs',
        makeAutoResumeConfig(),
      );
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      sm.setAutoResume(true, 60);

      const state = sm.getAutoResumeState();
      expect(state.enabled).toBe(true);
      expect(state.timeoutMinutes).toBe(60);
      expect(state.startedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(cb.onSettingsChange).toHaveBeenCalled();
    });

    it('disables auto-resume and clears state', () => {
      const sm = new SessionManager(
        createMockProvider(),
        1000,
        '/tmp/logs',
        makeAutoResumeConfig(),
      );
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      sm.setAutoResume(true, 30);
      sm.setAutoResume(false);

      const state = sm.getAutoResumeState();
      expect(state.enabled).toBe(false);
      expect(state.startedAt).toBeNull();
      expect(state.stopping).toBe(false);
    });

    it('does not reset startedAt when re-enabling with different timeout', () => {
      const sm = new SessionManager(
        createMockProvider(),
        1000,
        '/tmp/logs',
        makeAutoResumeConfig(),
      );
      sm.setCallbacks(createMockCallbacks());

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      sm.setAutoResume(true, 30);
      const firstStartedAt = sm.getAutoResumeState().startedAt;

      vi.setSystemTime(new Date('2026-01-01T00:05:00Z'));
      sm.setAutoResume(true, 60);

      expect(sm.getAutoResumeState().startedAt).toBe(firstStartedAt);
      expect(sm.getAutoResumeState().timeoutMinutes).toBe(60);
    });

    it('kicks off auto-resume when enabled while status is done', async () => {
      let resolveStart: () => void;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(provider, 1000, '/tmp/logs', makeAutoResumeConfig());
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      // Start and complete the agent
      const startPromise = sm.start('hello');
      resolveStart!();
      await startPromise;
      expect(sm.status).toBe('done');

      // Enable auto-resume after agent is done
      sm.setAutoResume(true, 0);

      // Advance past the 3-second delay
      await vi.advanceTimersByTimeAsync(3500);

      // provider.start should have been called again (via resume)
      expect(provider.start).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // scheduleAutoResume: normal flow
  // -------------------------------------------------------------------------

  describe('auto-resume on completion', () => {
    it('auto-resumes 3 seconds after agent completes when enabled', async () => {
      let resolveStart: () => void;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true }),
      );
      sm.setCallbacks(createMockCallbacks());

      // First start
      const p = sm.start('hello');
      resolveStart!();
      await p;

      expect(sm.status).toBe('done');
      expect(provider.start).toHaveBeenCalledTimes(1);

      // Advance 3s — auto-resume should trigger
      await vi.advanceTimersByTimeAsync(3500);
      expect(provider.start).toHaveBeenCalledTimes(2);
    });

    it('does not auto-resume when disabled', async () => {
      let resolveStart: () => void;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: false }),
      );
      sm.setCallbacks(createMockCallbacks());

      const p = sm.start('hello');
      resolveStart!();
      await p;

      await vi.advanceTimersByTimeAsync(5000);
      expect(provider.start).toHaveBeenCalledTimes(1);
    });

    it('does not auto-resume when interrupted', async () => {
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>(() => {}); // never resolves
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true }),
      );
      sm.setCallbacks(createMockCallbacks());

      sm.start('hello');

      // Interrupt sets isResuming and the provider completes
      sm.interrupt();

      await vi.advanceTimersByTimeAsync(5000);
      // Only 1 call (the initial start)
      expect(provider.start).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Consecutive errors
  // -------------------------------------------------------------------------

  describe('consecutive errors', () => {
    it('disables auto-resume after 3 consecutive errors', async () => {
      const provider = createMockProvider({
        start: vi.fn().mockRejectedValue(new Error('fail')),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true }),
      );
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      // Each start will fail, incrementing consecutiveErrors
      // After 3 errors, auto-resume should be disabled
      await sm.start('hello'); // error 1 → scheduleAutoResume
      await vi.advanceTimersByTimeAsync(3500);
      // error 2 → scheduleAutoResume
      await vi.advanceTimersByTimeAsync(3500);
      // error 3 → disables
      await vi.advanceTimersByTimeAsync(3500);

      expect(sm.getAutoResumeState().enabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Timeout handling
  // -------------------------------------------------------------------------

  describe('timeout', () => {
    it('disables auto-resume when timeout exceeded at completion (checked in scheduleAutoResume)', async () => {
      let resolveStart: () => void;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true, timeoutMinutes: 1 }),
      );
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      // Start and complete quickly
      const p1 = sm.start('hello');
      resolveStart!();
      await p1;
      // Now auto-resume is scheduled (3s) and timeout (60s)

      // Advance 3s — auto-resume fires, starts new provider
      await vi.advanceTimersByTimeAsync(3500);
      expect(provider.start).toHaveBeenCalledTimes(2);

      // Now advance well past the timeout while provider is running
      // (resolveStart from 2nd call hasn't fired, so provider is still running)
      // Instead, let the 2nd provider complete after the timeout has passed
      vi.setSystemTime(new Date('2026-01-01T00:02:00Z'));
      resolveStart!();
      await vi.advanceTimersByTimeAsync(100);

      // scheduleAutoResume() should detect timeout exceeded at completion
      expect(sm.getAutoResumeState().enabled).toBe(false);
    });

    it('sends timeout message when timeout fires while agent is running', async () => {
      const provider = createMockProvider({
        start: vi.fn().mockImplementation((cb: ProviderCallbacks) => {
          // Emit system entry to transition to 'running'
          cb.onMessage({
            id: 'sys-1',
            timestamp: new Date().toISOString(),
            kind: 'system',
            sessionId: 'test-session',
            model: 'sonnet',
            tools: [],
            mcpServers: [],
          });
          // Never resolve — agent keeps running
          return new Promise<void>(() => {});
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        // Start disabled — we enable via setAutoResume so timeout timer starts
        makeAutoResumeConfig({ timeoutMessage: 'Time is up!' }),
      );
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      sm.start('hello');
      await vi.advanceTimersByTimeAsync(100);
      expect(sm.status).toBe('running');

      // Enable auto-resume with 1-min timeout while agent is running
      sm.setAutoResume(true, 1);

      // Advance past 1 minute timeout
      vi.advanceTimersByTime(60_000);

      // Should have sent the timeout message
      expect(provider.sendMessage).toHaveBeenCalledWith('Time is up!');
      expect(sm.getAutoResumeState().stopping).toBe(true);
    });

    it('force-stops after grace period when agent does not complete', async () => {
      const provider = createMockProvider({
        start: vi.fn().mockImplementation((cb: ProviderCallbacks) => {
          cb.onMessage({
            id: 'sys-1',
            timestamp: new Date().toISOString(),
            kind: 'system',
            sessionId: 'test-session',
            model: 'sonnet',
            tools: [],
            mcpServers: [],
          });
          return new Promise<void>(() => {});
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ forceStopDelaySeconds: 10 }),
      );
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      sm.start('hello');
      await vi.advanceTimersByTimeAsync(100);
      expect(sm.status).toBe('running');

      // Enable auto-resume with 1-min timeout
      sm.setAutoResume(true, 1);

      // Advance to timeout
      vi.advanceTimersByTime(60_000);
      expect(sm.getAutoResumeState().stopping).toBe(true);

      // Advance past force-stop delay
      vi.advanceTimersByTime(10_000);

      // Should have called interrupt (force stop)
      expect(provider.interrupt).toHaveBeenCalled();
      expect(sm.getAutoResumeState().enabled).toBe(false);
      expect(sm.getAutoResumeState().stopping).toBe(false);
    });

    it('gracefully stops when agent completes after timeout message', async () => {
      let resolveStart: () => void;
      let startCount = 0;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation((cb: ProviderCallbacks) => {
          startCount++;
          cb.onMessage({
            id: `sys-${startCount}`,
            timestamp: new Date().toISOString(),
            kind: 'system',
            sessionId: 'test-session',
            model: 'sonnet',
            tools: [],
            mcpServers: [],
          });
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ forceStopDelaySeconds: 60 }),
      );
      sm.setCallbacks(createMockCallbacks());

      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      sm.start('hello');
      await vi.advanceTimersByTimeAsync(100);

      // Enable timeout
      sm.setAutoResume(true, 1);

      // Timeout fires, sends timeout message
      vi.advanceTimersByTime(60_000);
      expect(sm.getAutoResumeState().stopping).toBe(true);

      // Agent completes gracefully before force-stop
      resolveStart!();
      await vi.advanceTimersByTimeAsync(100);

      // scheduleAutoResume detects stopping=true, disables auto-resume
      expect(sm.getAutoResumeState().enabled).toBe(false);
      expect(sm.getAutoResumeState().stopping).toBe(false);
      // Force-stop should NOT have been called
      expect(provider.interrupt).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Manual actions
  // -------------------------------------------------------------------------

  describe('manual actions clear timers', () => {
    it('abort disables auto-resume entirely', async () => {
      let resolveStart: () => void;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true }),
      );
      sm.setCallbacks(createMockCallbacks());

      const p = sm.start('hello');
      resolveStart!();
      await p;

      // Auto-resume is scheduled
      sm.abort();

      expect(sm.getAutoResumeState().enabled).toBe(false);

      // Advance time — should not auto-resume
      await vi.advanceTimersByTimeAsync(5000);
      expect(provider.start).toHaveBeenCalledTimes(1);
    });

    it('reset disables auto-resume entirely', async () => {
      let resolveStart: () => void;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true }),
      );
      sm.setCallbacks(createMockCallbacks());

      const p = sm.start('hello');
      resolveStart!();
      await p;

      sm.reset();
      expect(sm.getAutoResumeState().enabled).toBe(false);
    });

    it('manual resume cancels pending auto-resume timer', async () => {
      let resolveStart: () => void;
      const provider = createMockProvider({
        start: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveStart = resolve;
          });
        }),
      });

      const sm = new SessionManager(
        provider,
        1000,
        '/tmp/logs',
        makeAutoResumeConfig({ enabled: true, message: 'auto msg' }),
      );
      sm.setCallbacks(createMockCallbacks());

      // Start and complete → auto-resume is scheduled (3s)
      const p = sm.start('hello');
      resolveStart!();
      await p;

      expect(provider.start).toHaveBeenCalledTimes(1);

      // Manual resume before the 3s timer fires
      const p2 = sm.resume('manual message');
      resolveStart!();
      await p2;

      // provider.start was called with 'manual message' (from resume), not 'auto msg'
      expect(provider.start).toHaveBeenCalledTimes(2);
      expect(provider.start).toHaveBeenLastCalledWith(expect.anything(), 'manual message');
    });
  });

  // -------------------------------------------------------------------------
  // broadcastSettings
  // -------------------------------------------------------------------------

  describe('broadcastSettings', () => {
    it('broadcasts settings on each state change', () => {
      const sm = new SessionManager(
        createMockProvider(),
        1000,
        '/tmp/logs',
        makeAutoResumeConfig(),
      );
      const cb = createMockCallbacks();
      sm.setCallbacks(cb);

      sm.setAutoResume(true, 60);
      sm.setAutoResume(false);

      // enable broadcasts once, disable broadcasts once
      expect(cb.settingsHistory).toHaveLength(2);
      expect(cb.settingsHistory[0]!.autoResume.enabled).toBe(true);
      expect(cb.settingsHistory[1]!.autoResume.enabled).toBe(false);
    });
  });
});
