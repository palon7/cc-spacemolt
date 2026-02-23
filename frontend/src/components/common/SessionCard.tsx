import type { SessionSummary } from '@cc-spacemolt/shared';
import { formatDate, formatDuration } from '../../utils/format';

interface SessionCardProps {
  session: SessionSummary;
  onClick: () => void;
  disabled?: boolean;
  isCurrent?: boolean;
  showEntryCount?: boolean;
  /** 'card' = bordered card (idle screen), 'row' = full-width list item (modal) */
  variant?: 'card' | 'row';
}

export function SessionCard({
  session,
  onClick,
  disabled,
  isCurrent,
  showEntryCount,
  variant = 'card',
}: SessionCardProps) {
  const variantClass =
    variant === 'card'
      ? 'px-4 py-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/40 hover:bg-zinc-800/70 hover:border-zinc-600/60 cursor-pointer'
      : isCurrent
        ? 'px-5 py-3 bg-zinc-800/30'
        : disabled
          ? 'px-5 py-3 opacity-50 cursor-not-allowed'
          : 'px-5 py-3 hover:bg-zinc-800/40 cursor-pointer';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left transition-colors ${variantClass}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono text-zinc-500">{formatDate(session.startedAt)}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-500">
          {session.model}
        </span>
        {isCurrent && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            Current
          </span>
        )}
      </div>
      {session.lastMessage && (
        <p className="text-sm text-zinc-400 truncate mb-1">{session.lastMessage}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-zinc-600">
        {session.totalCostUsd > 0 && (
          <span className="font-mono text-blue-400">${session.totalCostUsd.toFixed(4)}</span>
        )}
        {session.numTurns > 0 && <span>{session.numTurns} turns</span>}
        {session.durationMs > 0 && <span>{formatDuration(session.durationMs)}</span>}
        {showEntryCount && <span>{session.entryCount} entries</span>}
      </div>
    </button>
  );
}
