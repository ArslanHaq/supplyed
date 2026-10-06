import type { ReactNode } from "react";

export function Stat({ value, label, delta }: { value: ReactNode; label: string; delta?: string }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="font-heading text-[30px] leading-tight tabular-nums text-ink">{value}</div>
      <div className="mt-2 text-sm font-medium text-muted">{label}</div>
      {delta ? <div className="mt-3 border-t border-border pt-3 text-xs font-medium text-brand">{delta}</div> : null}
    </div>
  );
}
