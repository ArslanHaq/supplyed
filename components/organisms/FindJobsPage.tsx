import { DynamicSelect } from "@/components/molecules/DynamicDropdown";
import { CatalogueSubjectFilter } from "@/components/molecules/TeachingSelectionFields";
import { useCallback, useEffect, useState } from "react";

import type { JobListFilters } from "@/features/jobs/types";
import { useJobs } from "@/features/jobs/use-jobs";
import { useRecommendedJobs } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field } from "../atoms";
import { JobListingPreview, jobListingPreviewData, MatchScorePanel, PageHead, SectionLoader } from "../molecules";
import { WorkspaceEmptyState } from "./WorkspacePanels";
import { JobsMap } from "./JobsMap";

export function FindJobsPage({ go }: Pick<RouteProps, "go">) {
  const [tab, setTab] = useState<"recommended" | "all">("recommended");
  const [page, setPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [minScore, setMinScore] = useState(0);
  const [scoreInput, setScoreInput] = useState("0");
  const [scoreError, setScoreError] = useState<string>();
  const [urgency, setUrgency] = useState("All jobs");
  const [keyStage, setKeyStage] = useState("All stages");
  const [subject, setSubject] = useState("");
  const [appliedSubject, setAppliedSubject] = useState("");
  const filters: JobListFilters = {
    keyStage: keyStage === "All stages" ? undefined : keyStage,
    limit: 20,
    page: allPage,
    subject: appliedSubject || undefined,
    urgent: urgency === "Urgent only" ? true : undefined,
  };
  const jobsQuery = useJobs(filters, tab === "all");
  const jobs = jobsQuery.data?.jobs ?? [];
  const allPagination = jobsQuery.data?.pagination;
  const recommendedQuery = useRecommendedJobs({ limit: 20, minScore, page }, tab === "recommended");
  const recommendedJobs = recommendedQuery.data?.jobs ?? [];
  const activeCount = tab === "recommended" ? recommendedQuery.data?.pagination.total ?? recommendedJobs.length : allPagination?.total ?? 0;
  const activeLoading = tab === "recommended" ? recommendedQuery.isLoading : jobsQuery.isLoading;
  const activeError = tab === "recommended" ? recommendedQuery.error : jobsQuery.error;
  const activeJobs = tab === "recommended" ? recommendedJobs.map(({ job }) => job) : jobs;
  const openJob = useCallback((jobId: string) => go("job-detail", { jobId }), [go]);

  useEffect(() => {
    const score = Number(scoreInput);
    if (!Number.isFinite(score) || score < 0 || score > 100) return;
    const timer = window.setTimeout(() => {
      setMinScore(score);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [scoreInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSubject(subject), 350);
    return () => window.clearTimeout(timer);
  }, [subject]);

  return (
    <div className="app-page discovery-page jobs-discovery">
      <PageHead title="Find jobs" subtitle={`${activeCount} ${tab === "recommended" ? "matched" : "open"} roles`} />
      <div className="workspace-toolbar jobs-view-toolbar mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 shadow-(--shadow-xs)">
        <div className="jobs-view-tabs flex items-center gap-2" role="group" aria-label="Job results">
          <Btn aria-pressed={tab === "recommended"} size="sm" variant={tab === "recommended" ? "secondary" : "ghost"} onClick={() => setTab("recommended")}>For you</Btn>
          <Btn aria-pressed={tab === "all"} size="sm" variant={tab === "all" ? "secondary" : "ghost"} onClick={() => setTab("all")}>All jobs</Btn>
        </div>
        {tab === "recommended" ? <div className="jobs-score-filter ml-auto"><label className="flex items-center gap-2 text-xs font-semibold">Minimum score<input aria-describedby={scoreError ? "job-score-error" : undefined} aria-invalid={Boolean(scoreError)} className="input w-24" min={0} max={100} type="number" value={scoreInput} onChange={(event) => {
          const input = event.target.value;
          setScoreInput(input);
          const score = Number(input);
          if (!Number.isFinite(score) || score < 0 || score > 100) { setScoreError("Enter a score between 0 and 100."); return; }
          setScoreError(undefined);
        }} /></label>{scoreError ? <p className="mt-1 text-xs text-danger" id="job-score-error" role="alert">{scoreError}</p> : null}</div> : null}
      </div>
      {tab === "all" ? <div className="workspace-filter-panel mb-5 grid gap-3 rounded-xl border border-border bg-surface p-3 shadow-(--shadow-xs) md:grid-cols-3">
        <Field label="Role type">
          <DynamicSelect
            collection="discoveryUrgency" emptyLabel="All jobs"
            value={urgency === "Urgent only" ? "true" : ""}
            onChange={(value) => { setUrgency(value === "true" ? "Urgent only" : "All jobs"); setAllPage(1); }}
          />
        </Field>
        <Field label="Key stage">
          <DynamicSelect
            collection="keyStage" emptyLabel="All stages"
            value={keyStage === "All stages" ? "" : keyStage}
            onChange={(value) => { setKeyStage(value || "All stages"); setAllPage(1); }}
          />
        </Field>
        <Field label="Subject">
          <CatalogueSubjectFilter value={subject} onChange={value => { setSubject(value); setAllPage(1); }} />
        </Field>
      </div> : null}
      <div className="jobs-discovery-grid">
        <section className="jobs-results flex flex-col gap-4" aria-label={tab === "recommended" ? "Recommended jobs" : "All jobs"}>
          {activeLoading ? <SectionLoader rows={3} /> : null}
          {activeError ? <div className="card card-pad text-center" role="alert"><div className="font-semibold">Jobs could not be loaded</div><p className="mt-1 text-sm text-muted">{activeError.message}</p></div> : null}
          {tab === "all" ? jobs.map((job) => (
            <JobListingPreview
              key={job.id}
              action={<Btn aria-label={`View and apply for ${job.title}`} iconRight="arrowRight" size="sm" onClick={() => go("job-detail", { jobId: job.id })}>View &amp; apply</Btn>}
              data={jobListingPreviewData(job, { label: "Open role", tone: "green" })}
              onOpen={() => go("job-detail", { jobId: job.id })}
            />
          )) : recommendedJobs.map(({ job, match }) => (
            <JobListingPreview
              key={job.id}
              action={<Btn aria-label={`View and apply for ${job.title}`} iconRight="arrowRight" size="sm" onClick={() => go("job-detail", { jobId: job.id })}>View &amp; apply</Btn>}
              data={jobListingPreviewData(job, { label: `${match.score}% match`, tone: "green" })}
              match={<MatchScorePanel match={match} />}
              onOpen={() => go("job-detail", { jobId: job.id })}
            />
          ))}
          {!activeLoading && !activeError && activeCount === 0 ? (
            <WorkspaceEmptyState icon="search" title="No jobs match these filters" message="Try a different subject, key stage, or match score to discover more opportunities." />
          ) : null}
          {tab === "all" && allPagination && allPagination.totalPages > 1 ? <div className="flex items-center justify-between"><Btn disabled={allPage <= 1 || jobsQuery.isFetching} variant="secondary" onClick={() => setAllPage((value) => Math.max(1, value - 1))}>Previous</Btn><span className="text-sm text-muted">Page {allPagination.page} of {allPagination.totalPages}</span><Btn disabled={!allPagination.hasNextPage || jobsQuery.isFetching} variant="secondary" onClick={() => setAllPage((value) => value + 1)}>Next</Btn></div> : null}
          {tab === "recommended" && (recommendedQuery.data?.pagination.totalPages ?? 0) > 1 ? <div className="flex items-center justify-between"><Btn disabled={page <= 1 || recommendedQuery.isFetching} variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn><span className="text-sm text-muted">Page {page} of {recommendedQuery.data?.pagination.totalPages}</span><Btn disabled={!recommendedQuery.data?.pagination.hasNextPage || recommendedQuery.isFetching} variant="secondary" onClick={() => setPage((value) => value + 1)}>Next</Btn></div> : null}
        </section>
        {!activeLoading && !activeError && activeJobs.length > 0 ? <JobsMap key={activeJobs.map((job) => job.id).join(":")} jobs={activeJobs} onOpen={openJob} /> : null}
      </div>
    </div>
  );
}
