import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { listSessions, replaySession } from './session-history.js';
import type { SystemEntry, ToolCallEntry, ToolResultEntry, ResultEntry } from './types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-history-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeSession(sessionId: string, lines: object[]): void {
  const dir = path.join(tmpDir, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'raw.jsonl'), content, 'utf-8');
}

const SYSTEM_MSG = {
  type: 'system',
  subtype: 'init',
  session_id: '00000000-0000-0000-0000-000000000001',
  model: 'claude-3',
  tools: ['bash', 'read'],
  mcp_servers: [{ name: 'test', status: 'connected' }],
};

const ASSISTANT_MSG = {
  type: 'assistant',
  message: {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Hello' },
      { type: 'tool_use', id: 'tu-1', name: 'bash', input: { command: 'ls' } },
    ],
  },
};

const USER_MSG_WITH_RESULT = {
  type: 'user',
  message: {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'file1\nfile2' }],
  },
};

const RESULT_MSG = {
  type: 'result',
  subtype: 'end_turn',
  total_cost_usd: 0.05,
  num_turns: 3,
  duration_ms: 12000,
  is_error: false,
};

// ---------------------------------------------------------------------------
// listSessions
// ---------------------------------------------------------------------------

describe('listSessions', () => {
  it('returns empty array for empty directory', async () => {
    const result = await listSessions(tmpDir);
    expect(result).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    const result = await listSessions('/tmp/nonexistent-dir-12345');
    expect(result).toEqual([]);
  });

  it('lists sessions with valid raw.jsonl', async () => {
    writeSession('00000000-0000-0000-0000-000000000001', [SYSTEM_MSG, RESULT_MSG]);
    const result = await listSessions(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('00000000-0000-0000-0000-000000000001');
    expect(result[0].model).toBe('claude-3');
    expect(result[0].totalCostUsd).toBe(0.05);
    expect(result[0].numTurns).toBe(3);
    expect(result[0].durationMs).toBe(12000);
    expect(result[0].entryCount).toBe(2);
  });

  it('skips non-UUID directories (like game-*)', async () => {
    const gameDir = path.join(tmpDir, 'game-1234567890');
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, 'state.json'), '[]', 'utf-8');

    writeSession('00000000-0000-0000-0000-000000000001', [SYSTEM_MSG]);
    const result = await listSessions(tmpDir);
    expect(result).toHaveLength(1);
  });

  it('skips directories without raw.jsonl', async () => {
    fs.mkdirSync(path.join(tmpDir, '00000000-0000-0000-0000-000000000002'));
    writeSession('00000000-0000-0000-0000-000000000001', [SYSTEM_MSG]);
    const result = await listSessions(tmpDir);
    expect(result).toHaveLength(1);
  });

  it('sorts by lastModified descending', async () => {
    writeSession('00000000-0000-0000-0000-000000000001', [SYSTEM_MSG]);
    // Wait a bit so mtime differs
    await new Promise((r) => setTimeout(r, 50));
    writeSession('00000000-0000-0000-0000-000000000002', [
      { ...SYSTEM_MSG, session_id: '00000000-0000-0000-0000-000000000002' },
    ]);

    const result = await listSessions(tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0].sessionId).toBe('00000000-0000-0000-0000-000000000002');
    expect(result[1].sessionId).toBe('00000000-0000-0000-0000-000000000001');
  });
});

// ---------------------------------------------------------------------------
// replaySession
// ---------------------------------------------------------------------------

describe('replaySession', () => {
  it('throws for invalid session ID format', async () => {
    await expect(replaySession(tmpDir, 'not-a-uuid')).rejects.toThrow('Invalid session ID format');
  });

  it('throws for non-existent session', async () => {
    await expect(replaySession(tmpDir, '00000000-0000-0000-0000-000000000099')).rejects.toThrow();
  });

  it('replays a basic session with system, assistant, user, and result', async () => {
    const sessionId = '00000000-0000-0000-0000-000000000001';
    writeSession(sessionId, [SYSTEM_MSG, ASSISTANT_MSG, USER_MSG_WITH_RESULT, RESULT_MSG]);

    const { entries, meta } = await replaySession(tmpDir, sessionId);

    // system(1) + text(1) + tool_call(1) + tool_result(1) + result(1) = 5
    expect(entries).toHaveLength(5);

    const system = entries[0] as SystemEntry;
    expect(system.kind).toBe('system');
    expect(system.model).toBe('claude-3');

    const toolCall = entries.find((e) => e.kind === 'tool_call') as ToolCallEntry;
    expect(toolCall.toolName).toBe('bash');
    expect(toolCall.toolUseId).toBe('tu-1');

    const toolResult = entries.find((e) => e.kind === 'tool_result') as ToolResultEntry;
    expect(toolResult.toolName).toBe('bash');
    expect(toolResult.toolUseId).toBe('tu-1');

    const result = entries.find((e) => e.kind === 'result') as ResultEntry;
    expect(result.totalCostUsd).toBe(0.05);

    expect(meta).not.toBeNull();
    expect(meta!.model).toBe('claude-3');
    expect(meta!.totalCostUsd).toBe(0.05);
    expect(meta!.numTurns).toBe(3);
  });

  it('correctly resolves toolName via local toolNameMap', async () => {
    const sessionId = '00000000-0000-0000-0000-000000000001';
    const assistant = {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tu-abc', name: 'read_file', input: { path: '/etc/hosts' } },
        ],
      },
    };
    const user = {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu-abc', content: '127.0.0.1 localhost' }],
      },
    };
    writeSession(sessionId, [SYSTEM_MSG, assistant, user]);

    const { entries } = await replaySession(tmpDir, sessionId);
    const toolResult = entries.find((e) => e.kind === 'tool_result') as ToolResultEntry;
    expect(toolResult.toolName).toBe('read_file');
  });

  it('handles empty raw.jsonl gracefully', async () => {
    const sessionId = '00000000-0000-0000-0000-000000000001';
    const dir = path.join(tmpDir, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'raw.jsonl'), '', 'utf-8');

    const { entries, meta } = await replaySession(tmpDir, sessionId);
    expect(entries).toHaveLength(0);
    expect(meta).toBeNull();
  });

  it('skips malformed JSON lines', async () => {
    const sessionId = '00000000-0000-0000-0000-000000000001';
    const dir = path.join(tmpDir, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    const content =
      JSON.stringify(SYSTEM_MSG) + '\n' + 'not valid json\n' + JSON.stringify(RESULT_MSG) + '\n';
    fs.writeFileSync(path.join(dir, 'raw.jsonl'), content, 'utf-8');

    const { entries } = await replaySession(tmpDir, sessionId);
    expect(entries).toHaveLength(2); // system + result
  });
});
