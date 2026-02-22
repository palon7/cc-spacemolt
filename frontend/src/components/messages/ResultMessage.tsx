import type { ResultEntry } from '@cc-spacemolt/shared';

export function ResultMessage({ entry }: { entry: ResultEntry }) {
  const isError = entry.isError;

  return (
    <div
      className={`p-2.5 rounded-lg border ${
        isError ? 'bg-red-500/5 border-red-500/15' : 'bg-zinc-800/30 border-zinc-700/30'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${isError ? 'bg-red-400' : 'bg-emerald-400'}`} />
        <span
          className={`text-[10px] uppercase tracking-wider ${isError ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {isError ? 'Error' : 'Done'}
        </span>
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">
          {entry.timestamp.slice(11, 19)}
        </span>
      </div>
      <div className="ml-3 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-zinc-500">
          Cost <span className="text-blue-400">${entry.totalCostUsd.toFixed(4)}</span>
        </span>
        <span className="text-zinc-500">
          Turns <span className="text-zinc-300">{entry.numTurns}</span>
        </span>
        <span className="text-zinc-500">
          Duration <span className="text-zinc-300">{(entry.durationMs / 1000).toFixed(1)}s</span>
        </span>
      </div>
      {entry.errors && entry.errors.length > 0 && (
        <div className="ml-3 mt-1 text-[11px] text-red-400">{entry.errors.join(', ')}</div>
      )}
    </div>
  );
}
