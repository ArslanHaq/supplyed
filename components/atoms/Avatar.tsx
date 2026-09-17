import { cn } from "@/lib/cn";
import type { Tone } from "@/types/supplyed";

const sizeClass = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
};

const toneClass: Record<Exclude<Tone, "">, string> = {
  purple: "bg-accent-purple-tint text-accent-purple",
  amber: "bg-warning-tint text-warning",
  green: "bg-success-tint text-success",
};

export function Avatar({
  name,
  size = "md",
  src,
  tone = "",
}: {
  name: string;
  size?: keyof typeof sizeClass;
  src?: string | null;
  tone?: Tone;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint font-bold text-brand",
        sizeClass[size],
        tone ? toneClass[tone] : null,
      )}
    >
      {src ? <span aria-hidden="true" className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} /> : initials}
    </div>
  );
}
