import { cn } from "@/lib/cn";

export function MatchScore({ score, size = 48 }: { score: number; size?: number }) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
        score >= 85
          ? "border-brand-tint-2 bg-brand-tint text-brand"
          : score >= 70
            ? "border-warning-tint bg-warning-tint text-warning"
            : "border-danger-tint bg-danger-tint text-danger",
      )}
      style={{ width: size, height: size }}
    >
      {score}%
    </div>
  );
}
