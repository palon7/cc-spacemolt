export type TabKey = 'ship' | 'claude' | 'events';

interface MobileTabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const tabs: Array<{ key: TabKey; label: string; dot: string }> = [
  { key: 'ship', label: 'Ship', dot: 'bg-emerald-400' },
  { key: 'claude', label: 'Log', dot: 'bg-amber-400' },
  { key: 'events', label: 'Events', dot: 'bg-cyan-400' },
];

export function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <div className="flex border-b border-zinc-800 bg-zinc-900 shrink-0 md:hidden">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm uppercase tracking-widest transition-colors border-b-2 ${
            active === t.key
              ? 'text-zinc-200 border-zinc-400'
              : 'text-zinc-600 border-transparent hover:text-zinc-400'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${t.dot} ${active === t.key ? '' : 'opacity-40'}`}
          />
          {t.label}
        </button>
      ))}
    </div>
  );
}
