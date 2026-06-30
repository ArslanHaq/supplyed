import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

type TagTone = "" | "green" | "amber" | "red" | "purple" | "ghost";

const toneClass: Record<TagTone, string> = {
  "": "bg-[var(--se-tint)] text-[var(--se)]",
  green: "bg-[var(--green-tint)] text-[var(--green)]",
  amber: "bg-[var(--amber-tint)] text-[var(--amber)]",
  red: "bg-[var(--red-tint)] text-[var(--red)]",
  purple: "bg-[var(--purple-tint)] text-[var(--purple)]",
  ghost: "border border-[var(--border)] bg-[var(--chalk)] text-[var(--slate)]",
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
