import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import readline from 'readline';
import type { ParsedEntry, SessionMeta, SessionSummary } from './types.js';
import { createReplayParser } from '../agent/message-parser.js';
import type { StreamJsonMessage } from '../agent/message-parser.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * List all sessions in the log directory.
 * Reads only the first and last lines of each raw.jsonl for metadata.
 */
export async function listSessions(logDir: string): Promise<SessionSummary[]> {
  let dirEntries: fs.Dirent[];
  try {
    dirEntries = await fsp.readdir(logDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const summaries: SessionSummary[] = [];

  for (const dirent of dirEntries) {
    if (!dirent.isDirectory() || !UUID_RE.test(dirent.name)) continue;

    const rawPath = path.join(logDir, dirent.name, 'raw.jsonl');
    try {
      await fsp.access(rawPath);
    } catch {
      continue;
    }

    try {
      const summary = await buildSessionSummary(rawPath, dirent.name);
      if (summary) summaries.push(summary);
    } catch {
      // Skip corrupt/unreadable sessions
    }
  }

  summaries.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  return summaries;
}

/**
 * Replay a session from raw.jsonl using an isolated parser.
 * Returns entries and reconstructed session meta.
 */
export async function replaySession(
  logDir: string,
  sessionId: string,
): Promise<{ entries: ParsedEntry[]; meta: SessionMeta | null }> {
  if (!UUID_RE.test(sessionId)) {
    throw new Error('Invalid session ID format');
  }

  const rawPath = path.join(logDir, sessionId, 'raw.jsonl');
  await fsp.access(rawPath); // throws if not found

  const parse = createReplayParser();
  const entries: ParsedEntry[] = [];
  let meta: SessionMeta | null = null;

  const stream = fs.createReadStream(rawPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg: StreamJsonMessage;
    try {
      msg = JSON.parse(line) as StreamJsonMessage;
    } catch {
      continue;
    }

    const parsed = parse(msg);
    for (const entry of parsed) {
      entries.push(entry);

      if (entry.kind === 'system') {
        meta = {
          sessionId: entry.sessionId,
          model: entry.model,
          tools: entry.tools,
          mcpServers: entry.mcpServers,
          totalCostUsd: 0,
          numTurns: 0,
          inputTokens: 0,
          outputTokens: 0,
          isCompacting: false,
          contextWindow: 0,
          supportsInput: true,
        };
      } else if (entry.kind === 'result' && meta) {
        meta.totalCostUsd = entry.totalCostUsd;
        meta.numTurns = entry.numTurns;
      }
    }
  }

  return { entries, meta };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LAST_MESSAGE_MAX_LENGTH = 120;

async function buildSessionSummary(
  rawPath: string,
  dirName: string,
): Promise<SessionSummary | null> {
  const stat = await fsp.stat(rawPath);
  const content = await fsp.readFile(rawPath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return null;

  let firstMsg: StreamJsonMessage;
  try {
    firstMsg = JSON.parse(lines[0]) as StreamJsonMessage;
  } catch {
    return null;
  }

  const sessionId = firstMsg.session_id ?? dirName;
  const model = firstMsg.model ?? 'unknown';
  const startedAt = stat.birthtime.toISOString();

  let totalCostUsd = 0;
  let numTurns = 0;
  let durationMs = 0;
  let lastMessage: string | undefined;

  // Scan from the end to find result and last assistant text
  for (let i = lines.length - 1; i >= 1; i--) {
    try {
      const msg = JSON.parse(lines[i]) as StreamJsonMessage;
      if (msg.type === 'result' && totalCostUsd === 0) {
        totalCostUsd = msg.total_cost_usd ?? 0;
        numTurns = msg.num_turns ?? 0;
        durationMs = msg.duration_ms ?? 0;
      }
      if (!lastMessage && msg.type === 'assistant') {
        lastMessage = extractAssistantText(msg);
      }
      if (totalCostUsd > 0 && lastMessage) break;
    } catch {
      // skip unparseable lines
    }
  }

  return {
    sessionId,
    model,
    totalCostUsd,
    numTurns,
    durationMs,
    startedAt,
    lastModified: stat.mtime.toISOString(),
    entryCount: lines.length,
    lastMessage,
  };
}

/**
 * Extract text from an assistant stream-json message.
 * The message.content array may contain text and tool_use blocks.
 */
function extractAssistantText(msg: StreamJsonMessage): string | undefined {
  const content = (msg.message as { content?: Array<{ type: string; text?: string }> } | undefined)
    ?.content;
  if (!Array.isArray(content)) return undefined;

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      const text = block.text.trim();
      if (!text) continue;
      if (text.length <= LAST_MESSAGE_MAX_LENGTH) return text;
      return text.slice(0, LAST_MESSAGE_MAX_LENGTH) + '...';
    }
  }
  return undefined;
}
