interface ChipProps {
  label: string;
  value: string | number;
}

export function Chip({ label, value }: ChipProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md bg-zinc-800/50 border border-zinc-800">
      <span className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</span>
      <span className="font-mono text-xs text-zinc-300">{value}</span>
    </div>
  );
}
