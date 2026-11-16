"use client";

import Link from "next/link";
import type { useProfileCompletion } from "@/features/profile-completion/use-profile-completion";
import { Icon } from "../atoms";
import { SectionLoader } from "../molecules";

type CompletionQuery = ReturnType<typeof useProfileCompletion>;

export function ProfileCompletionCard({
  embedded = false,
  query,
}: {
  embedded?: boolean;
  query: CompletionQuery;
}) {
  if (query.isLoading) {
    if (embedded) return <SectionLoader rows={2} />;

    return (
      <section
        className="card card-pad mb-6"
        aria-label="Loading profile completion"
      >
        <SectionLoader rows={2} />
      </section>
    );
  }
  if (query.isError || !query.data) {
    if (embedded) {
      return (
        <div className="rounded-xl border border-warning/20 bg-warning-tint p-3 text-sm" role="alert">
          Profile completion could not be loaded.{" "}
          <button className="font-semibold underline" type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      );
    }

    return (
      <section
        className="mb-6 rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm"
        role="alert"
      >
        Profile completion could not be loaded.{" "}
        <button
          className="font-semibold underline"
          type="button"
          onClick={() => void query.refetch()}
        >
          Try again
        </button>
      </section>
    );
  }

  const completion = query.data;

  if (embedded) {
    return (
      <section aria-labelledby="profile-completion-essentials">
        <div className="teacher-checklist-heading">
          <strong id="profile-completion-essentials">Profile essentials</strong>
          <span>{completion.percentage}% complete</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-chalk" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: completion.percentage + "%" }}
          />
        </div>
        <div className="mt-3">
          {completion.items.map((item) => (
            <Link
              className="teacher-checklist-item"
              data-complete={item.complete}
              href={item.href}
              key={item.id}
            >
              <Icon name={item.complete ? "checkCircle" : "plus"} size={16} />
              <span>{item.label}</span>
              <span className="teacher-add-label">{item.complete ? `${item.weight}%` : `+${item.weight}%`}</span>
            </Link>
          ))}
        </div>
        {completion.role === "INSTITUTION" && !completion.canPostJobs ? (
          <div className="mt-4 rounded-xl border border-warning/20 bg-warning-tint p-3 text-sm">
            <strong className="block">Job posting is locked</strong>
            <span>Connect a bank card with Stripe before posting a role. </span>
            <Link className="font-semibold text-brand underline" href="/billing/payment-method">
              Connect card
            </Link>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="card card-pad-lg mb-7"
      aria-labelledby="profile-completion-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            Account readiness
          </p>
          <h2
            className="mt-1 font-heading text-xl"
            id="profile-completion-title"
          >
            Profile {completion.percentage}% complete
          </h2>
          <p className="mt-1 text-sm text-muted">
            Complete each item to reach 100% and unlock every account
            capability.
          </p>
        </div>
        <strong
          className="text-3xl text-brand"
          aria-label={completion.percentage + " percent complete"}
        >
          {completion.percentage}%
        </strong>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-chalk"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width]"
          style={{ width: completion.percentage + "%" }}
        />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {completion.items.map((item) => (
          <Link
            className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-chalk"
            href={item.href}
            key={item.id}
          >
            <span className={item.complete ? "text-success" : "text-muted"}>
              <Icon name={item.complete ? "checkCircle" : "plus"} size={18} />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">
              {item.label}
            </span>
            <span className="text-xs font-semibold text-muted">
              +{item.weight}%
            </span>
          </Link>
        ))}
      </div>
      {completion.role === "INSTITUTION" && !completion.canPostJobs ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm">
          <span>
            <strong>Job posting is locked.</strong> Connect a bank card with
            Stripe before posting or publishing a role.
          </span>
          <Link
            className="font-semibold text-brand underline"
            href="/billing/payment-method"
          >
            Connect card
          </Link>
        </div>
      ) : null}
    </section>
  );
}
