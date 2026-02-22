import { useState } from 'react';
import type { GameEvent } from '@cc-spacemolt/shared';

const EVT_BADGE: Record<string, string> = {
  state_change: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  mining_yield: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  ok: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/15',
  chat_message: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  skill_level_up: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  combat_update: 'bg-red-500/15 text-red-400 border-red-500/20',
  poi_arrival: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  trade_offer_received: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  scan_detected: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20',
};

const EVT_LABEL: Record<string, string> = {
  state_change: 'TRAVEL',
  mining_yield: 'MINING',
  ok: 'OK',
  chat_message: 'CHAT',
  skill_level_up: 'SKILL UP',
  combat_update: 'COMBAT',
  poi_arrival: 'ARRIVAL',
  trade_offer_received: 'TRADE',
  scan_detected: 'SCAN',
};

const FILTERS = [
  { key: 'all', label: 'All', types: null as string[] | null },
  { key: 'chat', label: 'Chat', types: ['chat_message'] },
  { key: 'combat', label: 'Combat', types: ['combat_update', 'scan_detected'] },
  { key: 'system', label: 'System', types: ['ok', 'state_change'] },
  { key: 'mining', label: 'Mining', types: ['mining_yield'] },
  {
    key: 'social',
    label: 'Social',
    types: ['poi_arrival', 'trade_offer_received', 'skill_level_up'],
  },
];

interface EventsPanelProps {
  events: GameEvent[];
}

export function EventsPanel({ events }: EventsPanelProps) {
  const [filter, setFilter] = useState('all');

  const filtered =
    filter === 'all'
      ? events
      : events.filter((e) => {
          const f = FILTERS.find((f) => f.key === filter);
          return f?.types?.includes(e.type);
        });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
            style={{ boxShadow: '0 0 6px rgba(34,211,238,0.4)' }}
          />
          <h2 className="text-xs font-semibold text-zinc-300 tracking-widest uppercase">Events</h2>
          <span className="font-mono text-[10px] text-zinc-600">{filtered.length}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800/50 overflow-x-auto shrink-0 custom-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                : 'text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 custom-scrollbar">
        {filtered.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-1.5 py-1.5 px-1.5 rounded hover:bg-zinc-800/40 transition-colors"
          >
            <span className="font-mono text-[10px] text-zinc-700 mt-0.5 shrink-0 hidden sm:inline">
              {e.ts.slice(11, 19)}
            </span>
            <span className="font-mono text-[10px] text-zinc-700 mt-0.5 shrink-0 sm:hidden">
              {e.ts.slice(11, 16)}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                EVT_BADGE[e.type] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'
              }`}
            >
              {EVT_LABEL[e.type] || e.type}
            </span>
            <span className="text-[11px] text-zinc-400 leading-relaxed break-all">{e.summary}</span>
          </div>
        ))}
        {!filtered.length && (
          <div className="text-xs text-zinc-600 italic p-4 text-center">No events</div>
        )}
      </div>
    </div>
  );
}
