"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { defaultState } from "@/data/supplyed";
import { buildAppHref } from "@/lib/routes";
import type { GoFn } from "@/types/supplyed";
import { FindJobsPage } from "./FindJobsPage";
import { JobDetailPage } from "./JobDetailPage";
export function PublicJobsBrowser({ page }: { page: "find-jobs" | "job-detail" }) {
  const router = useRouter();
  const search = useSearchParams();
  const go: GoFn = (target, ctx) => router.push(buildAppHref(target, ctx));
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-6 py-4">
        <Link href="/" className="font-serif text-2xl text-brand">
          SupplyED
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/find-jobs">Browse jobs</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/onboarding">Complete your profile</Link>
        </div>
      </header>
      {page === "find-jobs" ? (
        <FindJobsPage go={go} />
      ) : (
        <JobDetailPage
          go={go}
          ctx={{ jobId: search.get("jobId") ?? undefined }}
          state={{ ...defaultState, isFullyVerified: false }}
          toast={() => {}}
        />
      )}
    </>
  );
}
