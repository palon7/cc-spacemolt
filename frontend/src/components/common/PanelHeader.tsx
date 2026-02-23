import type { CSSProperties, ReactNode } from 'react';

interface PanelHeaderProps {
  title: string;
  dotClass: string;
  dotStyle?: CSSProperties;
  titleSuffix?: ReactNode;
  right?: ReactNode;
}

export function PanelHeader({ title, dotClass, dotStyle, titleSuffix, right }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0 min-h-[50px]">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} style={dotStyle} />
        <h2 className="text-sm font-semibold text-zinc-300 tracking-widest uppercase">{title}</h2>
        {titleSuffix}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
