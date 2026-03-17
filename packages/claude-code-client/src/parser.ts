import { randomUUID } from 'crypto';
import type {
  ParsedEntry,
  SystemEntry,
  ThinkingEntry,
  TextEntry,
  ToolCallEntry,
  ToolResultEntry,
  UserMessageEntry,
  ResultEntry,
} from './types.js';
import type { StreamJsonMessage, AssistantMessage, UserMessage } from './stream-types.js';

/**
 * Stateful parser for stream-json messages.
 * Each ClaudeCodeSession owns its own instance — no global state.
 */
export class MessageParser {
  private toolNameMap = new Map<string, string>();
  private streamingBlockMap = new Map<number, string>();

  parse(message: StreamJsonMessage): ParsedEntry[] {
    switch (message.type) {
      case 'system':
        return this.parseSystem(message);
      case 'assistant':
        return this.parseAssistant(message);
      case 'user':
        return this.parseUser(message);
      case 'result':
        return this.parseResult(message);
      case 'stream_event':
        return this.parseStreamEvent(message);
      default:
        return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Private handlers
  // ---------------------------------------------------------------------------

  private parseSystem(message: StreamJsonMessage): ParsedEntry[] {
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

  private parseAssistant(message: StreamJsonMessage): ParsedEntry[] {
    this.streamingBlockMap.clear();
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
          text: block.text,
          isStreaming: false,
        } satisfies TextEntry);
      } else if (block.type === 'thinking') {
        entries.push({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          kind: 'thinking',
          text: block.thinking ?? '',
          isStreaming: false,
        } satisfies ThinkingEntry);
      } else if (block.type === 'tool_use') {
        this.toolNameMap.set(block.id, block.name);
        entries.push({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          kind: 'tool_call',
          toolName: block.name,
          toolUseId: block.id,
          input: block.input,
        } satisfies ToolCallEntry);
      }
    }

    return entries;
  }

  private parseUser(message: StreamJsonMessage): ParsedEntry[] {
    const entries: ParsedEntry[] = [];
    const msg = message.message as UserMessage | undefined;
    if (!msg) return entries;

    const content = msg.content;
    const isUserVisible = !message.isSynthetic && !message.parent_tool_use_id;

    if (typeof content === 'string') {
      if (isUserVisible) {
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
        const toolUseId = block.tool_use_id;
        const toolName = this.toolNameMap.get(toolUseId) ?? 'unknown';
        const resultContent =
          typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content
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
          isError: block.is_error === true,
        } satisfies ToolResultEntry);
        this.toolNameMap.delete(toolUseId);
      } else if (block.type === 'text' && isUserVisible) {
        entries.push({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          kind: 'user_message',
          text: block.text,
        } satisfies UserMessageEntry);
      }
    }

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

  private parseResult(message: StreamJsonMessage): ParsedEntry[] {
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

  private parseStreamEvent(message: StreamJsonMessage): ParsedEntry[] {
    const event = message.event;
    if (!event) return [];

    if (event.type === 'content_block_start') {
      const block = event.content_block;
      const entryId = randomUUID();
      this.streamingBlockMap.set(event.index, entryId);

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
          this.toolNameMap.set(block.id, block.name);
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
      const existingId = this.streamingBlockMap.get(event.index);
      if (!existingId) return [];

      const delta = event.delta;
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
}
