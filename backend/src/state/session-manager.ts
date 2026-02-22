import type { AgentProvider, ProviderCallbacks } from '../agent/provider.js';
import type { StreamJsonMessage } from '../agent/message-parser.js';
import { FileLogger } from '../logger/file-logger.js';
import { debug } from '../logger/debug-logger.js';
import { getContextWindow } from '../utils/context-window.js';
import { replaySession } from './session-history.js';
import type { ParsedEntry, AgentStatus, SessionMeta } from '../state/types.js';
import consola from 'consola';

export interface SessionManagerCallbacks {
  onEntry: (entry: ParsedEntry) => void;
  onMeta: (meta: SessionMeta) => void;
  onStatus: (status: AgentStatus) => void;
  onClearStreaming: () => void;
  onError: (message: string) => void;
  onSessionStarted?: (sessionId: string) => void;
}

export class SessionManager {
  private provider: AgentProvider;
  private logger = new FileLogger();
  private logDir: string;
  private maxLogEntries: number;
  private entries: ParsedEntry[] = [];
  private sessionMeta: SessionMeta | null = null;
  private _status: AgentStatus = 'idle';
  private callbacks: SessionManagerCallbacks | null = null;
  private isResuming = false;

  get status(): AgentStatus {
    return this._status;
  }

  get currentMeta(): SessionMeta | null {
    return this.sessionMeta;
  }

  get currentEntries(): ParsedEntry[] {
    return this.entries;
  }

  constructor(provider: AgentProvider, maxLogEntries: number, logDir: string) {
    this.provider = provider;
    this.maxLogEntries = maxLogEntries;
    this.logDir = logDir;
  }

  setCallbacks(callbacks: SessionManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  async start(initialPrompt?: string): Promise<void> {
    this.setStatus('starting');
    debug('session-manager', 'Calling provider.start()');
    await this.runProvider(initialPrompt);
  }

  sendMessage(text: string): void {
    this.provider.sendMessage(text);
    this.addUserMessage(text);
  }

  interrupt(): void {
    this.isResuming = true;
    this.provider.interrupt();
  }

  addUserMessage(text: string): void {
    const entry: ParsedEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      kind: 'user_message',
      text,
    };
    this.addEntry(entry);
    this.callbacks?.onEntry(entry);
  }

  async resume(message?: string): Promise<void> {
    this.isResuming = false;

    // Ensure provider knows which session to resume
    const resumeId = this.sessionMeta?.sessionId || this.provider.sessionId;
    if (resumeId) {
      this.provider.setResumeSessionId?.(resumeId);
    }

    this.setStatus('starting');
    debug(
      'session-manager',
      `Resuming session ${resumeId ?? '(no id)'}${message ? ' with message' : ''}`,
    );
    // Pass message as initialPrompt so provider sends it via stdin on startup
    await this.runProvider(message);
  }

  abort(): void {
    this.provider.abort();
    this.logger.close();
  }

  async loadFromHistory(sessionId: string): Promise<void> {
    if (this._status === 'running' || this._status === 'starting') {
      throw new Error('Cannot load session while active');
    }

    // Reset current state
    this.reset();

    // Load entries from disk using isolated parser
    const { entries: loaded, meta: loadedMeta } = await replaySession(this.logDir, sessionId);

    // Populate meta
    if (loadedMeta) {
      this.sessionMeta = {
        ...loadedMeta,
        contextWindow: getContextWindow(loadedMeta.model, undefined),
        supportsInput: this.provider.supportsInput,
      };
      this.logger.initialize(sessionId, this.logDir);
      this.callbacks?.onMeta(this.sessionMeta);
    }

    // Populate entries and emit to clients
    this.entries = loaded;
    for (const entry of loaded) {
      this.callbacks?.onEntry(entry);
    }

    // Set resume target for when user sends a message
    this.provider.setResumeSessionId?.(sessionId);

    // Set status to done — user sees "Send a follow-up message..."
    this.setStatus('done');
  }

  reset(): void {
    // Always abort to clear provider state (resume target, flags, etc.)
    this.provider.abort();
    this.logger.close();
    this.entries = [];
    this.sessionMeta = null;
    this.isResuming = false;
    this.setStatus('idle');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async runProvider(initialPrompt?: string): Promise<void> {
    const providerCallbacks: ProviderCallbacks = {
      onMessage: (entry) => this.handleEntry(entry),
      onRawMessage: (raw) => this.handleRawMessage(raw),
      onError: (error) => this.handleError(error),
      onStderr: (data) => this.handleStderr(data),
    };
    try {
      await this.provider.start(providerCallbacks, initialPrompt);
      if (this.isResuming) {
        this.emitInterruptedEntry();
        this.setStatus('interrupted');
      } else {
        this.setStatus('done');
      }
    } catch (err) {
      debug('session-manager', `provider.start() rejected: ${err}`);
      consola.error('Session error:', err);
      if (this.isResuming) {
        this.emitInterruptedEntry();
        this.setStatus('interrupted');
      } else {
        this.setStatus('done');
      }
    }
  }

  private emitInterruptedEntry(): void {
    // Finalize any streaming entries (set isStreaming to false so UI stops showing spinner)
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i]!;
      if ((e.kind === 'text' || e.kind === 'thinking') && e.isStreaming) {
        const finalized = { ...e, isStreaming: false };
        this.entries[i] = finalized;
        this.callbacks?.onEntry(finalized);
      }
    }

