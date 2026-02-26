import type { TextEntry } from '@cc-spacemolt/shared';
import { useConfig } from '../../contexts/ConfigContext';
import { MarkdownContent } from '../common/MarkdownContent';
import { Avatar } from '../common/Avatar';
import { MessageHeader } from './MessageHeader';

export function TextMessage({ entry, name }: { entry: TextEntry; name?: string }) {
  const { agentAvatarUrl } = useConfig();

  const icon = (
    <Avatar url={agentAvatarUrl} initial="C" gradientClasses="from-orange-400 to-amber-600" />
  );

  return (
    <div>
      <MessageHeader icon={icon} label={name ?? 'Agent'} timestamp={entry.timestamp}>
        {entry.isStreaming && (
          <div className="flex gap-0.5 ml-1">
            {[0, 150, 300].map((d) => (
              <div
                key={d}
                className="w-1 h-1 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        )}
      </MessageHeader>
      <div className="ml-4 text-base text-zinc-300 break-words">
        <MarkdownContent text={entry.text} />
        {entry.isStreaming && (
          <span className="inline-block w-0.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}
