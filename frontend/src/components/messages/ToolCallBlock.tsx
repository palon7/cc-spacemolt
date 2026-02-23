import { useState } from 'react';
import type { ToolCallEntry, ToolResultEntry } from '@cc-spacemolt/shared';
import { IconCheck, IconX } from '../common/Icons';
import { SpacemoltToolBlock } from './SpacemoltToolBlock';

/** Maps tool name (lowercase) -> input key(s) to display as the primary parameter. */
const PRIMARY_PARAM_KEYS: Record<string, string[]> = {
  read: ['file_path'],
  write: ['file_path'],
  edit: ['file_path'],
  bash: ['command'],
  glob: ['pattern'],
  grep: ['pattern'],
  webfetch: ['url'],
  task: ['description', 'prompt'],
};

function getPrimaryParam(toolName: string, input: Record<string, unknown>): string {
  const keys = PRIMARY_PARAM_KEYS[toolName.toLowerCase()];
  const raw = keys
    ? keys.reduce<unknown>((v, k) => v ?? input[k], undefined)
    : Object.values(input)[0];
  return raw != null ? String(raw).slice(0, 60) : '';
}

function getResultSummary(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed;
}

function formatContent(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function ToolCallBlock({
  entry,
  result,
}: {
  entry: ToolCallEntry;
  result?: ToolResultEntry;
}) {
  const [expanded, setExpanded] = useState(false);

  if (entry.toolName.startsWith('mcp__spacemolt__')) {
    return <SpacemoltToolBlock entry={entry} result={result} />;
  }
  const isPending = !result;
  const isError = result?.isError ?? false;
  const primaryParam = getPrimaryParam(entry.toolName, entry.input);

  const colorClass = isPending
    ? { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', summary: 'text-zinc-600' }
    : isError
      ? { badge: 'bg-red-500/10 text-red-400 border-red-500/20', summary: 'text-red-400/60' }
      : {
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          summary: 'text-zinc-600',
        };

  return (
    <div>
      {/* Header row — entire row is clickable */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        className="flex items-center gap-1.5 min-w-0 cursor-pointer select-none hover:opacity-80 transition-opacity"
      >
        {/* State icon */}
        {isPending ? (
          <span className="shrink-0 w-3 h-3 rounded-full border border-t-amber-400 border-amber-400/20 animate-spin" />
        ) : isError ? (
          <span className="shrink-0 text-red-500">
            <IconX />
          </span>
        ) : (
          <span className="shrink-0 text-emerald-500">
            <IconCheck />
          </span>
        )}

        {/* Tool name badge */}
        <span
          className={`shrink-0 text-xs px-1.5 py-0.5 rounded border font-mono ${colorClass.badge}`}
        >
          {entry.toolName}
        </span>

        {/* Primary param */}
        {primaryParam && (
          <span className="text-xs font-mono text-zinc-500 truncate min-w-0">{primaryParam}</span>
        )}

        {/* Timestamp */}
        <span className="text-xs text-zinc-700 font-mono ml-auto shrink-0">
          {entry.timestamp.slice(11, 19)}
        </span>
      </div>

      {/* Result summary — shown below header when collapsed */}
      {result && !expanded && (
        <div className={`ml-4 mt-0.5 text-xs font-mono truncate ${colorClass.summary}`}>
          {getResultSummary(result.content)}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="ml-4 mt-1 space-y-1.5">
          {/* Input */}
          <div
            className={`px-3 py-2 rounded-md border overflow-x-auto ${
              isPending
                ? 'bg-amber-500/5 border-amber-500/10'
                : isError
                  ? 'bg-red-500/5 border-red-500/10'
                  : 'bg-emerald-500/5 border-emerald-500/10'
            }`}
          >
            <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">Input</div>
            <pre
              className={`text-sm font-mono whitespace-pre-wrap break-words ${
                isPending
                  ? 'text-amber-200/70'
                  : isError
                    ? 'text-red-200/60'
                    : 'text-emerald-200/60'
              }`}
            >
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`px-3 py-2 rounded-md border overflow-x-auto ${isError ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}
            >
              <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">
                {isError ? 'Error' : 'Result'}
              </div>
              <pre
                className={`text-sm font-mono whitespace-pre-wrap break-words ${isError ? 'text-red-200/60' : 'text-emerald-200/60'}`}
              >
                {formatContent(result.content)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
