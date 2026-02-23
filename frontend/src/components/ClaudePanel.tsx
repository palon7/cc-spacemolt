import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { ParsedEntry, SessionMeta, AgentStatus, ToolResultEntry } from '@cc-spacemolt/shared';
import { useStickToBottom } from '../hooks/useStickToBottom';
import { useSessionList } from '../hooks/useSessionList';
import { LuSend, LuSquare, LuRotateCcw, LuArrowDown, LuClock } from 'react-icons/lu';
import { EntryRenderer } from './messages/EntryRenderer';
import { SessionHistoryModal } from './SessionHistoryModal';
import { SessionCard } from './common/SessionCard';
import { PanelHeader } from './common/PanelHeader';
import { PanelHeaderButton } from './common/PanelHeaderButton';
import { IconButton } from './common/IconButton';
import { ActionButton } from './common/ActionButton';
import { PanelInput, PanelTextarea } from './common/PanelInput';

function StatusBadge({
  color,
  label,
  pulse,
}: {
  color: 'purple' | 'amber' | 'yellow';
  label: string;
  pulse?: boolean;
}) {
  const colors = {
    purple: { dot: 'bg-purple-400', text: 'text-purple-400' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-400' },
    yellow: { dot: 'bg-yellow-400', text: 'text-yellow-400' },
  };
  const { dot, text } = colors[color];
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1 h-1 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      <span className={`text-xs ${text} tracking-wider`}>{label}</span>
    </div>
  );
}

interface ClaudePanelProps {
  entries: ParsedEntry[];
  sessionMeta: SessionMeta | null;
  status: AgentStatus;
  connected: boolean;
  initialPrompt: string;
  startAgent: (instructions?: string) => void;
  sendMessage: (text: string) => void;
  interrupt: () => void;
  resetSession: () => void;
  selectSession: (sessionId: string) => void;
}

