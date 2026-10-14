import type { ReactNode } from "react";

export function Stat({ value, label, delta }: { value: ReactNode; label: string; delta?: string }) {
  return (
    <div className="card metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {delta ? <div className="metric-context">{delta}</div> : null}
    </div>
  );
}
