import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Stat({
  value,
  label,
  delta,
  icon,
}: {
  value: ReactNode;
  label: string;
  delta?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-(--shadow-xs)">
      <div className="flex items-center justify-between gap-3">
        <div className="font-serif text-3xl leading-tight text-ink">{value}</div>
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand">
            <Icon name={icon} size={17} />
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[1px] text-muted">{label}</div>
      {delta ? <div className="mt-2 text-xs font-semibold text-brand">{delta}</div> : null}
    </div>
  );
}
