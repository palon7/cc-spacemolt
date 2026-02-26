export function StatusLine({
  label,
  color,
  spinner,
}: {
  label: string;
  color?: string;
  spinner?: boolean;
}) {
  if (!spinner) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs uppercase tracking-wider text-zinc-600">{label}</span>
      </div>
    );
  }

  const colorClass = color === 'purple' ? 'text-purple-500' : 'text-amber-500';

  return (
    <div className="flex items-center gap-1.5">
      <span className={colorClass}>
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none">
          <circle
            cx="6"
            cy="6"
            r="5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="20 10"
          />
        </svg>
      </span>
      <span className="text-xs uppercase tracking-wider text-zinc-600">{label}</span>
    </div>
  );
}
