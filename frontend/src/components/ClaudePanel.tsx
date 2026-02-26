import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  ParsedEntry,
  SessionMeta,
  AgentStatus,
  ClientMessage,
  ToolResultEntry,
  RuntimeSettings,
} from '@cc-spacemolt/shared';
import { useStickToBottom } from '../hooks/useStickToBottom';
import { useSessionList } from '../hooks/useSessionList';
import { LuSend, LuSquare, LuArrowDown, LuClock, LuPlus, LuChevronDown } from 'react-icons/lu';
import { EntryRenderer } from './messages/EntryRenderer';
import { SessionHistoryModal } from './SessionHistoryModal';
import { SessionCard } from './common/SessionCard';
import { PanelHeader } from './common/PanelHeader';
import { PanelHeaderButton } from './common/PanelHeaderButton';
import { IconButton } from './common/IconButton';
import { ActionButton } from './common/ActionButton';
import { PanelInput, PanelTextarea } from './common/PanelInput';
import { Dropdown, type DropdownOption } from './common/Dropdown';
import { formatDuration } from '../utils/format';

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
  runtimeSettings: RuntimeSettings;
  startAgent: (instructions?: string) => void;
  sendMessage: (text: string) => void;
  interrupt: () => void;
  resetSession: () => void;
  selectSession: (sessionId: string) => void;
  updateSettings: (settings: (ClientMessage & { type: 'update_settings' })['settings']) => void;
}

type AutoResumeDropdownValue = 'off' | '0' | '30' | '60' | '180' | '360';

const AUTO_RESUME_OPTIONS: DropdownOption<AutoResumeDropdownValue>[] = [
  { value: 'off', label: 'OFF' },
  { value: '0', label: 'No limit', description: 'Run forever' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '180', label: '3 hours' },
  { value: '360', label: '6 hours' },
];

function useRemainingTime(startedAt: string | null, timeoutMinutes: number): string | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt || timeoutMinutes <= 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [startedAt, timeoutMinutes]);

  if (!startedAt || timeoutMinutes <= 0) return null;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const remaining = timeoutMinutes * 60_000 - elapsed;
  if (remaining <= 0) return null;
  return formatDuration(remaining);
}

export function ClaudePanel({
  entries,
  sessionMeta,
  status,
  connected,
  initialPrompt,
  runtimeSettings,
  startAgent,
  sendMessage,
  interrupt,
  resetSession,
  selectSession,
  updateSettings,
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
  const { refresh: refreshSessionList } = sessionList;
  useEffect(() => {
    if (status === 'idle') refreshSessionList();
  }, [status, refreshSessionList]);

  const handleShowHistory = useCallback(() => {
    setShowHistory(true);
    refreshSessionList();
  }, [refreshSessionList]);

  const isRunning = status === 'running' || status === 'starting';
  const supportsInput = sessionMeta?.supportsInput ?? true;
  const isCompacting = sessionMeta?.isCompacting ?? false;

  const { autoResume } = runtimeSettings;
  const remaining = useRemainingTime(autoResume.startedAt, autoResume.timeoutMinutes);

  const autoResumeValue: AutoResumeDropdownValue = !autoResume.enabled
    ? 'off'
    : (String(autoResume.timeoutMinutes) as AutoResumeDropdownValue);

  const handleAutoResumeChange = useCallback(
    (value: AutoResumeDropdownValue) => {
      if (value === 'off') {
        updateSettings({ autoResume: { enabled: false } });
      } else {
        updateSettings({ autoResume: { enabled: true, timeoutMinutes: Number(value) } });
      }
    },
    [updateSettings],
  );

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
            {sessionMeta && (
              <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-600">
                {sessionMeta.model}
              </span>
            )}
            {sessionMeta &&
              sessionMeta.contextWindow > 0 &&
              (() => {
                const pct = (sessionMeta.inputTokens / sessionMeta.contextWindow) * 100;
                const colorClass =
                  pct >= 95 ? 'text-red-400' : pct >= 80 ? 'text-yellow-400' : 'text-zinc-500';
                return (
                  <span className={`hidden sm:inline text-xs font-mono ${colorClass}`}>
                    {pct.toFixed(1)}%
                  </span>
                );
              })()}
            <PanelHeaderButton
              onClick={handleShowHistory}
              disabled={isRunning}
              title="Session History"
            >
              <LuClock size={14} />
            </PanelHeaderButton>
            {(status === 'error' || status === 'interrupted' || status === 'done') && (
              <PanelHeaderButton onClick={handleReset} disabled={!connected} title="New Session">
                <LuPlus size={14} />
              </PanelHeaderButton>
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

      {/* Auto-resume settings bar */}
      {status !== 'idle' && status !== 'error' && (
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-1.5 border-t border-zinc-800/60 bg-zinc-900/50">
          <Dropdown
            options={AUTO_RESUME_OPTIONS}
            value={autoResumeValue}
            onChange={handleAutoResumeChange}
            disabled={!connected}
            renderTrigger={({ option, isOpen }) => (
              <span
                className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
                  autoResume.enabled
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <span className="font-medium">
                  {autoResume.stopping ? 'Shutting down...' : `Auto ${option.label}`}
                </span>
                <LuChevronDown
                  size={11}
                  className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </span>
            )}
          />
          {autoResume.enabled && remaining && !autoResume.stopping && (
            <span className="text-xs text-zinc-600 tabular-nums">{remaining}</span>
          )}
        </div>
      )}

      {/* Input area */}
      {status !== 'error' && (
        <div className="shrink-0 px-3 sm:px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/80">
          {status === 'idle' ? (
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
              <IconButton color="amber" onClick={handleSend} disabled={!input.trim()}>
                <LuSend size={16} />
              </IconButton>
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
      )}

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
