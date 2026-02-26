import type { AgentProvider, ProviderCallbacks } from '../agent/provider.js';
import type { StreamJsonMessage } from '../agent/message-parser.js';
import { FileLogger } from '../logger/file-logger.js';
import { debug } from '../logger/debug-logger.js';
import { getContextWindow } from '../utils/context-window.js';
import { replaySession } from './session-history.js';
import type {
  ParsedEntry,
  AgentStatus,
  SessionMeta,
  AutoResumeState,
  RuntimeSettings,
} from '../state/types.js';
import type { AutoResumeConfig } from '../config.js';
import consola from 'consola';

export interface SessionManagerCallbacks {
  onEntry: (entry: ParsedEntry) => void;
  onMeta: (meta: SessionMeta) => void;
  onStatus: (status: AgentStatus) => void;
  onClearStreaming: () => void;
  onError: (message: string) => void;
  onSessionStarted?: (sessionId: string) => void;
  onSettingsChange?: (settings: RuntimeSettings) => void;
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

  // Auto-resume state
  private autoResumeConfig: AutoResumeConfig;
  private autoResumeEnabled: boolean;
  private autoResumeTimeoutMinutes: number;
  private autoResumeStartedAt: Date | null = null;
  private autoResumeStopping = false;
  private autoResumeTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private forceStopTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;

  get status(): AgentStatus {
    return this._status;
  }

  get currentMeta(): SessionMeta | null {
    return this.sessionMeta;
  }

  get currentEntries(): ParsedEntry[] {
    return this.entries;
  }

  constructor(
    provider: AgentProvider,
    maxLogEntries: number,
    logDir: string,
    autoResumeConfig: AutoResumeConfig,
  ) {
    this.provider = provider;
    this.maxLogEntries = maxLogEntries;
    this.logDir = logDir;
    this.autoResumeConfig = autoResumeConfig;
    this.autoResumeEnabled = autoResumeConfig.enabled;
    this.autoResumeTimeoutMinutes = autoResumeConfig.timeoutMinutes;
  }

