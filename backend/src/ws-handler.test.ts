import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentStatus } from './state/types.js';
import type { GameConnectionManager } from './game/game-connection-manager.js';
import { syncGameConnection } from './ws-handler.js';

function createMockGameConnectionManager() {
  return {
    resume: vi.fn(),
    pause: vi.fn(),
  } as unknown as GameConnectionManager;
}

describe('syncGameConnection', () => {
  let gcm: GameConnectionManager;

  beforeEach(() => {
    gcm = createMockGameConnectionManager();
  });

  it('should call resume when status is "starting"', () => {
    syncGameConnection('starting', gcm);
    expect(gcm.resume).toHaveBeenCalledOnce();
    expect(gcm.pause).not.toHaveBeenCalled();
  });

  it('should call resume when status is "running"', () => {
    syncGameConnection('running', gcm);
    expect(gcm.resume).toHaveBeenCalledOnce();
    expect(gcm.pause).not.toHaveBeenCalled();
  });

  it.each(['idle', 'done', 'interrupted', 'error'] as AgentStatus[])(
    'should call pause when status is "%s"',
    (status) => {
      syncGameConnection(status, gcm);
      expect(gcm.pause).toHaveBeenCalledOnce();
      expect(gcm.resume).not.toHaveBeenCalled();
    },
  );

  it('resume/pause are idempotent (delegates to GameConnectionManager guards)', () => {
    // Calling multiple times just delegates — the guards are inside GameConnectionManager
    syncGameConnection('running', gcm);
    syncGameConnection('running', gcm);
    expect(gcm.resume).toHaveBeenCalledTimes(2);

    syncGameConnection('idle', gcm);
    syncGameConnection('idle', gcm);
    expect(gcm.pause).toHaveBeenCalledTimes(2);
  });
});
