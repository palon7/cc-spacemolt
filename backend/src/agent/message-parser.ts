import type {
  ParsedEntry,
  SystemEntry,
  ThinkingEntry,
  TextEntry,
  ToolCallEntry,
  ToolResultEntry,
  UserMessageEntry,
  ResultEntry,
} from '../state/types.js';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Stream-JSON message types (self-contained, no SDK dependency)
// ---------------------------------------------------------------------------

interface ContentBlockText {
  type: 'text';
  text: string;
}

interface ContentBlockThinking {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

interface ContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  caller?: unknown;
}

interface ContentBlockToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | Array<{ type: string; text?: string; tool_name?: string }>;
  is_error?: boolean;
}

type ContentBlock =
  | ContentBlockText
  | ContentBlockThinking
  | ContentBlockToolUse
  | ContentBlockToolResult;

interface AssistantMessage {
  role: 'assistant';
  content: string | ContentBlock[];
  usage?: { input_tokens?: number; output_tokens?: number; [key: string]: unknown };
  [key: string]: unknown;
}

interface UserMessage {
  role: 'user';
  content: string | ContentBlock[];
  [key: string]: unknown;
}

/** A single line from `--output-format stream-json` */
export interface StreamJsonMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  uuid?: string;

  // system init fields
  model?: string;
  tools?: string[];
  mcp_servers?: Array<{ name: string; status: string }>;
  betas?: string[];
  permissionMode?: string;

  // assistant / user
  message?: AssistantMessage | UserMessage;
  parent_tool_use_id?: string | null;

  // stream_event
  event?: StreamEventPayload;

  // result
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  is_error?: boolean;
  result?: string;
  errors?: string[];
  usage?: Record<string, unknown>;

  // user message extras
  isSynthetic?: boolean;
  tool_use_result?: unknown;

  // status
  status?: string | null;

  // catch-all
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Stream event sub-types
// ---------------------------------------------------------------------------

interface StreamContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block: {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    text?: string;
    thinking?: string;
  };
}

interface StreamContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
  };
}

interface StreamContentBlockStop {
  type: 'content_block_stop';
  index: number;
}

interface StreamMessageDelta {
  type: 'message_delta';
  delta: { stop_reason?: string; [key: string]: unknown };
  usage?: { input_tokens?: number; output_tokens?: number; [key: string]: unknown };
  context_management?: unknown;
}

interface StreamMessageStart {
  type: 'message_start';
  message: {
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number; [key: string]: unknown };
    [key: string]: unknown;
  };
}

interface StreamMessageStop {
  type: 'message_stop';
}

type StreamEventPayload =
  | StreamContentBlockStart
  | StreamContentBlockDelta
  | StreamContentBlockStop
  | StreamMessageDelta
  | StreamMessageStart
  | StreamMessageStop;

// ---------------------------------------------------------------------------
// Parser state
// ---------------------------------------------------------------------------

// Track tool_use_id -> toolName for matching results
const toolNameMap = new Map<string, string>();

// Track streaming block index -> entry ID for partial message updates
const streamingBlockMap = new Map<number, string>();

export function resetStreamingState(): void {
  streamingBlockMap.clear();
}

export function resetParserState(): void {
  toolNameMap.clear();
  streamingBlockMap.clear();
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseMessage(message: StreamJsonMessage): ParsedEntry[] {
  switch (message.type) {
    case 'system':
      return parseSystemMessage(message);
    case 'assistant':
      return parseAssistantMessage(message, toolNameMap);
    case 'user':
      return parseUserMessage(message, toolNameMap);
    case 'result':
      return parseResultMessage(message);
    case 'stream_event':
      return parseStreamEvent(message);
    default:
      return [];
  }
}

/**
 * Create an isolated parser for replaying raw.jsonl files.
 * Uses its own toolNameMap so it doesn't interfere with the live parser.
 */
export function createReplayParser(): (message: StreamJsonMessage) => ParsedEntry[] {
  const localToolNameMap = new Map<string, string>();
  return (message: StreamJsonMessage): ParsedEntry[] => {
    switch (message.type) {
      case 'system':
        return parseSystemMessage(message);
      case 'assistant':
        return parseAssistantMessage(message, localToolNameMap);
      case 'user':
        return parseUserMessage(message, localToolNameMap);
      case 'result':
        return parseResultMessage(message);
      default:
        return [];
    }
  };
}

// ---------------------------------------------------------------------------
// Message type handlers
// ---------------------------------------------------------------------------

function parseSystemMessage(message: StreamJsonMessage): ParsedEntry[] {
  if (message.subtype !== 'init') return [];

  const entry: SystemEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    kind: 'system',
    sessionId: message.session_id ?? '',
    model: message.model ?? 'unknown',
    tools: message.tools ?? [],
    mcpServers: message.mcp_servers ?? [],
    betas: message.betas,
  };
  return [entry];
}

