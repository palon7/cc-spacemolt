import { describe, it, expect, beforeEach } from 'vitest';
import { parseMessage, resetParserState } from './message-parser.js';
import type {
  SystemEntry,
  TextEntry,
  ThinkingEntry,
  ToolCallEntry,
  ToolResultEntry,
  UserMessageEntry,
  ResultEntry,
} from '../state/types.js';

beforeEach(() => {
  resetParserState();
});

// ---------------------------------------------------------------------------
// system
// ---------------------------------------------------------------------------

describe('parseMessage - system', () => {
  it('system/init -> SystemEntry', () => {
    const entries = parseMessage({
      type: 'system',
      subtype: 'init',
      session_id: 'sess-1',
      model: 'claude-3',
      tools: ['bash'],
      mcp_servers: [],
    });
    expect(entries).toHaveLength(1);
    const e = entries[0] as SystemEntry;
    expect(e.kind).toBe('system');
    expect(e.sessionId).toBe('sess-1');
    expect(e.model).toBe('claude-3');
    expect(e.tools).toEqual(['bash']);
  });

  it('system/init -> betas are preserved', () => {
    const entries = parseMessage({
      type: 'system',
      subtype: 'init',
      session_id: 's',
      model: 'm',
      tools: [],
      mcp_servers: [],
      betas: ['context-1m-2025-01-01'],
    });
    expect((entries[0] as SystemEntry).betas).toEqual(['context-1m-2025-01-01']);
  });

  it('system/non-init -> []', () => {
    expect(parseMessage({ type: 'system', subtype: 'status' })).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// assistant
// ---------------------------------------------------------------------------

describe('parseMessage - assistant', () => {
  it('string content -> TextEntry', () => {
    const entries = parseMessage({
      type: 'assistant',
      message: { role: 'assistant', content: 'hello' },
    });
    expect(entries).toHaveLength(1);
    const e = entries[0] as TextEntry;
    expect(e.kind).toBe('text');
    expect(e.text).toBe('hello');
    expect(e.isStreaming).toBe(false);
  });

  it('text block -> TextEntry', () => {
    const entries = parseMessage({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'world' }] },
    });
    expect((entries[0] as TextEntry).text).toBe('world');
  });

  it('thinking block -> ThinkingEntry', () => {
    const entries = parseMessage({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'hmm' }] },
    });
    const e = entries[0] as ThinkingEntry;
    expect(e.kind).toBe('thinking');
    expect(e.text).toBe('hmm');
  });

  it('tool_use block -> ToolCallEntry + toolNameMap registration', () => {
    const entries = parseMessage({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu-1', name: 'bash', input: { cmd: 'ls' } }],
      },
    });
    const e = entries[0] as ToolCallEntry;
    expect(e.kind).toBe('tool_call');
    expect(e.toolName).toBe('bash');
    expect(e.toolUseId).toBe('tu-1');
    expect(e.input).toEqual({ cmd: 'ls' });
  });

  it('multiple mixed blocks -> all are parsed', () => {
    const entries = parseMessage({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'let me think' },
          { type: 'text', text: 'answer' },
          { type: 'tool_use', id: 'tu-x', name: 'read', input: {} },
        ],
      },
    });
    expect(entries).toHaveLength(3);
    expect(entries[0]!.kind).toBe('thinking');
    expect(entries[1]!.kind).toBe('text');
    expect(entries[2]!.kind).toBe('tool_call');
  });

  it('empty content array -> []', () => {
    const entries = parseMessage({
      type: 'assistant',
      message: { role: 'assistant', content: [] },
    });
    expect(entries).toHaveLength(0);
  });

  it('message undefined -> []', () => {
    const entries = parseMessage({ type: 'assistant' });
    expect(entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// user
// ---------------------------------------------------------------------------

describe('parseMessage - user', () => {
  it('tool_result (string content) -> ToolResultEntry', () => {
    // register tool_use first
    parseMessage({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu-2', name: 'bash', input: {} }],
      },
    });
    const entries = parseMessage({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu-2', content: 'result text' }],
      },
    });
    const e = entries[0] as ToolResultEntry;
    expect(e.kind).toBe('tool_result');
    expect(e.toolName).toBe('bash');
    expect(e.content).toBe('result text');
    expect(e.isError).toBe(false);
  });

  it('tool_result (array content) -> text concatenation', () => {
    parseMessage({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu-3', name: 'read', input: {} }],
      },
    });
    const entries = parseMessage({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu-3',
            content: [
              { type: 'text', text: 'line1' },
              { type: 'text', text: 'line2' },
            ],
          },
        ],
      },
    });
    expect((entries[0] as ToolResultEntry).content).toBe('line1\nline2');
  });

  it('tool_result is_error: true -> isError reflected', () => {
    parseMessage({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu-err', name: 'bash', input: {} }],
      },
    });
    const entries = parseMessage({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tu-err', content: 'error!', is_error: true },
        ],
      },
    });
    expect((entries[0] as ToolResultEntry).isError).toBe(true);
  });

  it('tool_result (unregistered ID) -> toolName: unknown', () => {
    const entries = parseMessage({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'unknown-id', content: 'data' }],
      },
    });
    expect((entries[0] as ToolResultEntry).toolName).toBe('unknown');
  });

  it('tool_use_result fallback (string)', () => {
    const entries = parseMessage({
      type: 'user',
      message: { role: 'user', content: [] },
      tool_use_result: 'fallback result',
    });
    const e = entries[0] as ToolResultEntry;
    expect(e.kind).toBe('tool_result');
    expect(e.content).toBe('fallback result');
    expect(e.toolName).toBe('unknown');
  });

  it('tool_use_result fallback (object) -> JSON stringified', () => {
    const entries = parseMessage({
      type: 'user',
      message: { role: 'user', content: [] },
      tool_use_result: { key: 'value' },
    });
    expect((entries[0] as ToolResultEntry).content).toBe(JSON.stringify({ key: 'value' }, null, 2));
  });

  it('isSynthetic=true -> []', () => {
    const entries = parseMessage({
      type: 'user',
      isSynthetic: true,
      message: { role: 'user', content: 'synthetic' },
    });
    expect(entries).toHaveLength(0);
  });

  it('non-synthetic text -> UserMessageEntry', () => {
    const entries = parseMessage({
      type: 'user',
      message: { role: 'user', content: 'hello user' },
    });
    const e = entries[0] as UserMessageEntry;
    expect(e.kind).toBe('user_message');
    expect(e.text).toBe('hello user');
  });

  it('isSynthetic=true + text in array content -> ignored', () => {
    const entries = parseMessage({
      type: 'user',
      isSynthetic: true,
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'should be ignored' }],
      },
    });
    expect(entries).toHaveLength(0);
  });

  it('message undefined -> []', () => {
    const entries = parseMessage({ type: 'user' });
    expect(entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// result
// ---------------------------------------------------------------------------

describe('parseMessage - result', () => {
  it('result -> ResultEntry (all fields)', () => {
    const entries = parseMessage({
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.05,
      num_turns: 3,
      duration_ms: 1000,
      is_error: false,
      result: 'done',
      errors: [],
    });
    const e = entries[0] as ResultEntry;
    expect(e.kind).toBe('result');
    expect(e.totalCostUsd).toBe(0.05);
    expect(e.numTurns).toBe(3);
    expect(e.durationMs).toBe(1000);
    expect(e.isError).toBe(false);
    expect(e.result).toBe('done');
    expect(e.errors).toEqual([]);
  });

  it('result -> default values are filled', () => {
    const entries = parseMessage({ type: 'result' });
    const e = entries[0] as ResultEntry;
    expect(e.subtype).toBe('unknown');
    expect(e.totalCostUsd).toBe(0);
    expect(e.numTurns).toBe(0);
    expect(e.durationMs).toBe(0);
    expect(e.isError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stream_event
// ---------------------------------------------------------------------------

describe('parseMessage - stream_event', () => {
  it('content_block_start text -> TextEntry(isStreaming:true)', () => {
    const entries = parseMessage({
      type: 'stream_event',
      event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    });
    const e = entries[0] as TextEntry;
    expect(e.kind).toBe('text');
    expect(e.isStreaming).toBe(true);
    expect(e.text).toBe('');
  });

  it('content_block_start thinking -> ThinkingEntry(isStreaming:true)', () => {
    const entries = parseMessage({
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'thinking', thinking: '' },
      },
    });
    const e = entries[0] as ThinkingEntry;
    expect(e.kind).toBe('thinking');
    expect(e.isStreaming).toBe(true);
  });

  it('content_block_start tool_use -> ToolCallEntry + toolNameMap registration', () => {
    const entries = parseMessage({
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 2,
        content_block: { type: 'tool_use', id: 'stream-tu-1', name: 'bash' },
      },
    });
    const e = entries[0] as ToolCallEntry;
    expect(e.kind).toBe('tool_call');
    expect(e.toolName).toBe('bash');
    expect(e.toolUseId).toBe('stream-tu-1');
    expect(e.input).toEqual({});

    // verify registration in toolNameMap (name is resolved via tool_result)
    const resultEntries = parseMessage({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'stream-tu-1', content: 'ok' }],
      },
    });
    expect((resultEntries[0] as ToolResultEntry).toolName).toBe('bash');
  });

  it('content_block_delta (text_delta) -> preserves existing ID', () => {
    const startEntries = parseMessage({
      type: 'stream_event',
      event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    });
    const startId = startEntries[0]!.id;
    const deltaEntries = parseMessage({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } },
    });
    expect(deltaEntries[0]!.id).toBe(startId);
    expect((deltaEntries[0] as TextEntry).text).toBe('hi');
    expect((deltaEntries[0] as TextEntry).isStreaming).toBe(true);
  });

  it('content_block_delta (thinking_delta) -> ThinkingEntry', () => {
    parseMessage({
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '' },
      },
    });
    const entries = parseMessage({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'hmm' },
      },
    });
    const e = entries[0] as ThinkingEntry;
    expect(e.kind).toBe('thinking');
    expect(e.text).toBe('hmm');
  });

  it('unknown index delta -> []', () => {
    const entries = parseMessage({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 99, delta: { type: 'text_delta', text: 'x' } },
    });
    expect(entries).toHaveLength(0);
  });

  it('content_block_stop -> []', () => {
    const entries = parseMessage({
      type: 'stream_event',
      event: { type: 'content_block_stop', index: 0 },
    });
    expect(entries).toHaveLength(0);
  });

  it('message_delta -> []', () => {
    const entries = parseMessage({
      type: 'stream_event',
      event: { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
    });
    expect(entries).toHaveLength(0);
  });

  it('message_start -> []', () => {
    const entries = parseMessage({
      type: 'stream_event',
      event: { type: 'message_start', message: { model: 'claude-3' } },
    });
    expect(entries).toHaveLength(0);
  });

  it('event undefined -> []', () => {
    const entries = parseMessage({ type: 'stream_event' });
    expect(entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// unknown / edge cases
// ---------------------------------------------------------------------------

describe('parseMessage - unknown', () => {
  it('unknown type -> []', () => {
    expect(parseMessage({ type: 'unknown_type' })).toHaveLength(0);
  });
});

describe('parseMessage - toolNameMap cleanup', () => {
  it('entry is deleted from toolNameMap after tool_result processing', () => {
    parseMessage({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu-cleanup', name: 'bash', input: {} }],
      },
    });
    // 1st call: name is resolved correctly
    const first = parseMessage({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu-cleanup', content: 'ok' }],
      },
    });
    expect((first[0] as ToolResultEntry).toolName).toBe('bash');

    // 2nd call: already deleted, so unknown
    const second = parseMessage({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu-cleanup', content: 'again' }],
      },
    });
    expect((second[0] as ToolResultEntry).toolName).toBe('unknown');
  });
});
