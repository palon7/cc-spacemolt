import fs from 'fs';
import path from 'path';
import type { ParsedEntry } from '../state/types.js';
import { formatJson } from '../utils/format.js';

export class FileLogger {
  private rawStream: fs.WriteStream | null = null;
  private textStream: fs.WriteStream | null = null;
  private buffer: unknown[] = [];
  private parsedBuffer: ParsedEntry[] = [];
  private initialized = false;

  initialize(sessionId: string, logDir: string): void {
    const dir = path.join(logDir, sessionId);
    fs.mkdirSync(dir, { recursive: true });

    this.rawStream = fs.createWriteStream(path.join(dir, 'raw.jsonl'), { flags: 'a' });
    this.textStream = fs.createWriteStream(path.join(dir, 'session.log'), { flags: 'a' });
    this.initialized = true;

    // Flush buffered messages
    for (const msg of this.buffer) {
      this.logRaw(msg);
    }
    this.buffer = [];

    for (const entry of this.parsedBuffer) {
      this.logParsed(entry);
    }
    this.parsedBuffer = [];
  }

  logRaw(message: unknown): void {
    if (!this.initialized) {
      this.buffer.push(message);
      return;
    }
    try {
      this.rawStream?.write(JSON.stringify(message) + '\n');
    } catch {
      // Silently ignore serialization errors
    }
  }

  logParsed(entry: ParsedEntry): void {
    if (!this.initialized) {
      this.parsedBuffer.push(entry);
      return;
    }
    const timestamp = entry.timestamp;
    const line = formatEntryAsText(entry);
    this.textStream?.write(`[${timestamp}] ${line}\n`);
  }

  close(): void {
    this.rawStream?.end();
    this.textStream?.end();
    this.rawStream = null;
    this.textStream = null;
    this.initialized = false;
  }
}

function formatEntryAsText(entry: ParsedEntry): string {
  switch (entry.kind) {
    case 'system':
      return (
        `[SYSTEM] Session: ${entry.sessionId} | Model: ${entry.model}\n` +
        `  MCP Servers: ${entry.mcpServers.map((s: { name: string; status: string }) => `${s.name} (${s.status})`).join(', ')}\n` +
        `  Tools: ${entry.tools.join(', ')}`
      );
    case 'thinking':
      return `[THINKING] ${entry.text}`;
    case 'text':
      return `[TEXT] ${entry.text}`;
    case 'tool_call':
      return `[TOOL CALL] ${entry.toolName}\n  Input: ${formatJson(entry.input)}`;
    case 'tool_result':
      return `[TOOL RESULT] ${entry.toolName} ${entry.isError ? '(ERROR)' : '(OK)'}\n  ${entry.content.slice(0, 500)}`;
    case 'user_message':
      return `[USER] ${entry.text}`;
    case 'result':
      return (
        `[RESULT] ${entry.subtype} | Cost: $${entry.totalCostUsd.toFixed(4)} | ` +
        `Turns: ${entry.numTurns} | Duration: ${(entry.durationMs / 1000).toFixed(1)}s` +
        (entry.errors ? `\n  Errors: ${entry.errors.join(', ')}` : '')
      );
    default: {
      const _exhaustive: never = entry;
      return `[UNKNOWN] ${(_exhaustive as ParsedEntry).kind}`;
    }
  }
}
