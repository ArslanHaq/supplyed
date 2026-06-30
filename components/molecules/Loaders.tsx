import { cn } from "@/lib/cn";

type PageLoaderProps = {
  title?: string;
  description?: string;
  compact?: boolean;
};

type SectionLoaderProps = {
  rows?: number;
  className?: string;
};

export function InlineLoader({ label = "Loading" }: { label?: string }) {
  return (
    <span aria-live="polite" className="inline-loader" role="status">
      <span className="inline-loader-mark" />
      <span>{label}</span>
    </span>
  );
}

export function SectionLoader({ rows = 4, className }: SectionLoaderProps) {
  return (
    <div aria-label="Loading section" className={cn("section-loader", className)} role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="section-loader-row">
          <span className="skeleton skeleton-dot" />
          <span className="section-loader-lines">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line short" />
          </span>
          <span className="skeleton skeleton-action" />
        </div>
      ))}
    </div>
  );
}

export function CardGridLoader({ cards = 3, className }: { cards?: number; className?: string }) {
  return (
    <div aria-label="Loading cards" className={cn("card-grid-loader", className)} role="status">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="card-loader">
          <span className="skeleton skeleton-icon" />
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function PageLoader({
  title = "Preparing your SupplyED view",
  description = "Loading the latest workspace state.",
  compact = false,
}: PageLoaderProps) {
  return (
    <main className={cn("page-loader-screen", compact ? "compact" : null)} aria-live="polite" role="status">
      <section className="page-loader-panel">
        <div className="page-loader-head">
          <span className="page-loader-brand-mark" />
          <div>
            <div className="page-loader-title">{title}</div>
            <p className="page-loader-copy">{description}</p>
          </div>
        </div>
        <div className="page-loader-grid">
          <CardGridLoader cards={3} />
          <SectionLoader rows={3} />
        </div>
      </section>
    </main>
  );
}