function parseAssistantMessage(
  message: StreamJsonMessage,
  nameMap: Map<string, string>,
): ParsedEntry[] {
  resetStreamingState();
  const entries: ParsedEntry[] = [];
  const msg = message.message as AssistantMessage | undefined;
  if (!msg) return entries;

  const content = msg.content;

  if (typeof content === 'string') {
    entries.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      kind: 'text',
      text: content,
      isStreaming: false,
    } satisfies TextEntry);
    return entries;
  }

  for (const block of content) {
    if (block.type === 'text') {
      entries.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        kind: 'text',
        text: (block as ContentBlockText).text,
        isStreaming: false,
      } satisfies TextEntry);
    } else if (block.type === 'thinking') {
      entries.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        kind: 'thinking',
        text: (block as ContentBlockThinking).thinking ?? '',
        isStreaming: false,
      } satisfies ThinkingEntry);
    } else if (block.type === 'tool_use') {
      const tu = block as ContentBlockToolUse;
      nameMap.set(tu.id, tu.name);
      entries.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        kind: 'tool_call',
        toolName: tu.name,
        toolUseId: tu.id,
        input: tu.input as Record<string, unknown>,
      } satisfies ToolCallEntry);
    }
  }

  return entries;
}

function parseUserMessage(message: StreamJsonMessage, nameMap: Map<string, string>): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const msg = message.message as UserMessage | undefined;
  if (!msg) return entries;

  const content = msg.content;

  if (typeof content === 'string') {
    if (!message.isSynthetic) {
      entries.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        kind: 'user_message',
        text: content,
      } satisfies UserMessageEntry);
    }
    return entries;
  }

  if (!Array.isArray(content)) return entries;

  for (const block of content) {
    if (block.type === 'tool_result') {
      const tr = block as ContentBlockToolResult;
      const toolUseId = tr.tool_use_id;
      const toolName = nameMap.get(toolUseId) ?? 'unknown';
      const resultContent =
        typeof tr.content === 'string'
          ? tr.content
          : Array.isArray(tr.content)
            ? tr.content
                .map((c) => (c.type === 'text' ? c.text : ''))
                .filter(Boolean)
                .join('\n')
            : '';

      entries.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        kind: 'tool_result',
        toolUseId,
        toolName,
        content: resultContent,
        isError: tr.is_error === true,
      } satisfies ToolResultEntry);
      // Delete the entry after tool_result processing to prevent memory leaks
      nameMap.delete(toolUseId);
    } else if (block.type === 'text') {
      if (!message.isSynthetic) {
        entries.push({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          kind: 'user_message',
          text: (block as ContentBlockText).text,
        } satisfies UserMessageEntry);
      }
    }
  }

  // Fallback: tool_use_result at message level
  if (message.tool_use_result && entries.length === 0) {
    entries.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      kind: 'tool_result',
      toolUseId: '',
      toolName: 'unknown',
      content:
        typeof message.tool_use_result === 'string'
          ? message.tool_use_result
          : JSON.stringify(message.tool_use_result, null, 2),
      isError: false,
    } satisfies ToolResultEntry);
  }

  return entries;
}

function parseResultMessage(message: StreamJsonMessage): ParsedEntry[] {
  const entry: ResultEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    kind: 'result',
    subtype: message.subtype ?? 'unknown',
    totalCostUsd: message.total_cost_usd ?? 0,
    numTurns: message.num_turns ?? 0,
    durationMs: message.duration_ms ?? 0,
    isError: message.is_error ?? false,
    result: message.result,
    errors: message.errors,
  };
  return [entry];
}

function parseStreamEvent(message: StreamJsonMessage): ParsedEntry[] {
  const event = message.event;
  if (!event) return [];

  if (event.type === 'content_block_start') {
    const e = event as StreamContentBlockStart;
    const block = e.content_block;
    const entryId = randomUUID();
    streamingBlockMap.set(e.index, entryId);

    if (block.type === 'text') {
      return [
        {
          id: entryId,
          timestamp: new Date().toISOString(),
          kind: 'text',
          text: block.text ?? '',
          isStreaming: true,
        } satisfies TextEntry,
      ];
    } else if (block.type === 'thinking') {
      return [
        {
          id: entryId,
          timestamp: new Date().toISOString(),
          kind: 'thinking',
          text: block.thinking ?? '',
          isStreaming: true,
        } satisfies ThinkingEntry,
      ];
    } else if (block.type === 'tool_use') {
      if (block.id && block.name) {
        toolNameMap.set(block.id, block.name);
      }
      return [
        {
          id: entryId,
          timestamp: new Date().toISOString(),
          kind: 'tool_call',
          toolName: block.name ?? 'unknown',
          toolUseId: block.id ?? '',
          input: {},
        } satisfies ToolCallEntry,
      ];
    }
  } else if (event.type === 'content_block_delta') {
    const e = event as StreamContentBlockDelta;
    const existingId = streamingBlockMap.get(e.index);
    if (!existingId) return [];

    const delta = e.delta;
    if (delta.type === 'text_delta' && delta.text) {
      return [
        {
          id: existingId,
          timestamp: new Date().toISOString(),
          kind: 'text',
          text: delta.text,
          isStreaming: true,
        } satisfies TextEntry,
      ];
    } else if (delta.type === 'thinking_delta' && delta.thinking) {
      return [
        {
          id: existingId,
          timestamp: new Date().toISOString(),
          kind: 'thinking',
          text: delta.thinking,
          isStreaming: true,
        } satisfies ThinkingEntry,
      ];
    }
  }

  return [];
}
