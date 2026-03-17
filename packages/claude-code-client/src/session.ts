import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import spawn from 'cross-spawn';
import { createInterface } from 'readline';
import { MessageParser } from './parser.js';
import type { ParsedEntry, ResultEntry, TextEntry } from './types.js';
import type { StreamJsonMessage } from './stream-types.js';

export type ExitReason = 'complete' | 'interrupted' | 'aborted' | 'error';

export interface ClaudeCodeSessionEvents {
  connect: [];
  entry: [entry: ParsedEntry];
  text: [text: string];
  raw: [raw: unknown];
  stderr: [line: string];
  error: [error: Error];
  end: [];
}

export class ClaudeCodeSession extends EventEmitter<ClaudeCodeSessionEvents> {
  private _sessionId = '';
  private _exitReason: ExitReason | null = null;
  private parser = new MessageParser();
  private proc: ChildProcess;
  private sendQueue: string[] = [];
  private connected = false;
  private lastResult: ResultEntry | undefined;
  private aborted = false;
  private interrupted = false;
  private settled = false;

  private doneResolve!: (entry: ResultEntry | undefined) => void;
  private doneReject!: (err: Error) => void;
  private readonly _done: Promise<ResultEntry | undefined>;

  get sessionId(): string {
    return this._sessionId;
  }

  get exitReason(): ExitReason | null {
    return this._exitReason;
  }

  constructor(
    args: string[],
    options: { cwd: string; env?: Record<string, string>; initialMessage: unknown },
  ) {
    super();

    this._done = new Promise<ResultEntry | undefined>((resolve, reject) => {
      this.doneResolve = resolve;
      this.doneReject = reject;
    });

    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });
    this.proc = proc;

    // Send initial stdin message immediately after spawn
    if (proc.stdin) {
      proc.stdin.write(JSON.stringify(options.initialMessage) + '\n');
    }

    // Emit connect and flush send queue on next tick so callers can register handlers first
    process.nextTick(() => {
      this.connected = true;
      this.emit('connect');
      // Emit raw for the initial message (for logging)
      this.emit('raw', options.initialMessage);
      // Flush any messages queued before connect
      for (const payload of this.sendQueue) {
        if (proc.stdin?.writable) {
          proc.stdin.write(payload);
        }
      }
      this.sendQueue = [];
    });

    // Parse stdout as NDJSON
    const rl = createInterface({ input: proc.stdout! });
    let stderrRl: ReturnType<typeof createInterface> | undefined;

    rl.on('line', (line) => {
      if (!line.trim()) return;

      let raw: StreamJsonMessage;
      try {
        raw = JSON.parse(line) as StreamJsonMessage;
      } catch {
        return;
      }

      if (raw.type === 'system' && raw.subtype === 'init' && raw.session_id) {
        this._sessionId = raw.session_id;
      }

      // Forward raw message (skip stream_events to match original behavior)
      if (raw.type !== 'stream_event') {
        this.emit('raw', raw);
      }

      const entries = this.parser.parse(raw);
      for (const entry of entries) {
        this.emit('entry', entry);
        switch (entry.kind) {
          case 'text':
            this.emit('text', (entry as TextEntry).text);
            break;
          case 'result':
            this.lastResult = entry as ResultEntry;
            break;
        }
      }

      // Close stdin on result so CLI exits naturally
      if (raw.type === 'result' && proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.end();
      }
    });

    if (proc.stderr) {
      stderrRl = createInterface({ input: proc.stderr });
      stderrRl.on('line', (line) => {
        this.emit('stderr', line);
      });
    }

    const closeReadlines = () => {
      rl.close();
      stderrRl?.close();
    };

    proc.on('error', (err) => {
      closeReadlines();
      this._exitReason = 'error';
      this.emit('error', err);
      this.emit('end');
      this.settleError(err);
    });

    proc.on('close', (code) => {
      closeReadlines();

      if (this.aborted) {
        this._exitReason = 'aborted';
      } else if (this.interrupted) {
        this._exitReason = 'interrupted';
      } else if (code !== 0 && code !== null) {
        this._exitReason = 'error';
        this.emit('error', new Error(`claude process exited with code ${code}`));
      } else {
        this._exitReason = 'complete';
      }

      this.emit('end');
      this.settleSuccess(this.lastResult);
    });
  }

  done(): Promise<ResultEntry | undefined> {
    return this._done;
  }

  send(text: string): void {
    const payload = {
      type: 'user',
      session_id: this._sessionId,
      message: { role: 'user', content: text },
    };
    this.emit('raw', payload);

    const serialized = JSON.stringify(payload) + '\n';
    if (!this.connected || !this.proc.stdin?.writable) {
      this.sendQueue.push(serialized);
      return;
    }
    this.proc.stdin.write(serialized);
  }

  interrupt(): void {
    if (this.aborted) return;
    this.interrupted = true;
    const signal = process.platform === 'win32' ? 'SIGTERM' : 'SIGINT';
    this.proc.kill(signal);
  }

  abort(): void {
    this.aborted = true;
    this.interrupted = false;
    this.proc.kill('SIGTERM');
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private settleSuccess(value?: ResultEntry): void {
    if (this.settled) return;
    this.settled = true;
    this.doneResolve(value);
  }

  private settleError(err: Error): void {
    if (this.settled) return;
    this.settled = true;
    this.doneReject(err);
  }
}
