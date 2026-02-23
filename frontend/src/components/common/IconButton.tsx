import type { ReactNode } from 'react';

export type IconButtonColor = 'emerald' | 'amber' | 'red';

const colorClasses: Record<IconButtonColor, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25',
  red: 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25',
};

interface IconButtonProps {
  color: IconButtonColor;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}

export function IconButton({ color, onClick, disabled, title, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`shrink-0 p-2 rounded-lg border ${colorClasses[color]} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
    >
      {children}
    </button>
  );
}
