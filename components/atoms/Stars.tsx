export function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-warning" role="img">
      {"★".repeat(Math.floor(rating))}
      <span className="text-border">{"★".repeat(5 - Math.floor(rating))}</span>
    </span>
  );
}
