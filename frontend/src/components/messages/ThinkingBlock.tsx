import { useState } from 'react';
import type { ThinkingEntry } from '@cc-spacemolt/shared';
import { LuClock } from 'react-icons/lu';

function getLastLine(text: string): string {
  const lines = text.trimEnd().split('\n');
  return lines[lines.length - 1] || '';
}

export function ThinkingBlock({ entry }: { entry: ThinkingEntry }) {
  const [expanded, setExpanded] = useState(false);

  const lastLine = getLastLine(entry.text);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 mb-1 w-full text-left cursor-pointer group"
      >
        {entry.isStreaming ? (
          <span className="text-amber-500">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none">
              <circle
                cx="6"
                cy="6"
                r="5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="20 10"
              />
            </svg>
          </span>
        ) : (
          <span className="text-zinc-600">
            <LuClock size={12} />
          </span>
        )}
        <span className="text-xs uppercase tracking-wider text-zinc-600">Thinking</span>
        <span className="text-xs text-zinc-600 ml-1 select-none">{expanded ? '▾' : '▸'}</span>
        {!expanded && lastLine && (
          <span className="text-xs text-zinc-600 font-mono truncate max-w-[60%]">{lastLine}</span>
        )}
        <span className="text-xs text-zinc-700 font-mono ml-auto shrink-0">
          {entry.timestamp.slice(11, 19)}
        </span>
      </button>
      {expanded && (
        <div className="ml-4 px-3 py-2 rounded-md bg-zinc-800/30 border-l-2 border-zinc-700 text-sm text-zinc-500 leading-relaxed italic whitespace-pre-wrap break-words">
          {entry.text}
          {entry.isStreaming && <span className="animate-pulse ml-0.5">|</span>}
        </div>
      )}
    </div>
  );
}