  setCallbacks(callbacks: SessionManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  // ---------------------------------------------------------------------------
  // Auto-resume public API
  // ---------------------------------------------------------------------------

  getAutoResumeState(): AutoResumeState {
    return {
      enabled: this.autoResumeEnabled,
      timeoutMinutes: this.autoResumeTimeoutMinutes,
      startedAt: this.autoResumeStartedAt?.toISOString() ?? null,
      stopping: this.autoResumeStopping,
    };
  }

  getRuntimeSettings(): RuntimeSettings {
    return { autoResume: this.getAutoResumeState() };
  }

  setAutoResume(enabled: boolean, timeoutMinutes?: number): void {
    this.autoResumeEnabled = enabled;
    if (timeoutMinutes !== undefined) {
      this.autoResumeTimeoutMinutes = timeoutMinutes;
    }

    if (enabled) {
      if (!this.autoResumeStartedAt) {
        this.autoResumeStartedAt = new Date();
      }
      this.startTimeoutTimer();
      this.broadcastSettings();
      // If agent is already done, kick off auto-resume
      if (this._status === 'done') {
        this.scheduleAutoResume();
      }
    } else {
      this.clearAllAutoResumeTimers();
      this.autoResumeStartedAt = null;
      this.autoResumeStopping = false;
      this.broadcastSettings();
    }
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  async start(initialPrompt?: string): Promise<void> {
    this.setStatus('starting');
    debug('session-manager', 'Calling provider.start()');
    await this.runProvider(initialPrompt);
  }

  sendMessage(text: string): void {
    this.provider.sendMessage(text);
  }

  interrupt(): void {
    this.isResuming = true;
    this.clearAllAutoResumeTimers();
    this.provider.interrupt();
  }

  private addUserMessage(text: string): void {
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

    // Cancel pending auto-resume timer — manual action takes priority
    if (this.autoResumeTimer) {
      clearTimeout(this.autoResumeTimer);
      this.autoResumeTimer = null;
    }

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
    this.disableAutoResume();
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
    this.disableAutoResume();
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
      onUserInput: (text) => this.addUserMessage(text),
    };
    try {
      await this.provider.start(providerCallbacks, initialPrompt);
      if (this.isResuming) {
        this.setStatus('interrupted');
      } else {
        this.setStatus('done');
        this.scheduleAutoResume();
      }
    } catch (err) {
      debug('session-manager', `provider.start() rejected: ${err}`);
      consola.error('Session error:', err);
      if (this.isResuming) {
        this.setStatus('interrupted');
      } else {
        this.consecutiveErrors++;
        this.setStatus('done');
        this.scheduleAutoResume();
      }
    }
  }

  // Private handlers

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

    if (entry.kind === 'system') {
      debug('session-manager', `Received system entry, sessionId=${entry.sessionId}`);
      this.consecutiveErrors = 0;
      const prev = this.sessionMeta;
      this.sessionMeta = {
        sessionId: entry.sessionId,
        model: entry.model,
        tools: entry.tools,
        mcpServers: entry.mcpServers,
        // Preserve accumulated token/cost counts across resume so the context window gauge
        // doesn't jump back to zero while waiting for the first assistant response.
        totalCostUsd: prev?.totalCostUsd ?? 0,
        numTurns: prev?.numTurns ?? 0,
        inputTokens: prev?.inputTokens ?? 0,
        outputTokens: prev?.outputTokens ?? 0,
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
        msg.message as
          | {
              usage?: {
                input_tokens?: number;
                cache_creation_input_tokens?: number;
                cache_read_input_tokens?: number;
                output_tokens?: number;
              };
            }
          | undefined
      )?.usage;
      if (usage && this.sessionMeta) {
        const totalInputTokens =
          (usage.input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0);
        this.sessionMeta = {
          ...this.sessionMeta,
          inputTokens: totalInputTokens,
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

  // ---------------------------------------------------------------------------
  // Auto-resume internals
  // ---------------------------------------------------------------------------

  private scheduleAutoResume(): void {
    if (!this.autoResumeEnabled) return;

    // Timeout message was sent and agent completed gracefully
    if (this.autoResumeStopping) {
      if (this.forceStopTimer) {
        clearTimeout(this.forceStopTimer);
        this.forceStopTimer = null;
      }
      this.autoResumeStopping = false;
      this.autoResumeEnabled = false;
      this.autoResumeStartedAt = null;
      this.clearAllAutoResumeTimers();
      this.broadcastSettings();
      debug('auto-resume', 'Agent completed after timeout message — auto-resume disabled');
      return;
    }

    // Too many consecutive errors
    if (this.consecutiveErrors >= 3) {
      this.autoResumeEnabled = false;
      this.autoResumeStartedAt = null;
      this.clearAllAutoResumeTimers();
      this.broadcastSettings();
      debug('auto-resume', 'Disabled due to 3 consecutive errors');
      return;
    }

    // Timeout already exceeded (fallback for when timeoutTimer didn't fire mid-run)
    if (
      this.autoResumeTimeoutMinutes > 0 &&
      this.autoResumeStartedAt &&
      Date.now() - this.autoResumeStartedAt.getTime() >= this.autoResumeTimeoutMinutes * 60_000
    ) {
      this.autoResumeEnabled = false;
      this.autoResumeStartedAt = null;
      this.clearAllAutoResumeTimers();
      this.broadcastSettings();
      debug('auto-resume', 'Timeout exceeded at completion — auto-resume disabled');
      return;
    }

    // First auto-resume — start tracking time
    if (!this.autoResumeStartedAt) {
      this.autoResumeStartedAt = new Date();
      this.startTimeoutTimer();
      this.broadcastSettings();
    }

    debug('auto-resume', 'Scheduling auto-resume in 3 seconds');
    this.autoResumeTimer = setTimeout(() => {
      this.autoResumeTimer = null;
      debug('auto-resume', `Resuming with: "${this.autoResumeConfig.message}"`);
      this.resume(this.autoResumeConfig.message).catch((err) => {
        debug('auto-resume', `Resume failed: ${err}`);
      });
    }, 3000);
  }

  private startTimeoutTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    if (this.autoResumeTimeoutMinutes <= 0 || !this.autoResumeStartedAt) return;

    const remaining =
      this.autoResumeStartedAt.getTime() + this.autoResumeTimeoutMinutes * 60_000 - Date.now();

    if (remaining <= 0) {
      this.handleTimeout();
      return;
    }

    debug('auto-resume', `Timeout timer set for ${Math.round(remaining / 1000)}s`);
    this.timeoutTimer = setTimeout(() => {
      this.timeoutTimer = null;
      this.handleTimeout();
    }, remaining);
  }

  private handleTimeout(): void {
    // Cancel pending auto-resume
    if (this.autoResumeTimer) {
      clearTimeout(this.autoResumeTimer);
      this.autoResumeTimer = null;
    }

    if (this._status === 'running' || this._status === 'starting') {
      // Agent is executing — send timeout message directly
      this.autoResumeStopping = true;
      this.broadcastSettings();
      debug('auto-resume', 'Timeout reached — sending timeout message to running agent');
      this.sendMessage(this.autoResumeConfig.timeoutMessage);
      this.forceStopTimer = setTimeout(() => {
        this.forceStopTimer = null;
        this.handleForceStop();
      }, this.autoResumeConfig.forceStopDelaySeconds * 1000);
    } else {
      // Agent is already stopped — just disable auto-resume
      this.autoResumeEnabled = false;
      this.autoResumeStartedAt = null;
      this.broadcastSettings();
      debug('auto-resume', 'Timeout reached while agent not running — auto-resume disabled');
    }
  }

  private handleForceStop(): void {
    debug('auto-resume', 'Force-stopping agent after timeout grace period');
    this.autoResumeEnabled = false;
    this.autoResumeStopping = false;
    this.autoResumeStartedAt = null;
    this.clearAllAutoResumeTimers();
    this.broadcastSettings();
    this.interrupt();
  }

  private clearAllAutoResumeTimers(): void {
    if (this.autoResumeTimer) {
      clearTimeout(this.autoResumeTimer);
      this.autoResumeTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.forceStopTimer) {
      clearTimeout(this.forceStopTimer);
      this.forceStopTimer = null;
    }
  }

  private disableAutoResume(): void {
    this.clearAllAutoResumeTimers();
    this.autoResumeEnabled = false;
    this.autoResumeStopping = false;
    this.autoResumeStartedAt = null;
    this.broadcastSettings();
  }

  private broadcastSettings(): void {
    this.callbacks?.onSettingsChange?.(this.getRuntimeSettings());
  }
}
