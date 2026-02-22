import type { ReactNode } from 'react';

interface MessageHeaderProps {
  icon: ReactNode;
  label: string;
  labelClass?: string;
  timestamp: string;
  /** Extra content between label and timestamp (e.g. streaming indicator) */
  children?: ReactNode;
}

export function MessageHeader({
  icon,
  label,
  labelClass = 'text-zinc-500',
  timestamp,
  children,
}: MessageHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className={`text-[10px] uppercase tracking-wider ${labelClass}`}>{label}</span>
      {children}
      <span className="text-[10px] text-zinc-700 font-mono ml-auto">{timestamp.slice(11, 19)}</span>
    </div>
  );
}
