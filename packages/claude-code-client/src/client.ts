import { ClaudeCodeSession } from './session.js';

export interface ClaudeCodeClientOptions {
  workspacePath: string;
  model?: string;
  appendSystemPrompt?: string;
  mcpConfig?: Record<string, unknown>;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'acceptEdits' | 'default' | 'bypassPermissions';
  bypassPermissions?: boolean;
  env?: Record<string, string>;
  extraArgs?: string[];
}

export class ClaudeCodeClient {
  private readonly baseArgs: string[];

  constructor(private readonly options: ClaudeCodeClientOptions) {
    this.baseArgs = this.buildArgs();
  }

  start(prompt: string): ClaudeCodeSession {
    return this.createSession(this.baseArgs, {
      type: 'user',
      message: { role: 'user', content: prompt },
    });
  }

  resume(sessionId: string, message?: string): ClaudeCodeSession {
    return this.createSession([...this.baseArgs, '--resume', sessionId], {
      type: 'user',
      session_id: sessionId,
      message: { role: 'user', content: message ?? 'Continue.' },
    });
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private createSession(args: string[], initialMessage: unknown): ClaudeCodeSession {
    return new ClaudeCodeSession(args, {
      cwd: this.options.workspacePath,
      env: this.options.env,
      initialMessage,
    });
  }

  private buildArgs(): string[] {
    const args: string[] = [
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--input-format',
      'stream-json',
      '--permission-mode',
      this.options.permissionMode ?? 'acceptEdits',
    ];

    if (this.options.appendSystemPrompt) {
      args.push('--append-system-prompt', this.options.appendSystemPrompt);
    }

    if (this.options.mcpConfig && Object.keys(this.options.mcpConfig).length > 0) {
      args.push('--mcp-config', JSON.stringify({ mcpServers: this.options.mcpConfig }));
    }

    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    if (this.options.bypassPermissions) {
      args.push('--dangerously-skip-permissions');
    } else {
      const allowed = this.options.allowedTools ?? [];
      if (allowed.length > 0) {
        args.push('--allowedTools', allowed.join(','));
      }
    }

    const disallowed = this.options.disallowedTools ?? ['AskUserQuestion'];
    if (disallowed.length > 0) {
      args.push('--disallowedTools', disallowed.join(','));
    }

    if (this.options.extraArgs?.length) {
      args.push(...this.options.extraArgs);
    }

    return args;
  }
}
