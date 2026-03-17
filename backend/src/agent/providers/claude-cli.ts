import { ClaudeCodeClient } from 'claude-code-client';
import type { ClaudeCodeSession } from 'claude-code-client';
import type { AgentProvider, ProviderCallbacks } from '../provider.js';
import type { AppConfig } from '../../config.js';
import { debug } from '../../logger/debug-logger.js';

export interface ClaudeCliOptions {
  config: AppConfig;
  bypassPermissions: boolean;
  workspacePath: string;
}

export class ClaudeCliProvider implements AgentProvider {
  readonly name = 'claude-cli';
  readonly supportsInput = true;

  private client: ClaudeCodeClient;
  private currentSession: ClaudeCodeSession | null = null;
  private resumeSessionId?: string;
  private _callbacks: ProviderCallbacks | null = null;
  private config: AppConfig;

  get sessionId(): string {
    return this.currentSession?.sessionId ?? '';
  }

  constructor(options: ClaudeCliOptions) {
    this.config = options.config;
    this.client = new ClaudeCodeClient({
      workspacePath: options.workspacePath,
      model: options.config.model,
      appendSystemPrompt: this.buildSystemPrompt(),
      mcpConfig: options.config.mcpServers as Record<string, unknown>,
      allowedTools: this.buildAllowedTools(),
      bypassPermissions: options.bypassPermissions,
      env: options.config.claudeEnv,
      extraArgs: options.config.claudeArgs,
    });
  }

  async start(callbacks: ProviderCallbacks, initialPrompt?: string): Promise<void> {
    debug('provider', 'start() called');
    this._callbacks = callbacks;

    const isNew = !this.resumeSessionId;
    const session = this.resumeSessionId
      ? this.client.resume(this.resumeSessionId, initialPrompt)
      : this.client.start(initialPrompt ?? this.config.initialPrompt ?? '');
    this.resumeSessionId = undefined;
    this.currentSession = session;

    debug('provider', `session created, isNew=${isNew}`);

    session.on('entry', (entry) => callbacks.onMessage(entry));
    session.on('raw', (raw) => callbacks.onRawMessage(raw));
    session.on('error', (err) => callbacks.onError(err));
    session.on('stderr', (line) => {
      debug('provider', `stderr: ${line}`);
      callbacks.onStderr?.(line);
    });

    // Notify about explicit user input (initial prompt for new sessions only)
    if (isNew) {
      const text = initialPrompt ?? this.config.initialPrompt ?? '';
      if (text) {
        process.nextTick(() => callbacks.onUserInput?.(text));
      }
    }

    await session.done();
  }

  sendMessage(text: string): void {
    this.currentSession?.send(text);
    this._callbacks?.onUserInput?.(text);
  }

  interrupt(): void {
    if (!this.currentSession) return;
    this.resumeSessionId = this.currentSession.sessionId;
    this.currentSession.interrupt();
  }

  abort(): void {
    this.currentSession?.abort();
    this.currentSession = null;
    this.resumeSessionId = undefined;
  }

  setResumeSessionId(sessionId: string): void {
    this.resumeSessionId = sessionId;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private buildSystemPrompt(): string | undefined {
    const parts: string[] = [];
    if (this.config.language) {
      parts.push(
        `Communicate with the user and write all local records in ${this.config.language}. Use english only for spacemolt in-game.`,
      );
    }
    if (this.config.systemPromptAppend) {
      parts.push(this.config.systemPromptAppend);
    }
    if (parts.length === 0) return undefined;
    // Windows cmd.exe cannot handle newlines in command arguments; use space as separator
    const sep = process.platform === 'win32' ? ' ' : '\n';
    return parts.join(sep);
  }

  private buildAllowedTools(): string[] {
    const tools: string[] = [];

    for (const tool of this.config.permissions.autoAllowTools) {
      tools.push(tool);
    }

    for (const prefix of this.config.permissions.allowedMcpPrefixes) {
      tools.push(`${prefix}*`);
    }

    if (this.config.permissions.allowedWebDomains.length > 0) {
      for (const domain of this.config.permissions.allowedWebDomains) {
        tools.push(`WebFetch(domain:${domain})`);
      }
      tools.push('WebSearch');
    }

    return tools;
  }
}