export function ClaudePanel({
  entries,
  sessionMeta,
  status,
  connected,
  initialPrompt,
  startAgent,
  sendMessage,
  interrupt,
  resetSession,
  selectSession,
}: ClaudePanelProps) {
  const [input, setInput] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const { scrollRef, isAtBottom, newCount, checkBottom, scrollToBottom, onContentGrew } =
    useStickToBottom();

  const toolResultMap = useMemo(() => {
    const map = new Map<string, ToolResultEntry>();
    for (const entry of entries) {
      if (entry.kind === 'tool_result') map.set(entry.toolUseId, entry);
    }
    return map;
  }, [entries]);

  const prevLenRef = useRef(entries.length);
  useEffect(() => {
    const added = entries.length - prevLenRef.current;
    if (added > 0) onContentGrew(added);
    prevLenRef.current = entries.length;
  }, [entries.length, onContentGrew]);

  // Also auto-scroll on streaming updates (same entry count but content changed)
  const lastEntryRef = useRef<ParsedEntry | null>(null);
  useEffect(() => {
    const last = entries[entries.length - 1];
    if (last && last !== lastEntryRef.current) {
      if ((last.kind === 'text' || last.kind === 'thinking') && last.isStreaming) {
        onContentGrew(0);
      }
      lastEntryRef.current = last;
    }
  }, [entries, onContentGrew]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleReset = useCallback(() => {
    if (window.confirm('Reset session? All current messages will be cleared.')) {
      resetSession();
    }
  }, [resetSession]);

  const sessionList = useSessionList();
  useEffect(() => {
    if (status === 'idle') sessionList.refresh();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowHistory = useCallback(async () => {
    await sessionList.refresh();
    setShowHistory(true);
  }, [sessionList]);

  const isRunning = status === 'running' || status === 'starting';
  const supportsInput = sessionMeta?.supportsInput ?? true;
  const isCompacting = sessionMeta?.isCompacting ?? false;

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title="Mission Log"
        dotClass={
          isRunning
            ? 'bg-amber-400'
            : status === 'interrupted'
              ? 'bg-yellow-400'
              : status === 'error'
                ? 'bg-red-400'
                : 'bg-zinc-500'
        }
        dotStyle={{ boxShadow: isRunning ? '0 0 6px rgba(251,191,36,0.4)' : undefined }}
        right={
          <>
            {isCompacting && <StatusBadge color="purple" label="Compacting" pulse />}
            {isRunning && !isCompacting && <StatusBadge color="amber" label="Running" pulse />}
            {status === 'interrupted' && <StatusBadge color="yellow" label="Stopped" />}
            <PanelHeaderButton
              onClick={handleShowHistory}
              disabled={isRunning}
              title="Session History"
            >
              <LuClock size={14} />
            </PanelHeaderButton>
            {sessionMeta && (
              <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-600">
                {sessionMeta.model}
              </span>
            )}
            {sessionMeta && (
              <span className="hidden sm:inline text-xs font-mono text-blue-400">
                ${sessionMeta.totalCostUsd.toFixed(4)}
              </span>
            )}
          </>
        }
      />

      {/* Scrollable messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={checkBottom}
          className="absolute inset-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar"
        >
          {status === 'idle' && sessionList.sessions.length > 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">Recent Sessions</p>
              <div className="w-full max-w-md space-y-1.5">
                {sessionList.sessions.slice(0, 3).map((session) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session}
                    onClick={() => selectSession(session.sessionId)}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleShowHistory}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show all sessions...
              </button>
            </div>
          )}
          {(() => {
            const firstSystemId = entries.find((e) => e.kind === 'system')?.id;
            return entries.map((entry) => (
              <EntryRenderer
                key={entry.id}
                entry={entry}
                toolResultMap={toolResultMap}
                isFirstSystem={entry.id === firstSystemId}
              />
            ));
          })()}
          {status === 'starting' && (
            <div className="flex items-center gap-1.5">
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
              <span className="text-xs uppercase tracking-wider text-zinc-600">Starting...</span>
            </div>
          )}
        </div>

        {/* Scroll-to-bottom pill */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-zinc-800/95 border border-zinc-600/80 shadow-lg shadow-black/50 hover:bg-zinc-700 hover:border-zinc-500 transition-all backdrop-blur-sm cursor-pointer"
          >
            <LuArrowDown size={12} />
            {newCount > 0 ? (
              <span className="text-sm font-medium text-amber-400 tabular-nums">
                {newCount} new
              </span>
            ) : (
              <span className="text-sm font-medium text-zinc-400">Latest</span>
            )}
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-3 sm:px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/80">
        {status === 'error' ? (
          /* Error — New Session only */
          <ActionButton onClick={handleReset} disabled={!connected}>
            New Session
          </ActionButton>
        ) : status === 'idle' ? (
          /* No session — Start Agent */
          <div className="flex flex-col gap-2">
            <PanelTextarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={initialPrompt || 'Enter instructions...'}
              rows={2}
            />
            <ActionButton
              onClick={() => startAgent(instructions.trim() || undefined)}
              disabled={!connected}
            >
              Start Agent
            </ActionButton>
          </div>
        ) : (status === 'interrupted' || status === 'done') && supportsInput ? (
          /* Interrupted / Done — Send message to resume, or start new session */
          <div className="flex items-center gap-2">
            <PanelInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                status === 'done' ? 'Send a follow-up message...' : 'Send a message to resume...'
              }
              disabled={!connected}
            />
            <div className="flex items-center gap-1.5">
              <IconButton
                color="emerald"
                onClick={handleReset}
                disabled={!connected}
                title="New Session"
              >
                <LuRotateCcw size={14} />
              </IconButton>
              <IconButton color="amber" onClick={handleSend} disabled={!input.trim()}>
                <LuSend size={16} />
              </IconButton>
            </div>
          </div>
        ) : isRunning && supportsInput ? (
          /* Running — Stop + chat input */
          <div className="flex items-center gap-2">
            <PanelInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message to Claude..."
              disabled={!connected}
            />
            <div className="flex items-center gap-1.5">
              <IconButton color="red" onClick={() => interrupt()} title="Stop">
                <LuSquare size={14} fill="currentColor" stroke="none" />
              </IconButton>
              <IconButton color="amber" onClick={handleSend} disabled={!input.trim()}>
                <LuSend size={16} />
              </IconButton>
            </div>
          </div>
        ) : null}
      </div>

      {showHistory && (
        <SessionHistoryModal
          sessions={sessionList.sessions}
          loading={sessionList.loading}
          error={sessionList.error}
          onClose={() => setShowHistory(false)}
          onSelectSession={selectSession}
          currentSessionId={sessionMeta?.sessionId}
          isRunning={isRunning}
        />
      )}
    </div>
  );
}
