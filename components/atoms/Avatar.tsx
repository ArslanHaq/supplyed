import { cn } from "@/lib/cn";
import type { Tone } from "@/types/supplyed";

const sizeClass = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
};

const toneClass: Record<Exclude<Tone, "">, string> = {
  purple: "bg-[var(--purple-tint)] text-[var(--purple)]",
  amber: "bg-[var(--amber-tint)] text-[var(--amber)]",
  green: "bg-[var(--green-tint)] text-[var(--green)]",
};

export function Avatar({ name, size = "md", tone = "" }: { name: string; size?: keyof typeof sizeClass; tone?: Tone }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--se-tint)] font-bold text-[var(--se)]",
        sizeClass[size],
        tone ? toneClass[tone] : null,
      )}
    >
      {initials}
    </div>
  );
}
