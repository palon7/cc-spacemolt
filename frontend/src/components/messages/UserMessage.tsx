import type { UserMessageEntry } from '@cc-spacemolt/shared';
import { Avatar } from '../common/Avatar';
import { MessageHeader } from './MessageHeader';

export function UserMessage({
  entry,
  name,
  avatarUrl,
}: {
  entry: UserMessageEntry;
  name?: string;
  avatarUrl?: string;
}) {
  const displayName = name ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  const icon = (
    <Avatar url={avatarUrl} initial={initial} gradientClasses="from-sky-400 to-blue-600" />
  );

  return (
    <div className="p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/15">
      <MessageHeader
        icon={icon}
        label={displayName}
        labelClass="text-sky-400"
        timestamp={entry.timestamp}
      />
      <div className="ml-4 text-base text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
        {entry.text}
      </div>
    </div>
  );
}
