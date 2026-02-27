import type { ParsedEntry, ToolResultEntry } from '@cc-spacemolt/shared';
import { SystemMessage } from './SystemMessage';
import { TextMessage } from './TextMessage';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { UserMessage } from './UserMessage';
import { ResultMessage } from './ResultMessage';
import { StatusLine } from '../common/StatusLine';

export function EntryRenderer({
  entry,
  toolResultMap,
  isFirstSystem,
  agentName,
}: {
  entry: ParsedEntry;
  toolResultMap: Map<string, ToolResultEntry>;
  isFirstSystem?: boolean;
  agentName?: string;
}) {
  switch (entry.kind) {
    case 'system':
      return isFirstSystem ? <SystemMessage entry={entry} /> : null;
    case 'text':
      return <TextMessage entry={entry} name={agentName} />;
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
    case 'notification':
      return <StatusLine label={entry.text} />;
  }
}
