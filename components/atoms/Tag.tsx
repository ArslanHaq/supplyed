import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

type TagTone = "" | "green" | "amber" | "red" | "purple" | "ghost";

const toneClass: Record<TagTone, string> = {
  "": "bg-brand-tint text-brand",
  green: "bg-success-tint text-success",
  amber: "bg-warning-tint text-warning",
  red: "bg-danger-tint text-danger",
  purple: "bg-accent-purple-tint text-accent-purple",
  ghost: "border border-border bg-chalk text-slate",
};

export function Tag({
  tone = "",
  children,
  className,
  style,
}: {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px]", toneClass[tone], className)}
      style={style}
    >
      {children}
    </span>
  );
}
