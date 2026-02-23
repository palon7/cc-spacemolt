import { useCallback } from 'react';
import type { SessionSummary } from '@cc-spacemolt/shared';
import { IconX } from './common/Icons';
import { Modal } from './common/Modal';
import { SessionCard } from './common/SessionCard';

interface SessionHistoryModalProps {
  sessions: SessionSummary[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  currentSessionId: string | undefined;
  isRunning: boolean;
}

export function SessionHistoryModal({
  sessions,
  loading,
  error,
  onClose,
  onSelectSession,
  currentSessionId,
  isRunning,
}: SessionHistoryModalProps) {
  const handleSelect = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId);
      onClose();
    },
    [onSelectSession, onClose],
  );

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
        <h3 className="text-base font-semibold text-zinc-100">Session History</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <IconX />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
            Loading sessions...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-sm text-red-400">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
            No sessions found
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {sessions.map((session) => {
              const isCurrent = session.sessionId === currentSessionId;
              const canSelect = !isCurrent && !isRunning;
              return (
                <SessionCard
                  key={session.sessionId}
                  session={session}
                  variant="row"
                  isCurrent={isCurrent}
                  disabled={!canSelect}
                  showEntryCount
                  onClick={() => handleSelect(session.sessionId)}
                />
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
