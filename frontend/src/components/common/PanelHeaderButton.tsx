import type { ReactNode } from 'react';

interface PanelHeaderButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}

export function PanelHeaderButton({ onClick, disabled, title, children }: PanelHeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-3 -m-2 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
