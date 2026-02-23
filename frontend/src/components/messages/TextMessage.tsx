import type { TextEntry } from '@cc-spacemolt/shared';
import { MarkdownContent } from '../common/MarkdownContent';
import { MessageHeader } from './MessageHeader';

export function TextMessage({ entry }: { entry: TextEntry }) {
  return (
    <div>
      <MessageHeader
        icon={
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shrink-0">
            <span className="text-2xs font-bold text-white">C</span>
          </div>
        }
        label="Agent"
        timestamp={entry.timestamp}
      >
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
