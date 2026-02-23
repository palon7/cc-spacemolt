import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const baseClass =
  'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors';

export function PanelInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`flex-1 min-w-0 ${baseClass} disabled:opacity-50`} />;
}

export function PanelTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full ${baseClass} resize-y min-h-[2.5rem]`} />;
}
