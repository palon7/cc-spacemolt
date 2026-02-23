import { useState } from 'react';
import type { ToolCallEntry, ToolResultEntry } from '@cc-spacemolt/shared';
import { LuCheck, LuX } from 'react-icons/lu';
import { getToolEmoji, getActionLabel } from './ToolMeta';
import { formatActionDetail, formatContent } from './ActionDetail';
import { parseResultSummary } from './ResultParsers';

export function SpacemoltToolBlock({
  entry,
  result,
}: {
  entry: ToolCallEntry;
  result?: ToolResultEntry;
}) {
  const [expanded, setExpanded] = useState(false);
  const shortName = entry.toolName.slice('mcp__spacemolt__'.length);
  const emoji = getToolEmoji(shortName);
  const actionLabel = getActionLabel(shortName);
  const actionDetail = formatActionDetail(shortName, entry.input);

  const isPending = !result;
  const isError = result?.isError ?? false;
  const summary = result && !isError ? parseResultSummary(shortName, result.content) : null;

  const badgeClass = isPending
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : isError
      ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : 'bg-purple-500/10 text-purple-400 border-purple-500/20';

  return (
    <div>
      {/* Header row */}
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
            <LuX size={16} />
          </span>
        ) : (
          <span className="shrink-0 text-emerald-500">
            <LuCheck size={12} />
          </span>
        )}

        {/* Action badge */}
        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border font-bold ${badgeClass}`}>
          {emoji} {actionLabel}
        </span>

        {/* Action detail */}
        {actionDetail && (
          <span className="text-xs font-mono text-zinc-400 truncate min-w-0">{actionDetail}</span>
        )}

        {/* Timestamp */}
        <span className="text-xs text-zinc-700 font-mono ml-auto shrink-0">
          {entry.timestamp.slice(11, 19)}
        </span>
      </div>

      {/* Collapsed summary */}
      {result && !expanded && (
        <div className="ml-4 mt-0.5 text-xs font-mono">
          {isError ? (
            <div className="text-red-400/60 truncate">{result.content.trim().slice(0, 80)}</div>
          ) : summary ? (
            <>
              <div className="text-zinc-400">{summary.label}</div>
              {summary.lines.map((line, i) => (
                <div key={i} className="text-zinc-500">
                  {line}
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="ml-4 mt-1 space-y-1.5">
          {/* Summary section (purple) */}
          {summary && (
            <div className="px-3 py-2 rounded-md border bg-purple-500/5 border-purple-500/10">
              <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">Summary</div>
              <div className="text-sm font-mono space-y-0.5">
                <div className="text-zinc-300">{summary.label}</div>
                {summary.lines.map((line, i) => (
                  <div key={i} className="text-zinc-500">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div
            className={`px-3 py-2 rounded-md border overflow-x-auto ${
              isPending
                ? 'bg-amber-500/5 border-amber-500/10'
                : isError
                  ? 'bg-red-500/5 border-red-500/10'
                  : 'bg-purple-500/5 border-purple-500/10'
            }`}
          >
            <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">Input</div>
            <pre
              className={`text-sm font-mono whitespace-pre-wrap break-words ${
                isPending ? 'text-amber-200/70' : isError ? 'text-red-200/60' : 'text-purple-200/60'
              }`}
            >
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`px-3 py-2 rounded-md border overflow-x-auto ${
                isError ? 'bg-red-500/5 border-red-500/10' : 'bg-purple-500/5 border-purple-500/10'
              }`}
            >
              <div className="text-2xs uppercase tracking-widest text-zinc-600 mb-1">
                {isError ? 'Error' : 'Result'}
              </div>
              <pre
                className={`text-sm font-mono whitespace-pre-wrap break-words ${
                  isError ? 'text-red-200/60' : 'text-purple-200/60'
                }`}
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
