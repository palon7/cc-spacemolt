import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
}

export function Modal({ onClose, maxWidth = 'max-w-2xl', children }: ModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={`relative w-full ${maxWidth} max-h-[85vh] bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-modal-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
