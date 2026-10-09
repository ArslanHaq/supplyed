import type { ProfileReviews } from "@/features/reviews/types";

import { SectionLoader } from "../molecules";

export function PublicProfileReviews({ data, error, loading }: { data?: ProfileReviews; error: Error | null; loading: boolean }) {
  if (loading) return <section className="card card-pad-lg mt-5"><div className="section-title">Reviews</div><SectionLoader rows={2} /></section>;

  return (
    <section className="card card-pad-lg mt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="section-title mb-0">Reviews</div>
        <div className="text-sm font-semibold text-ink">
          {data?.total ? `${data.averageRating?.toFixed(1) ?? "-"} / 5 · ${data.total} ${data.total === 1 ? "review" : "reviews"}` : "No reviews yet"}
        </div>
      </div>
      {error ? <p className="text-sm text-muted">Reviews could not be loaded.</p> : null}
      {!error && !data?.reviews.length ? <p className="text-sm text-muted">Completed booking reviews will appear here.</p> : null}
      {!error && data?.reviews.length ? (
        <div className="divide-y divide-border">
          {data.reviews.map((review) => (
            <article className="py-4 first:pt-0 last:pb-0" key={review.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{review.reviewerName || "Verified marketplace member"}</div>
                <div aria-label={`${review.rating} out of 5 stars`} className="text-sm font-bold text-warning">{review.rating.toFixed(1)} / 5</div>
              </div>
              {review.jobTitle ? <div className="mt-1 text-xs text-muted">{review.jobTitle}</div> : null}
              {review.comment ? <p className="mt-2 text-sm leading-6 text-slate">{review.comment}</p> : null}
              {review.createdAt ? <div className="mt-2 text-xs text-muted">{formatReviewDate(review.createdAt)}</div> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
