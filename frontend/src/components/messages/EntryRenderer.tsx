import type { ParsedEntry, ToolResultEntry } from '@cc-spacemolt/shared';
import { SystemMessage } from './SystemMessage';
import { TextMessage } from './TextMessage';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { UserMessage } from './UserMessage';
import { ResultMessage } from './ResultMessage';

export function EntryRenderer({
  entry,
  toolResultMap,
  isFirstSystem,
  agentName,
  agentAvatarUrl,
  userName,
  userAvatarUrl,
}: {
  entry: ParsedEntry;
  toolResultMap: Map<string, ToolResultEntry>;
  isFirstSystem?: boolean;
  agentName?: string;
  agentAvatarUrl?: string;
  userName?: string;
  userAvatarUrl?: string;
}) {
  switch (entry.kind) {
    case 'system':
      return isFirstSystem ? <SystemMessage entry={entry} /> : null;
    case 'text':
      return <TextMessage entry={entry} name={agentName} avatarUrl={agentAvatarUrl} />;
    case 'thinking':
      return <ThinkingBlock entry={entry} />;
    case 'tool_call':
      return <ToolCallBlock entry={entry} result={toolResultMap.get(entry.toolUseId)} />;
    case 'tool_result':
      return null;
    case 'user_message':
      return <UserMessage entry={entry} name={userName} avatarUrl={userAvatarUrl} />;
    case 'result':
      return <ResultMessage entry={entry} />;
  }
}
