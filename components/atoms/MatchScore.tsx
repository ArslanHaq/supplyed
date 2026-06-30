import { cn } from "@/lib/cn";

export function MatchScore({ score, size = 48 }: { score: number; size?: number }) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
        score >= 85
          ? "border-[var(--se-tint-2)] bg-[var(--se-tint)] text-[var(--se)]"
          : score >= 70
            ? "border-[var(--amber-tint)] bg-[var(--amber-tint)] text-[var(--amber)]"
            : "border-[var(--red-tint)] bg-[var(--red-tint)] text-[var(--red)]",
      )}
      style={{ width: size, height: size }}
    >
      {score}%
    </div>
  );
}
