import type { ProfileReviews } from "@/features/reviews/types";

import { Avatar, Icon } from "../atoms";
import { SectionLoader } from "../molecules";

export function ProfileReviewsPanel({ data, error, loading }: { data?: ProfileReviews; error: Error | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-5 sm:px-7"><SectionHeading /></div>
        <div className="p-5 sm:p-7"><SectionLoader rows={2} /></div>
      </section>
    );
  }

  const reviews = data?.reviews ?? [];
  const average = data?.averageRating ?? 0;
  const total = data?.total ?? 0;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({ count: reviews.filter((review) => Math.round(review.rating) === rating).length, rating }));

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-border bg-surface-subtle px-5 py-5 sm:px-7"><SectionHeading /></div>
      {error ? (
        <div className="p-5 sm:p-7"><div className="flex items-center gap-3 rounded-xl border border-border bg-chalk p-4 text-sm text-muted"><Icon name="help" size={19} />Reviews could not be loaded right now.</div></div>
      ) : null}
      {!error && total === 0 ? (
        <div className="p-5 sm:p-7">
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-chalk px-5 py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-warning-tint text-warning"><Icon name="star" size={23} /></div>
            <h3 className="mt-4 text-base font-semibold text-ink">No reviews yet</h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted">Feedback from completed SupplyEd bookings will appear here.</p>
          </div>
        </div>
      ) : null}
      {!error && total > 0 ? (
        <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="border-b border-border p-5 sm:p-7 lg:border-r lg:border-b-0">
            <div className="text-center">
              <div className="font-heading text-5xl font-semibold tracking-tight text-ink">{average.toFixed(1)}</div>
              <RatingStars className="mt-2 justify-center" rating={average} size={19} />
              <p className="mt-2 text-sm text-muted">Based on {total} verified {total === 1 ? "review" : "reviews"}</p>
            </div>
            <div className="mt-6 space-y-2.5">
              {distribution.map(({ count, rating }) => (
                <div className="grid grid-cols-[20px_1fr_24px] items-center gap-2 text-xs text-muted" key={rating}>
                  <span>{rating}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-warning" style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} /></div>
                  <span className="text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {reviews.map((review) => (
              <article className="p-5 sm:p-7" key={review.id}>
                <div className="flex items-start gap-3.5">
                  <Avatar name={review.reviewerName || "SupplyEd member"} size="md" tone="amber" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-ink">{review.reviewerName || "Verified marketplace member"}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-success"><Icon name="checkCircle" size={13} />Verified booking</div>
                      </div>
                      <div className="flex flex-col items-end gap-1"><RatingStars rating={review.rating} size={15} /><span className="text-xs font-semibold text-slate">{review.rating.toFixed(1)} / 5</span></div>
                    </div>
                    {review.jobTitle ? <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-chalk px-2.5 py-1 text-xs text-slate"><Icon name="file" size={12} />{review.jobTitle}</div> : null}
                    {review.comment ? <p className="mt-3 text-sm leading-7 text-slate">“{review.comment}”</p> : null}
                    {review.createdAt ? <div className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Icon name="calendar" size={12} />{formatReviewDate(review.createdAt)}</div> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SectionHeading() {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-warning-tint text-warning"><Icon name="star" size={20} /></div><div><h2 className="font-heading text-lg font-semibold text-ink">Reviews and ratings</h2><p className="mt-0.5 text-xs text-muted">Feedback from verified SupplyEd bookings</p></div></div>;
}

export function RatingStars({ className = "", rating, size = 16 }: { className?: string; rating: number; size?: number }) {
  const rounded = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <span aria-label={`${rating.toFixed(1)} out of 5 stars`} className={`inline-flex items-center gap-0.5 ${className}`} role="img">
      {Array.from({ length: 5 }, (_, index) => <span className={index < rounded ? "text-warning" : "text-border-strong"} key={index}><svg aria-hidden="true" fill="currentColor" height={size} viewBox="0 0 24 24" width={size}><path d="m12 2.2 2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.02l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.2Z" /></svg></span>)}
    </span>
  );
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