    const entry: ParsedEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      kind: 'text',
      text: '[Session interrupted]',
      isStreaming: false,
    };
    this.addEntry(entry);
    this.callbacks?.onEntry(entry);
  }

  // ---------------------------------------------------------------------------
  // Private handlers
  // ---------------------------------------------------------------------------

  private handleEntry(entry: ParsedEntry): void {
    // Handle streaming deltas: append text to existing entries
    if ((entry.kind === 'text' || entry.kind === 'thinking') && entry.isStreaming) {
      const existingIndex = this.entries.findIndex((e) => e.id === entry.id);
      if (existingIndex >= 0) {
        const existing = this.entries[existingIndex]!;
        if (existing.kind === 'text' || existing.kind === 'thinking') {
          const updated = { ...existing, text: existing.text + entry.text };
          this.entries[existingIndex] = updated;
          // Send the accumulated entry to client
          this.callbacks?.onEntry(updated);
          return;
        }
      }
      this.addEntry(entry);
      this.callbacks?.onEntry(entry);
      return;
    }

    // Log parsed entries (non-streaming)
    this.logger.logParsed(entry);

    if (entry.kind === 'system') {
      debug('session-manager', `Received system entry, sessionId=${entry.sessionId}`);
      this.sessionMeta = {
        sessionId: entry.sessionId,
        model: entry.model,
        tools: entry.tools,
        mcpServers: entry.mcpServers,
        totalCostUsd: 0,
        numTurns: 0,
        inputTokens: 0,
        outputTokens: 0,
        isCompacting: false,
        contextWindow: getContextWindow(entry.model, entry.betas),
        supportsInput: this.provider.supportsInput,
      };
      this.logger.initialize(entry.sessionId, this.logDir);
      this.callbacks?.onSessionStarted?.(entry.sessionId);
      this.setStatus('running');
      this.callbacks?.onMeta(this.sessionMeta);
    }

    if (entry.kind === 'result') {
      if (this.sessionMeta) {
        this.sessionMeta = {
          ...this.sessionMeta,
          totalCostUsd: entry.totalCostUsd,
          numTurns: entry.numTurns,
        };
        this.callbacks?.onMeta(this.sessionMeta);
      }
      if (!this.isResuming) {
        this.setStatus('done');
      }
    }

    this.addEntry(entry);
    this.callbacks?.onEntry(entry);
  }

  private handleRawMessage(raw: unknown): void {
    this.logger.logRaw(raw);

    const msg = raw as StreamJsonMessage;
    if (msg.type === 'assistant') {
      // Complete assistant message arrived — clear all streaming entries
      // This fires BEFORE parseMessage generates the complete entries,
      // so the sequence is: clear_streaming -> complete entries
      this.clearStreamingEntries();

      const usage = (
        msg.message as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined
      )?.usage;
      if (usage && this.sessionMeta) {
        this.sessionMeta = {
          ...this.sessionMeta,
          ...(usage.input_tokens != null ? { inputTokens: usage.input_tokens } : {}),
          ...(usage.output_tokens != null ? { outputTokens: usage.output_tokens } : {}),
        };
        this.callbacks?.onMeta(this.sessionMeta);
      }
    }

    if (msg.type === 'system') {
      if (msg.subtype === 'status' && this.sessionMeta) {
        this.sessionMeta = { ...this.sessionMeta, isCompacting: msg.status === 'compacting' };
        this.callbacks?.onMeta(this.sessionMeta);
      }
      if (msg.subtype === 'compact_boundary' && this.sessionMeta) {
        this.sessionMeta = { ...this.sessionMeta, isCompacting: false };
        this.callbacks?.onMeta(this.sessionMeta);
      }
    }
  }

  private handleError(error: Error): void {
    this.setStatus('error');
    const entry: ParsedEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      kind: 'text',
      text: `Error: ${error.message}`,
      isStreaming: false,
    };
    this.addEntry(entry);
    this.callbacks?.onEntry(entry);
    this.callbacks?.onError(error.message);
  }

  private handleStderr(data: string): void {
    const trimmed = data.trim();
    if (!trimmed) return;
    const entry: ParsedEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      kind: 'text',
      text: `[stderr] ${trimmed}`,
      isStreaming: false,
    };
    this.addEntry(entry);
    this.callbacks?.onEntry(entry);
  }

  private clearStreamingEntries(): void {
    const hadStreaming = this.entries.some(
      (e) =>
        ((e.kind === 'text' || e.kind === 'thinking') && e.isStreaming) ||
        (e.kind === 'tool_call' && Object.keys(e.input).length === 0),
    );
    if (!hadStreaming) return;

    this.entries = this.entries.filter((e) => {
      if ((e.kind === 'text' || e.kind === 'thinking') && e.isStreaming) return false;
      // Tool calls from streaming have empty input
      if (e.kind === 'tool_call' && Object.keys(e.input).length === 0) return false;
      return true;
    });
    this.callbacks?.onClearStreaming();
  }

  private addEntry(entry: ParsedEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxLogEntries) {
      this.entries = this.entries.slice(this.entries.length - this.maxLogEntries);
    }
  }

  private setStatus(status: AgentStatus): void {
    this._status = status;
    this.callbacks?.onStatus(status);
  }
}
