import type { SessionMeta, AgentStatus } from '@cc-spacemolt/shared';
import { formatCost, formatTokens } from '../utils/format';

interface StatusBarProps {
  sessionMeta: SessionMeta | null;
  status: AgentStatus;
  connected: boolean;
  onInterrupt: () => void;
  onAbort: () => void;
}

function statusColor(status: AgentStatus, isCompacting: boolean): string {
  if (isCompacting) return 'text-purple-400';
  switch (status) {
    case 'running':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'starting':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

function contextColor(meta: SessionMeta): string {
  const ratio = meta.inputTokens / meta.contextWindow;
  if (ratio > 0.8) return 'text-red-400';
  if (ratio > 0.6) return 'text-yellow-400';
  return 'text-gray-300';
}

export function StatusBar({
  sessionMeta,
  status,
  connected,
  onInterrupt,
  onAbort,
}: StatusBarProps) {
  const isCompacting = sessionMeta?.isCompacting ?? false;
  const displayStatus = isCompacting ? 'COMPACTING' : status.toUpperCase();

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800 text-base shrink-0">
      {/* Connection indicator */}
      <span className={connected ? 'text-green-400' : 'text-red-400'}>{connected ? '●' : '○'}</span>

      {/* Status */}
      <span className={`font-bold ${statusColor(status, isCompacting)}`}>[{displayStatus}]</span>

      {sessionMeta && (
        <>
          <span className="text-blue-400">Cost: {formatCost(sessionMeta.totalCostUsd)}</span>
          <span className="text-gray-500">Turns: {sessionMeta.numTurns}</span>
          <span className={contextColor(sessionMeta)}>
            Ctx: {formatTokens(sessionMeta.inputTokens)}/{formatTokens(sessionMeta.contextWindow)} (
            {Math.round((sessionMeta.inputTokens / sessionMeta.contextWindow) * 100)}%)
          </span>
          {sessionMeta.mcpServers.map((s) => (
            <span
              key={s.name}
              className={s.status === 'connected' ? 'text-green-400' : 'text-red-400'}
            >
              {s.name}: {s.status === 'connected' ? '●' : '○'}
            </span>
          ))}
          <span className="text-gray-500">{sessionMeta.model}</span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Control buttons */}
      {status === 'running' && (
        <div className="flex gap-2">
          <button
            onClick={onInterrupt}
            className="px-2 py-0.5 text-sm bg-yellow-900 text-yellow-300 rounded hover:bg-yellow-800"
          >
            Interrupt
          </button>
          <button
            onClick={onAbort}
            className="px-2 py-0.5 text-sm bg-red-900 text-red-300 rounded hover:bg-red-800"
          >
            Abort
          </button>
        </div>
      )}
    </div>
  );
}
