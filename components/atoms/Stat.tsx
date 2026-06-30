import type { ReactNode } from "react";

export function Stat({ value, label, delta }: { value: ReactNode; label: string; delta?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <div className="font-serif text-3xl leading-tight text-[var(--ink)]">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[1px] text-[var(--muted)]">{label}</div>
      {delta ? <div className="mt-2 text-xs font-semibold text-[var(--se)]">{delta}</div> : null}
    </div>
  );
}
