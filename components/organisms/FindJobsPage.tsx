import { formatJobPay } from "@/features/jobs/presentation";
import { useState } from "react";

import type { JobListFilters } from "@/features/jobs/types";
import { useJobs } from "@/features/jobs/use-jobs";
import { useRecommendedJobs } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, Tag } from "../atoms";
import { SelectDropdown } from "../molecules/OptionDropdowns";
import { MatchScorePanel, PageHead, SectionLoader } from "../molecules";

export function FindJobsPage({ go, role }: Pick<RouteProps, "go"> & { role?: RouteProps["role"] }) {
  const [tab, setTab] = useState<"recommended" | "all">(role === "teacher" ? "recommended" : "all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [urgency, setUrgency] = useState("All jobs");
  const [keyStage, setKeyStage] = useState("All stages");
  const [subject, setSubject] = useState("All subjects");
  const filters: JobListFilters = {
    search,
    keyStage: keyStage === "All stages" ? undefined : keyStage,
    subject: subject === "All subjects" ? undefined : subject,
    urgent: urgency === "Urgent only" ? true : undefined,
  };
  const jobsQuery = useJobs(filters);
  const jobs = jobsQuery.data ?? [];
  const recommendedQuery = useRecommendedJobs({ limit: 20, minScore, page }, role === "teacher" && tab === "recommended");
  const recommendedJobs = recommendedQuery.data?.jobs ?? [];
  const activeCount = tab === "recommended" ? recommendedQuery.data?.pagination.total ?? recommendedJobs.length : jobs.length;
  const activeLoading = tab === "recommended" ? recommendedQuery.isLoading : jobsQuery.isLoading;
  const activeError = tab === "recommended" ? recommendedQuery.error : jobsQuery.error;

  return (
    <div className="app-page">
      <PageHead title="Find jobs" subtitle={`${activeCount} ${tab === "recommended" ? "matched" : "open"} roles`} />
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3 shadow-(--shadow-xs)">
        {role === "teacher" ? <Btn size="sm" variant={tab === "recommended" ? "secondary" : "ghost"} onClick={() => setTab("recommended")}>For you</Btn> : null}
        <Btn size="sm" variant={tab === "all" ? "secondary" : "ghost"} onClick={() => setTab("all")}>All jobs</Btn>
        {tab === "recommended" ? <label className="ml-auto flex items-center gap-2 text-xs font-semibold">Minimum score<input className="input w-24" min={0} max={100} type="number" value={minScore} onChange={(event) => { setMinScore(Math.min(100, Math.max(0, Number(event.target.value) || 0))); setPage(1); }} /></label> : null}
      </div>
      {tab === "all" ? <input className="input mb-4" aria-label="Search jobs" placeholder="Search roles, skills or location" value={search} onChange={(event) => setSearch(event.target.value)} /> : null}
      {tab === "all" ? <div className="mb-5 grid gap-3 rounded-xl border border-border bg-white p-3 shadow-(--shadow-xs) md:grid-cols-3">
        <Field label="Role type">
          <SelectDropdown
            options={["All jobs", "Urgent only"]}
            value={urgency}
            onChange={setUrgency}
          />
        </Field>
        <Field label="Key stage">
          <SelectDropdown
            options={["All stages", "KS1", "KS2", "KS3", "KS4", "KS5"]}
            value={keyStage}
            onChange={setKeyStage}
          />
        </Field>
        <Field label="Subject">
          <SelectDropdown
            options={["All subjects", "Maths", "English", "Science", "All Primary"]}
            value={subject}
            onChange={setSubject}
          />
        </Field>
      </div> : null}
      <div className="two-col">
        <div className="flex flex-col gap-3">
          {activeLoading ? <SectionLoader rows={3} /> : null}
          {activeError ? <div className="card card-pad text-center" role="alert"><div className="font-semibold">Jobs could not be loaded</div><p className="mt-1 text-sm text-muted">{activeError.message}</p></div> : null}
          {tab === "all" ? jobs.map((job) => (
            <div key={job.id} className="card card-pad-lg flex cursor-pointer flex-wrap items-center gap-5" onClick={() => go("job-detail", { jobId: job.id })}>
              <div className="flex-1">
                <div className="mb-1.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><span className="text-xs text-muted">Posted {job.postedAt}</span></div>
                <div className="mb-1 font-serif text-xl">{job.title}</div>
                <div className="mb-3 text-[15px] text-muted">{job.school} - {[job.city, job.county, job.postalCode].filter(Boolean).join(", ")} - {job.date}</div>
                <div className="mb-3 flex flex-wrap gap-1">{job.requiredSkills.map((skill) => <span key={skill} className="pill">{skill}</span>)}{job.minExperienceYears != null ? <span className="pill">{job.minExperienceYears}+ years</span> : null}</div>
                <div className="flex flex-wrap gap-4 text-xs text-muted"><div className="flex items-center gap-1"><Icon name="pound" size={12} />{formatJobPay(job)}</div></div>
              </div>
              <Btn size="sm">View</Btn>
            </div>
          )) : recommendedJobs.map(({ job, match }) => <div key={job.id} className="card card-pad-lg cursor-pointer" onClick={() => go("job-detail", { jobId: job.id })}><div className="mb-4 flex flex-wrap items-start gap-4"><div className="min-w-[220px] flex-1"><div className="mb-1 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone="ghost">{job.keyStage}</Tag>{job.requiredSkills.slice(0, 3).map((skill) => <Tag key={skill} tone="ghost">{skill}</Tag>)}</div><div className="font-serif text-xl">{job.title}</div><div className="text-sm text-muted">{[job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC"} · {job.date}{job.minExperienceYears != null ? ` · ${job.minExperienceYears}+ years experience` : ""}</div></div><div className="text-right"><div className="font-serif text-lg">{formatJobPay(job)}</div><Btn className="mt-2" size="sm">View & apply</Btn></div></div><div onClick={(event) => event.stopPropagation()}><MatchScorePanel match={match} /></div></div>)}
          {!activeLoading && !activeError && activeCount === 0 ? (
            <div className="card card-pad text-muted">No jobs match these filters.</div>
          ) : null}
          {tab === "recommended" && (recommendedQuery.data?.pagination.totalPages ?? 0) > 1 ? <div className="flex items-center justify-between"><Btn disabled={page <= 1} variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn><span className="text-sm text-muted">Page {page} of {recommendedQuery.data?.pagination.totalPages}</span><Btn disabled={!recommendedQuery.data?.pagination.hasNextPage} variant="secondary" onClick={() => setPage((value) => value + 1)}>Next</Btn></div> : null}
        </div>
        <div className="card card-pad">
          <div className="eyebrow mb-2.5">Map view</div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-gradient-to-br from-[var(--se-tint)] to-[var(--chalk)]">
            {[[30, 25], [55, 40], [40, 65], [70, 55]].map(([x, y], index) => {
              const job = (tab === "recommended" ? recommendedJobs.map((entry) => entry.job) : jobs)[index];
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
