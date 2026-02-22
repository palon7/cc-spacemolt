import { useEffect, useRef, useMemo } from 'react';
import type { ParsedEntry, ToolResultEntry } from '@cc-spacemolt/shared';
import { SystemMessage } from './messages/SystemMessage';
import { TextMessage } from './messages/TextMessage';
import { ThinkingBlock } from './messages/ThinkingBlock';
import { ToolCallBlock } from './messages/ToolCallBlock';
import { UserMessage } from './messages/UserMessage';
import { ResultMessage } from './messages/ResultMessage';

interface ChatPanelProps {
  entries: ParsedEntry[];
}

export function ChatPanel({ entries }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScroll = useRef(true);

  const toolResultMap = useMemo(() => {
    const map = new Map<string, ToolResultEntry>();
    for (const entry of entries) {
      if (entry.kind === 'tool_result') map.set(entry.toolUseId, entry);
    }
    return map;
  }, [entries]);

  // Track whether user has scrolled up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (isAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [entries]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
      {entries.map((entry) => (
        <EntryRenderer key={entry.id} entry={entry} toolResultMap={toolResultMap} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function EntryRenderer({
  entry,
  toolResultMap,
}: {
  entry: ParsedEntry;
  toolResultMap: Map<string, ToolResultEntry>;
}) {
  switch (entry.kind) {
    case 'system':
      return <SystemMessage entry={entry} />;
    case 'text':
      return <TextMessage entry={entry} />;
    case 'thinking':
      return <ThinkingBlock entry={entry} />;
    case 'tool_call':
      return <ToolCallBlock entry={entry} result={toolResultMap.get(entry.toolUseId)} />;
    case 'tool_result':
      return null;
    case 'user_message':
      return <UserMessage entry={entry} />;
    case 'result':
      return <ResultMessage entry={entry} />;
  }
}
