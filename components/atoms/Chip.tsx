import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      aria-pressed={Boolean(active)}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        active
          ? "border-brand bg-brand-tint text-brand"
          : "border-border bg-white text-slate hover:bg-chalk",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
