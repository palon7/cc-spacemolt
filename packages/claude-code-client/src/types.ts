// ---------------------------------------------------------------------------
// Core entry types for Claude Code CLI output
// ---------------------------------------------------------------------------

export type EntryKind =
  | 'system'
  | 'thinking'
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'user_message'
  | 'result'
  | 'notification';

export interface BaseEntry {
  id: string;
  timestamp: string; // ISO string
  kind: EntryKind;
}

export interface SystemEntry extends BaseEntry {
  kind: 'system';
  sessionId: string;
  model: string;
  tools: string[];
  mcpServers: Array<{ name: string; status: string }>;
  betas?: string[];
}

export interface ThinkingEntry extends BaseEntry {
  kind: 'thinking';
  text: string;
  isStreaming: boolean;
}

export interface TextEntry extends BaseEntry {
  kind: 'text';
  text: string;
  isStreaming: boolean;
}

export interface ToolCallEntry extends BaseEntry {
  kind: 'tool_call';
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
}

export interface ToolResultEntry extends BaseEntry {
  kind: 'tool_result';
  toolUseId: string;
  toolName: string;
  content: string;
  isError: boolean;
}

export interface UserMessageEntry extends BaseEntry {
  kind: 'user_message';
  text: string;
}

export interface ResultEntry extends BaseEntry {
  kind: 'result';
  subtype: string;
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
  isError: boolean;
  result?: string;
  errors?: string[];
}

export interface NotificationEntry extends BaseEntry {
  kind: 'notification';
  text: string;
}

export type ParsedEntry =
  | SystemEntry
  | ThinkingEntry
  | TextEntry
  | ToolCallEntry
  | ToolResultEntry
  | UserMessageEntry
  | ResultEntry
  | NotificationEntry;
