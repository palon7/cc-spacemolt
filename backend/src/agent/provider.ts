import type { ParsedEntry } from '../state/types.js';

export interface ProviderCallbacks {
  /** Parsed entries for UI display */
  onMessage: (entry: ParsedEntry) => void;
  /** Raw JSON messages for logging */
  onRawMessage: (raw: unknown) => void;
  /** Fatal errors */
  onError: (error: Error) => void;
  /** stderr output from the underlying process */
  onStderr?: (data: string) => void;
}

/**
 * Abstraction over different AI CLI backends (Claude CLI, Codex CLI, Gemini CLI, etc.).
 *
 * Some CLIs only accept input once (the initial prompt) and then run autonomously.
 * Check `supportsInput` before attempting to send follow-up messages.
 */
export interface AgentProvider {
  readonly name: string;
  /** Whether this provider accepts follow-up messages after the initial prompt */
  readonly supportsInput: boolean;
  /** Session ID assigned after start (empty string until initialized) */
  readonly sessionId: string;

  /**
   * Start the agent. Resolves when the process exits normally.
   * Rejects (or calls onError) on fatal errors.
   */
  start(callbacks: ProviderCallbacks, initialPrompt?: string): Promise<void>;

  /** Send a follow-up message. No-op if supportsInput is false. */
  sendMessage(text: string): void;

  /** Interrupt current generation and prepare for resume */
  interrupt(): void;

  /** Fully stop the agent process */
  abort(): void;

  /** Set the session ID to resume on next start (optional, not all providers support it) */
  setResumeSessionId?(sessionId: string): void;
}
