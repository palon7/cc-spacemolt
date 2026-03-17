// ---------------------------------------------------------------------------
// Stream-JSON message types from `--output-format stream-json`
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

export type ContentBlock =
  | ContentBlockText
  | ContentBlockThinking
  | ContentBlockToolUse
  | ContentBlockToolResult;

export interface AssistantMessage {
  role: 'assistant';
  content: string | ContentBlock[];
  usage?: { input_tokens?: number; output_tokens?: number; [key: string]: unknown };
  [key: string]: unknown;
}

export interface UserMessage {
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

export type StreamEventPayload =
  | StreamContentBlockStart
  | StreamContentBlockDelta
  | StreamContentBlockStop
  | StreamMessageDelta
  | StreamMessageStart
  | StreamMessageStop;
