export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-warning">
      {"★".repeat(Math.floor(rating))}
      <span className="text-border">{"★".repeat(5 - Math.floor(rating))}</span>
    </span>
  );
}
