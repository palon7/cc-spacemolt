const pct = (v: number | undefined, m: number | undefined) =>
  !m ? 0 : Math.min(100, Math.round(((v ?? 0) / m) * 100));

const barFg = (p: number) => (p >= 66 ? 'bg-emerald-400' : p >= 33 ? 'bg-amber-400' : 'bg-red-400');

const barBg = (p: number) =>
  p >= 66 ? 'bg-emerald-400/10' : p >= 33 ? 'bg-amber-400/10' : 'bg-red-400/10';

interface GaugeBarProps {
  label: string;
  value: number | undefined;
  max: number | undefined;
}

export function GaugeBar({ label, value, max }: GaugeBarProps) {
  const p = pct(value, max);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-zinc-500">{label}</span>
        <span className="font-mono text-sm text-zinc-300">
          {value ?? '?'}
          <span className="text-zinc-600">/{max ?? '?'}</span>
        </span>
      </div>
      <div className={`h-1.5 rounded-full ${barBg(p)} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${barFg(p)} transition-all duration-700`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
