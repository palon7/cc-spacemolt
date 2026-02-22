import type { SystemEntry } from '@cc-spacemolt/shared';
import { MessageHeader } from './MessageHeader';

export function SystemMessage({ entry }: { entry: SystemEntry }) {
  return (
    <div className="p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/15">
      <MessageHeader
        icon={<div className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
        label="Session Started"
        labelClass="text-violet-400"
        timestamp={entry.timestamp}
      />
      <div className="ml-3 space-y-0.5">
        <div className="text-[11px] text-zinc-400">
          <span className="text-zinc-600">ID:</span> {entry.sessionId}
        </div>
        <div className="text-[11px] text-zinc-400">
          <span className="text-zinc-600">Model:</span> {entry.model}
        </div>
      </div>
    </div>
  );
}
