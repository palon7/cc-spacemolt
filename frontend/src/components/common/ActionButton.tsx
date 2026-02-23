import type { ReactNode } from 'react';
import type { IconButtonColor } from './IconButton';

const colorClasses: Record<IconButtonColor, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25',
  red: 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25',
};

interface ActionButtonProps {
  color?: IconButtonColor;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export function ActionButton({
  color = 'emerald',
  onClick,
  disabled,
  children,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2 rounded-lg border ${colorClasses[color]} disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium tracking-wide`}
    >
      {children}
    </button>
  );
}
