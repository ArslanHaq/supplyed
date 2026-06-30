import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
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
