import spawn from 'cross-spawn';
import type { ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import type { AgentProvider, ProviderCallbacks } from '../provider.js';
import { parseMessage, resetParserState } from '../message-parser.js';
import type { StreamJsonMessage } from '../message-parser.js';
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

  private _sessionId = '';
  private process: ChildProcess | null = null;
  private callbacks: ProviderCallbacks | null = null;
  private config: AppConfig;
  private bypassPermissions: boolean;
  private workspacePath: string;
  private isResuming = false;
  private aborted = false;
  private initialPromptOverride?: string;
  private resumeSessionId?: string;

  get sessionId(): string {
    return this._sessionId;
  }

  constructor(options: ClaudeCliOptions) {
    this.config = options.config;
    this.bypassPermissions = options.bypassPermissions;
    this.workspacePath = options.workspacePath;
  }

  async start(callbacks: ProviderCallbacks, initialPrompt?: string): Promise<void> {
    debug('provider', 'start() called');
    this.callbacks = callbacks;
    this.aborted = false;
    this.initialPromptOverride = initialPrompt;

    const resuming = this.isResuming;
    this.isResuming = false;

    // Reset full parser state (toolNameMap + streamingBlockMap) on every session start
    // to prevent stale entries from leaking across sessions.
    resetParserState();

    debug('provider', `runProcess(resuming=${resuming})`);
    await this.runProcess(resuming);
  }

  sendMessage(text: string): void {
    if (!this.process?.stdin || !this.process.stdin.writable) return;

    const rawPayload = {
      type: 'user' as const,
      session_id: this._sessionId,
      message: { role: 'user', content: text },
    };

    this.process.stdin.write(JSON.stringify(rawPayload) + '\n');
    this.callbacks?.onRawMessage(rawPayload);
    this.callbacks?.onUserInput?.(text);
  }

  interrupt(): void {
    if (!this.process || this.aborted) return;
    this.isResuming = true;
    // On Windows, SIGINT is not supported for child processes; use SIGTERM instead.
    // This terminates the process rather than just interrupting it, but the
    // resume flow still works since isResuming is set to true.
    const signal = process.platform === 'win32' ? 'SIGTERM' : 'SIGINT';
    this.process.kill(signal);
  }

  abort(): void {
    this.aborted = true;
    this.isResuming = false;
    this.resumeSessionId = undefined;
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  setResumeSessionId(sessionId: string): void {
    this.resumeSessionId = sessionId;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private buildArgs(resuming: boolean): string[] {
    const args: string[] = [
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--input-format',
      'stream-json',
      '--permission-mode',
      'acceptEdits',
    ];

    // System prompt
    const systemPromptParts: string[] = [];
    if (this.config.language) {
      systemPromptParts.push(
        `Communicate with the user and write all local records in ${this.config.language}. Use english only for spacemolt in-game.`,
      );
    }
    if (this.config.systemPromptAppend) {
      systemPromptParts.push(this.config.systemPromptAppend);
    }
    if (systemPromptParts.length > 0) {
      // Windows cmd.exe cannot handle newlines in command arguments; use space as separator
      const sep = process.platform === 'win32' ? ' ' : '\n';
      args.push('--append-system-prompt', systemPromptParts.join(sep));
    }

    // MCP config
    if (Object.keys(this.config.mcpServers).length > 0) {
      args.push('--mcp-config', JSON.stringify({ mcpServers: this.config.mcpServers }));
    }

    // Model
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // Permissions
    if (this.bypassPermissions) {
      args.push('--dangerously-skip-permissions');
    } else {
      const allowedTools = this.buildAllowedTools();
      if (allowedTools.length > 0) {
        args.push('--allowedTools', allowedTools.join(','));
      }
    }

    // Disallowed tools
    args.push('--disallowedTools', 'AskUserQuestion');

    // Resume
    const resumeId = resuming ? this._sessionId : this.resumeSessionId;
    if (resumeId) {
      args.push('--resume', resumeId);
    }

    return args;
  }

  private buildAllowedTools(): string[] {
    const tools: string[] = [];

    // Auto-allowed built-in tools
    for (const tool of this.config.permissions.autoAllowTools) {
      tools.push(tool);
    }

    // MCP prefixes -> wildcard patterns
    for (const prefix of this.config.permissions.allowedMcpPrefixes) {
      tools.push(`${prefix}*`);
    }

    // Web domains — allow WebFetch and WebSearch for configured domains
    if (this.config.permissions.allowedWebDomains.length > 0) {
      for (const domain of this.config.permissions.allowedWebDomains) {
        tools.push(`WebFetch(domain:${domain})`);
      }
      tools.push('WebSearch');
    }

    return tools;
  }

  private runProcess(resuming: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const args = this.buildArgs(resuming);

      const cwd = this.workspacePath;
      debug('provider', 'Spawning: claude with args:', args);
      debug('provider', 'CWD:', cwd);
      const proc = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd,
        env: { ...process.env },
      });
      this.process = proc;
      debug('provider', `Process spawned, pid=${proc.pid}`);

      // Send message via stdin — CLI always blocks waiting for stdin with --input-format stream-json
      const resumeId = resuming ? this._sessionId : this.resumeSessionId;
      if (proc.stdin) {
        const text =
          this.initialPromptOverride || (resumeId ? 'Continue.' : this.config.initialPrompt);
        const rawPayload = {
          type: 'user' as const,
          ...(resumeId ? { session_id: resumeId } : {}),
          message: { role: 'user', content: text },
        };
        debug(
          'provider',
          `Sending stdin message (resume=${!!resumeId}): ${JSON.stringify(rawPayload).slice(0, 200)}`,
        );
        proc.stdin.write(JSON.stringify(rawPayload) + '\n');

        // Log and notify — the CLI does not echo stdin back in its output
        this.callbacks?.onRawMessage(rawPayload);
        const isExplicitUserInput = !!this.initialPromptOverride || !resumeId;
        if (isExplicitUserInput && text) {
          this.callbacks?.onUserInput?.(text);
        }
      }

      // Parse stdout as NDJSON
      const rl = createInterface({ input: proc.stdout! });
      let stderrRl: ReturnType<typeof createInterface> | undefined;

      rl.on('line', (line) => {
        if (!line.trim()) return;

        let raw: StreamJsonMessage;
        try {
          raw = JSON.parse(line) as StreamJsonMessage;
        } catch {
          debug('provider', 'Failed to parse stdout line:', line.slice(0, 200));
          return; // Skip malformed lines
        }

        // Track session ID from init message
        if (raw.type === 'system' && raw.subtype === 'init' && raw.session_id) {
          this._sessionId = raw.session_id;
          debug('provider', `Session ID: ${raw.session_id}`);
        }

        // Forward raw message for logging (skip stream_events to match original behavior)
        if (raw.type !== 'stream_event') {
          this.callbacks?.onRawMessage(raw);
        }

        // Parse and forward to UI
        const entries = parseMessage(raw);
        for (const entry of entries) {
          this.callbacks?.onMessage(entry);
        }

        // Close stdin on result message so CLI can exit naturally
        if (raw.type === 'result' && proc.stdin && !proc.stdin.destroyed) {
          debug('provider', 'Result received, closing stdin');
          proc.stdin.end();
        }
      });

      // Collect stderr
      if (proc.stderr) {
        stderrRl = createInterface({ input: proc.stderr });
        stderrRl.on('line', (line) => {
          debug('provider', `stderr: ${line}`);
          this.callbacks?.onStderr?.(line);
        });
      }

      proc.on('error', (err) => {
        debug('provider', `Process error: ${err.message}`);
        this.process = null;
        rl.close();
        stderrRl?.close();
        reject(err);
      });

      proc.on('close', (code) => {
        debug(
          'provider',
          `Process closed with code=${code}, aborted=${this.aborted}, isResuming=${this.isResuming}`,
        );
        this.process = null;
        rl.close();
        stderrRl?.close();

        if (this.aborted || this.isResuming) {
          resolve();
          return;
        }

        if (code !== 0 && code !== null) {
          this.callbacks?.onError(new Error(`claude process exited with code ${code}`));
        }

        resolve();
      });
    });
  }
}
