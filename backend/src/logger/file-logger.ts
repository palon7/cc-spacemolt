import fs from 'fs';
import path from 'path';

export class FileLogger {
  private rawStream: fs.WriteStream | null = null;
  private buffer: unknown[] = [];
  private initialized = false;

  initialize(sessionId: string, logDir: string): void {
    const dir = path.join(logDir, sessionId);
    fs.mkdirSync(dir, { recursive: true });

    this.rawStream = fs.createWriteStream(path.join(dir, 'raw.jsonl'), { flags: 'a' });
    this.initialized = true;

    for (const msg of this.buffer) {
      this.logRaw(msg);
    }
    this.buffer = [];
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

  close(): void {
    this.rawStream?.end();
    this.rawStream = null;
    this.initialized = false;
  }
}
