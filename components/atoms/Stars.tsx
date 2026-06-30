export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-[var(--amber)]">
      {"★".repeat(Math.floor(rating))}
      <span className="text-[var(--border)]">{"★".repeat(5 - Math.floor(rating))}</span>
    </span>
  );
}
