import type { UserMessageEntry } from '@cc-spacemolt/shared';
import { MessageHeader } from './MessageHeader';

export function UserMessage({ entry }: { entry: UserMessageEntry }) {
  return (
    <div className="p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/15">
      <MessageHeader
        icon={
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0">
            <span className="text-[6px] font-bold text-white">U</span>
          </div>
        }
        label="User"
        labelClass="text-sky-400"
        timestamp={entry.timestamp}
      />
      <div className="ml-4 text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
        {entry.text}
      </div>
    </div>
  );
}
