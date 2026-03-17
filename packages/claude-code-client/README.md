# claude-code-client

A Node.js client for the [Claude Code CLI](https://claude.ai/code), modeled after the Anthropic SDK's `MessageStream` API.

Spawns `claude --output-format stream-json` as a subprocess, parses the NDJSON output, and exposes a typed `EventEmitter`-based session interface.

## Prerequisites

- Node.js >= 22
- [Claude Code CLI](https://claude.ai/code) installed and authenticated (`claude` command available in PATH)

## Installation

```sh
npm install claude-code-client
```

## Quick Start

```typescript
import { ClaudeCodeClient } from 'claude-code-client';

const client = new ClaudeCodeClient({ workspacePath: '/path/to/workspace' });

const session = client.start('What is 2 + 2?');
session.on('text', (chunk) => process.stdout.write(chunk));

const result = await session.done();
console.log(`\nCost: $${result?.totalCostUsd.toFixed(6)}`);
```

## API Reference

### `ClaudeCodeClient`

```typescript
class ClaudeCodeClient {
  constructor(options: ClaudeCodeClientOptions);

  /** Start a new session with the given prompt. */
  start(prompt: string): ClaudeCodeSession;

  /** Resume a previous session by ID. */
  resume(sessionId: string, message?: string): ClaudeCodeSession;
}
```

`start()` spawns the process immediately and returns the session synchronously. Register event listeners right after calling it — no events fire before the next tick.

### `ClaudeCodeClientOptions`

| Option               | Type                                                | Default               | Description                                     |
| -------------------- | --------------------------------------------------- | --------------------- | ----------------------------------------------- |
| `workspacePath`      | `string`                                            | —                     | Working directory for the Claude CLI process    |
| `model`              | `string`                                            | CLI default           | Model to use (e.g. `"claude-sonnet-4-6"`)       |
| `appendSystemPrompt` | `string`                                            | —                     | Text appended to the system prompt              |
| `mcpConfig`          | `Record<string, unknown>`                           | —                     | MCP server config passed as `--mcp-config`      |
| `allowedTools`       | `string[]`                                          | —                     | Tools Claude is allowed to use                  |
| `disallowedTools`    | `string[]`                                          | `['AskUserQuestion']` | Tools Claude is not allowed to use              |
| `permissionMode`     | `'acceptEdits' \| 'default' \| 'bypassPermissions'` | `'acceptEdits'`       | Permission mode                                 |
| `bypassPermissions`  | `boolean`                                           | `false`               | Pass `--dangerously-skip-permissions`           |
| `env`                | `Record<string, string>`                            | —                     | Extra environment variables for the CLI process |
| `extraArgs`          | `string[]`                                          | —                     | Additional CLI arguments (appended last)        |

### `ClaudeCodeSession`

```typescript
class ClaudeCodeSession extends EventEmitter<ClaudeCodeSessionEvents> {
  readonly sessionId: string; // Set after system/init received
  readonly exitReason: ExitReason | null; // Set after end event

  /** Resolves with the ResultEntry on completion, or undefined if interrupted/aborted. */
  done(): Promise<ResultEntry | undefined>;

  /** Send a follow-up message. Queued if called before connect fires. */
  send(text: string): void;

  /** Send SIGINT to interrupt generation (enables resume). */
  interrupt(): void;

  /** Send SIGTERM to fully stop the process. */
  abort(): void;
}

type ExitReason = 'complete' | 'interrupted' | 'aborted' | 'error';
```

### `ClaudeCodeSessionEvents`

| Event     | Payload       | Description                                                                                   |
| --------- | ------------- | --------------------------------------------------------------------------------------------- |
| `connect` | —             | Process started; stdin is ready                                                               |
| `entry`   | `ParsedEntry` | A fully parsed entry (see Entry Types below)                                                  |
| `text`    | `string`      | Text chunk shortcut — equivalent to `entry` filtered to `kind: 'text'`                        |
| `raw`     | `unknown`     | Raw JSON line from stdout (plus stdin messages for logging). `stream_event` lines are skipped |
| `stderr`  | `string`      | A line from stderr                                                                            |
| `error`   | `Error`       | Process error or non-zero exit                                                                |
| `end`     | —             | Process exited (fires after `error` if applicable)                                            |

### Entry Types (`ParsedEntry`)

All entries share `{ id: string, timestamp: string, kind: EntryKind }`.

| `kind`         | Additional fields                                                                    |
| -------------- | ------------------------------------------------------------------------------------ |
| `system`       | `sessionId`, `model`, `tools`, `mcpServers`, `betas?`                                |
| `text`         | `text: string`, `isStreaming: boolean`                                               |
| `thinking`     | `text: string`, `isStreaming: boolean`                                               |
| `tool_call`    | `toolName`, `toolUseId`, `input: Record<string, unknown>`                            |
| `tool_result`  | `toolUseId`, `toolName`, `content: string`, `isError: boolean`                       |
| `user_message` | `text: string`                                                                       |
| `result`       | `subtype`, `totalCostUsd`, `numTurns`, `durationMs`, `isError`, `result?`, `errors?` |
| `notification` | `text: string`                                                                       |

Streaming entries (`isStreaming: true`) arrive as incremental deltas. The same `id` is reused across deltas for the same block.

### `MessageParser`

Parses raw `StreamJsonMessage` objects into `ParsedEntry[]`. Each instance maintains its own state — create a fresh instance per parsing context.

```typescript
class MessageParser {
  parse(message: StreamJsonMessage): ParsedEntry[];
}
```

Useful for replaying saved `.jsonl` log files without spawning a process.

## Examples

### Stream text output

```typescript
import { ClaudeCodeClient } from 'claude-code-client';

const client = new ClaudeCodeClient({ workspacePath: process.cwd() });
const session = client.start('Write a haiku about the ocean.');

session.on('text', (chunk) => process.stdout.write(chunk));

await session.done();
console.log(); // newline
```

### Handle all entry types

```typescript
import { ClaudeCodeClient } from 'claude-code-client';
import type { ParsedEntry } from 'claude-code-client';

const client = new ClaudeCodeClient({ workspacePath: process.cwd() });
const session = client.start('List the files in the current directory.');

session.on('entry', (entry: ParsedEntry) => {
  switch (entry.kind) {
    case 'system':
      console.log(`[session] ${entry.sessionId} model=${entry.model}`);
      break;
    case 'text':
      if (!entry.isStreaming) process.stdout.write(entry.text);
      break;
    case 'tool_call':
      console.log(`\n[tool] ${entry.toolName}`, entry.input);
      break;
    case 'tool_result':
      console.log(`[result] ${entry.content.slice(0, 80)}...`);
      break;
    case 'result':
      console.log(`\n[done] ${entry.numTurns} turns — $${entry.totalCostUsd.toFixed(6)}`);
      break;
  }
});

await session.done();
```

### Interrupt and resume

```typescript
import { ClaudeCodeClient } from 'claude-code-client';

const client = new ClaudeCodeClient({ workspacePath: process.cwd() });
const session = client.start('Count from 1 to 100, one number per line.');

// Interrupt after 2 seconds
const timer = setTimeout(() => session.interrupt(), 2000);

await session.done();
clearTimeout(timer);

if (session.exitReason === 'interrupted') {
  console.log('\nInterrupted — resuming...');
  const resumed = client.resume(session.sessionId, 'Continue from where you left off.');
  resumed.on('text', (chunk) => process.stdout.write(chunk));
  await resumed.done();
}
```

### Multi-turn conversation

```typescript
import { ClaudeCodeClient } from 'claude-code-client';

const client = new ClaudeCodeClient({ workspacePath: process.cwd() });

// First turn
let session = client.start('Remember the number 42.');
await session.done();
const sessionId = session.sessionId;

// Second turn — resume the same session
session = client.resume(sessionId, 'What number did I ask you to remember?');
session.on('text', (chunk) => process.stdout.write(chunk));
await session.done();
console.log();
```

### Replay a saved log file

```typescript
import fs from 'fs';
import readline from 'readline';
import { MessageParser } from 'claude-code-client';
import type { StreamJsonMessage } from 'claude-code-client';

const parser = new MessageParser();
const rl = readline.createInterface({
  input: fs.createReadStream('raw.jsonl', 'utf-8'),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (!line.trim()) continue;
  const msg = JSON.parse(line) as StreamJsonMessage;
  const entries = parser.parse(msg);
  for (const entry of entries) {
    if (entry.kind === 'text' && !entry.isStreaming) {
      console.log(entry.text);
    }
  }
}
```

### With MCP servers

```typescript
import { ClaudeCodeClient } from 'claude-code-client';

const client = new ClaudeCodeClient({
  workspacePath: '/path/to/project',
  mcpConfig: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/project'],
    },
  },
  allowedTools: ['filesystem__read_file', 'filesystem__list_directory'],
});

const session = client.start('Summarize the README.md file.');
session.on('text', (chunk) => process.stdout.write(chunk));
await session.done();
```

## Notes

- The `claude` binary must be in `PATH` and authenticated before use.
- Streaming entries (`isStreaming: true`) are deltas — the same `id` carries incremental text. An `assistant` message received from stdout resets the streaming state and delivers complete final entries.
- `interrupt()` sends `SIGINT` (or `SIGTERM` on Windows). After `done()` resolves with `exitReason === 'interrupted'`, call `client.resume(session.sessionId)` to continue.
- `done()` resolves on `end` and rejects on `error`. Interrupted or aborted sessions resolve with `undefined`.
