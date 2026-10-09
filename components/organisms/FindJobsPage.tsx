import { useState } from "react";

import type { JobListFilters } from "@/features/jobs/types";
import { useJobs } from "@/features/jobs/use-jobs";
import { useRecommendedJobs } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, Tag } from "../atoms";
import { SelectDropdown } from "../molecules/OptionDropdowns";
import { MatchScorePanel, PageHead, SectionLoader } from "../molecules";
import { WorkspaceEmptyState } from "./WorkspacePanels";

export function FindJobsPage({ go }: Pick<RouteProps, "go">) {
  const [tab, setTab] = useState<"recommended" | "all">("recommended");
  const [page, setPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [minScore, setMinScore] = useState(0);
  const [urgency, setUrgency] = useState("All jobs");
  const [keyStage, setKeyStage] = useState("All stages");
  const [subject, setSubject] = useState("All subjects");
  const filters: JobListFilters = {
    keyStage: keyStage === "All stages" ? undefined : keyStage,
    limit: 20,
    page: allPage,
    subject: subject === "All subjects" ? undefined : subject,
    urgent: urgency === "Urgent only" ? true : undefined,
  };
  const jobsQuery = useJobs(filters);
  const jobs = jobsQuery.data?.jobs ?? [];
  const allPagination = jobsQuery.data?.pagination;
  const recommendedQuery = useRecommendedJobs({ limit: 20, minScore, page });
  const recommendedJobs = recommendedQuery.data?.jobs ?? [];
  const activeCount = tab === "recommended" ? recommendedQuery.data?.pagination.total ?? recommendedJobs.length : allPagination?.total ?? 0;
  const activeLoading = tab === "recommended" ? recommendedQuery.isLoading : jobsQuery.isLoading;
  const activeError = tab === "recommended" ? recommendedQuery.error : jobsQuery.error;

  return (
    <div className="app-page discovery-page jobs-discovery">
      <PageHead title="Find jobs" subtitle={`${activeCount} ${tab === "recommended" ? "matched" : "open"} roles`} />
      <div className="workspace-toolbar mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3 shadow-(--shadow-xs)">
        <Btn aria-pressed={tab === "recommended"} size="sm" variant={tab === "recommended" ? "secondary" : "ghost"} onClick={() => setTab("recommended")}>For you</Btn>
        <Btn aria-pressed={tab === "all"} size="sm" variant={tab === "all" ? "secondary" : "ghost"} onClick={() => setTab("all")}>All jobs</Btn>
        {tab === "recommended" ? <label className="ml-auto flex items-center gap-2 text-xs font-semibold">Minimum score<input className="input w-24" min={0} max={100} type="number" value={minScore} onChange={(event) => { setMinScore(Math.min(100, Math.max(0, Number(event.target.value) || 0))); setPage(1); }} /></label> : null}
      </div>
      {tab === "all" ? <div className="workspace-filter-panel mb-5 grid gap-3 rounded-xl border border-border bg-white p-3 shadow-(--shadow-xs) md:grid-cols-3">
        <Field label="Role type">
          <SelectDropdown
            options={["All jobs", "Urgent only"]}
            value={urgency}
            onChange={(value) => { setUrgency(value); setAllPage(1); }}
          />
        </Field>
        <Field label="Key stage">
          <SelectDropdown
            options={["All stages", "KS1", "KS2", "KS3", "KS4", "KS5"]}
            value={keyStage}
            onChange={(value) => { setKeyStage(value); setAllPage(1); }}
          />
        </Field>
        <Field label="Subject">
          <SelectDropdown
            options={["All subjects", "Maths", "English", "Science", "All Primary"]}
            value={subject}
            onChange={(value) => { setSubject(value); setAllPage(1); }}
          />
        </Field>
      </div> : null}
      <div className="two-col">
        <div className="flex flex-col gap-3">
          {activeLoading ? <SectionLoader rows={3} /> : null}
          {activeError ? <div className="card card-pad text-center" role="alert"><div className="font-semibold">Jobs could not be loaded</div><p className="mt-1 text-sm text-muted">{activeError.message}</p></div> : null}
          {tab === "all" ? jobs.map((job) => (
            <div key={job.id} className="job-result-card card card-pad-lg flex cursor-pointer flex-wrap items-center gap-5" onClick={() => go("job-detail", { jobId: job.id })}>
              <div className="flex-1">
                <div className="mb-1.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><span className="text-xs text-muted">Posted {job.postedAt}</span></div>
                <div className="mb-1 font-heading text-xl">{job.title}</div>
                <div className="mb-3 text-[15px] text-muted">{job.school} - {[job.city, job.county, job.postalCode].filter(Boolean).join(", ")} - {job.date}</div>
                <div className="mb-3 flex flex-wrap gap-1">{job.requiredSkills.map((skill) => <span key={skill} className="pill">{skill}</span>)}{job.minExperienceYears != null ? <span className="pill">{job.minExperienceYears}+ years</span> : null}</div>
                <div className="flex flex-wrap gap-4 text-xs text-muted"><div className="flex items-center gap-1"><Icon name="pound" size={12} />£{job.rate}/day</div></div>
              </div>
              <Btn aria-label={`View ${job.title}`} iconRight="arrowRight" size="sm" onClick={(event) => { event.stopPropagation(); go("job-detail", { jobId: job.id }); }}>View</Btn>
            </div>
          )) : recommendedJobs.map(({ job, match }) => <div key={job.id} className="job-result-card card card-pad-lg cursor-pointer" onClick={() => go("job-detail", { jobId: job.id })}><div className="mb-4 flex flex-wrap items-start gap-4"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone="ghost">{job.keyStage}</Tag>{job.requiredSkills.slice(0, 3).map((skill) => <Tag key={skill} tone="ghost">{skill}</Tag>)}</div><div className="font-heading text-xl">{job.title}</div><div className="text-sm text-muted">{[job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC"} · {job.date}{job.minExperienceYears != null ? ` · ${job.minExperienceYears}+ years experience` : ""}</div></div><div className="text-right"><div className="font-heading text-lg">£{job.rate}<span className="font-sans text-xs text-muted">/day</span></div><Btn aria-label={`View and apply for ${job.title}`} className="mt-2" iconRight="arrowRight" size="sm" onClick={(event) => { event.stopPropagation(); go("job-detail", { jobId: job.id }); }}>View & apply</Btn></div></div><div onClick={(event) => event.stopPropagation()}><MatchScorePanel match={match} /></div></div>)}
          {!activeLoading && !activeError && activeCount === 0 ? (
            <WorkspaceEmptyState icon="search" title="No jobs match these filters" message="Try a different subject, key stage, or match score to discover more opportunities." />
          ) : null}
          {tab === "all" && allPagination && allPagination.totalPages > 1 ? <div className="flex items-center justify-between"><Btn disabled={allPage <= 1 || jobsQuery.isFetching} variant="secondary" onClick={() => setAllPage((value) => Math.max(1, value - 1))}>Previous</Btn><span className="text-sm text-muted">Page {allPagination.page} of {allPagination.totalPages}</span><Btn disabled={!allPagination.hasNextPage || jobsQuery.isFetching} variant="secondary" onClick={() => setAllPage((value) => value + 1)}>Next</Btn></div> : null}
          {tab === "recommended" && (recommendedQuery.data?.pagination.totalPages ?? 0) > 1 ? <div className="flex items-center justify-between"><Btn disabled={page <= 1 || recommendedQuery.isFetching} variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn><span className="text-sm text-muted">Page {page} of {recommendedQuery.data?.pagination.totalPages}</span><Btn disabled={!recommendedQuery.data?.pagination.hasNextPage || recommendedQuery.isFetching} variant="secondary" onClick={() => setPage((value) => value + 1)}>Next</Btn></div> : null}
        </div>
        <div className="jobs-map-panel sidebar-panel card-pad">
          <div className="sidebar-heading"><span className="flex items-center gap-2"><Icon name="pin" size={17} /> Map view</span></div>
          <div className="jobs-map relative overflow-hidden rounded-lg">
            {[[30, 25], [55, 40], [40, 65], [70, 55]].map(([x, y], index) => {
              const job = jobs[index];
              if (!job) return null;

              return (
                <div key={job.id} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${x}%`, top: `${y}%` }}>
                  <div className="flex h-[26px] w-[26px] -rotate-45 items-center justify-center rounded-[50%_50%_50%_0] text-[9px] font-bold text-white" style={{ background: index === 0 ? "var(--red)" : "var(--se)" }}><span className="rotate-45">£{job.rate}</span></div>
                </div>
              );
            })}
              </div>
        </div>
      </div>
    </div>
  );
}
