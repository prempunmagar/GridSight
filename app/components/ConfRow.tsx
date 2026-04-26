"use client";

export default function ConfRow({
  label,
  value,
  display,
  color,
}: {
  label: string;
  value: number;
  display: string;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-mono text-ink-primary">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-subtle overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
