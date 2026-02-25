import { useState } from 'react';
import type { UserMessageEntry } from '@cc-spacemolt/shared';
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
  const [imgError, setImgError] = useState(false);
  const displayName = name ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  const icon =
    avatarUrl && !imgError ? (
      <img
        src={avatarUrl}
        alt=""
        className="w-3 h-3 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
      />
    ) : (
      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0">
        <span className="text-2xs font-bold text-white">{initial}</span>
      </div>
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
