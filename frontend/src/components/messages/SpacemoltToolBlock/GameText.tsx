import type { ReactNode } from 'react';

// Styled game-text span helpers
export const G = {
  item: (v: unknown): ReactNode => <span className="text-yellow-400 font-bold">{String(v)}</span>,
  system: (v: unknown): ReactNode => <span className="text-cyan-300 font-bold">{String(v)}</span>,
  poi: (v: unknown): ReactNode => <span className="text-purple-400">{String(v)}</span>,
  credits: (v: unknown): ReactNode => (
    <>
      <span className="text-green-400">{String(v)}</span>
      <span className="text-green-400/60">cr</span>
    </>
  ),
  player: (v: unknown): ReactNode => <span className="text-white font-bold">{String(v)}</span>,
  qty: (v: unknown): ReactNode => (
    <>
      <span className="text-yellow-400/60">x</span>
      <span className="text-yellow-400">{String(v)}</span>
    </>
  ),
  ship: (v: unknown): ReactNode => <span className="text-blue-400 font-bold">{String(v)}</span>,
  fuel: (cur: unknown, max: unknown): ReactNode => (
    <span className="text-yellow-400">
      {String(cur)}/{String(max)}
    </span>
  ),
  cargo: (cur: unknown, max: unknown): ReactNode => (
    <span className="text-cyan-400">
      {String(cur)}/{String(max)}
    </span>
  ),
  damage: (v: unknown): ReactNode => (
    <span className="text-red-400 font-bold">{String(v)} dmg</span>
  ),
  xp: (label: string, v: unknown): ReactNode => (
    <span className="text-cyan-400">
      +{String(v)} {label} XP
    </span>
  ),
  channel: (v: unknown): ReactNode => <span className="text-cyan-400">{String(v)}</span>,
  dim: (v: unknown): ReactNode => <span className="text-zinc-500">{String(v)}</span>,
  empire: (v: unknown): ReactNode => <span className="text-orange-400">{String(v)}</span>,
  security: (v: unknown): ReactNode => <span className="text-blue-300">{String(v)}</span>,
};

export interface ResultSummary {
  label: ReactNode;
  lines: ReactNode[];
}
