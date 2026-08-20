import { useMemo, useState } from "react";

import type { JobListFilters } from "@/features/jobs/types";
import { useJobs } from "@/features/jobs/use-jobs";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, MatchScore, Tag } from "../atoms";
import { SelectDropdown } from "../molecules/OptionDropdowns";
import { PageHead, SectionLoader } from "../molecules";

const pageSize = 8;
const durationOptions = ["Any duration", "Single day", "Multi-day", "Long-term"] as const;
const jobTypeOptions = ["All types", "Instant matching", "Open brief"] as const;

export function FindJobsPage({ go }: Pick<RouteProps, "go">) {
  const [duration, setDuration] = useState<(typeof durationOptions)[number]>("Any duration");
  const [urgency, setUrgency] = useState("All jobs");
  const [keyStage, setKeyStage] = useState("All stages");
  const [location, setLocation] = useState("");
  const [maxPay, setMaxPay] = useState("");
  const [minPay, setMinPay] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All subjects");
  const [type, setType] = useState<(typeof jobTypeOptions)[number]>("All types");
  const filters: JobListFilters = useMemo(() => ({
    duration: readDuration(duration),
    keyStage: keyStage === "All stages" ? undefined : keyStage,
    location,
    maxPay: readPay(maxPay),
    minPay: readPay(minPay),
    mode: type === "Instant matching" ? "instant" : type === "Open brief" ? "brief" : undefined,
    search,
    subject: subject === "All subjects" ? undefined : subject,
    urgent: urgency === "Urgent only" ? true : undefined,
  }), [duration, keyStage, location, maxPay, minPay, search, subject, type, urgency]);
  const jobsQuery = useJobs(filters);
  const jobs = jobsQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageJobs = jobs.slice((activePage - 1) * pageSize, activePage * pageSize);

  return (
    <div className="app-page">
      <PageHead title="Find jobs" subtitle={`${jobs.length} open roles near you - ranked by match score`} />
      <div className="mb-5 grid gap-3 rounded-xl border border-border bg-white p-3 shadow-(--shadow-xs) md:grid-cols-3 xl:grid-cols-4">
        <Field label="Search">
          <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-white px-3.5 py-2.5">
            <Icon name="search" size={16} />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent outline-none"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Title, school, subject..."
              value={search}
            />
          </div>
        </Field>
        <Field label="Role type">
          <SelectDropdown
            options={["All jobs", "Urgent only"]}
            value={urgency}
            onChange={(value) => {
              setUrgency(value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Posting type">
          <SelectDropdown
            options={[...jobTypeOptions]}
            value={type}
            onChange={(value) => {
              setType(value as (typeof jobTypeOptions)[number]);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Duration">
          <SelectDropdown
            options={[...durationOptions]}
            value={duration}
            onChange={(value) => {
              setDuration(value as (typeof durationOptions)[number]);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Key stage">
          <SelectDropdown
            options={["All stages", "KS1", "KS2", "KS3", "KS4", "KS5"]}
            value={keyStage}
            onChange={(value) => {
              setKeyStage(value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Subject">
          <SelectDropdown
            options={["All subjects", "Maths", "English", "Science", "All Primary"]}
            value={subject}
            onChange={(value) => {
              setSubject(value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Location">
          <input
            className="input"
            onChange={(event) => {
              setLocation(event.target.value);
              setPage(1);
            }}
            placeholder="City or postcode"
            value={location}
          />
        </Field>
        <Field label="Min pay">
          <input
            className="input"
            inputMode="decimal"
            onChange={(event) => {
              setMinPay(event.target.value);
              setPage(1);
            }}
            placeholder="£"
            value={minPay}
          />
        </Field>
        <Field label="Max pay">
          <input
            className="input"
            inputMode="decimal"
            onChange={(event) => {
              setMaxPay(event.target.value);
              setPage(1);
            }}
            placeholder="£"
            value={maxPay}
          />
        </Field>
      </div>
      <div className="two-col">
        <div className="flex flex-col gap-3">
          {jobsQuery.isLoading ? <SectionLoader rows={3} /> : null}
          {!jobsQuery.isLoading && jobs.length > 0 ? (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>Showing {(activePage - 1) * pageSize + 1}-{Math.min(activePage * pageSize, jobs.length)} of {jobs.length}</span>
              <div className="flex gap-2">
                <Btn disabled={activePage <= 1} size="sm" variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Btn>
                <Btn disabled={activePage >= totalPages} size="sm" variant="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Btn>
              </div>
            </div>
          ) : null}
          {pageJobs.map((job) => (
            <div key={job.id} className="card card-pad-lg flex cursor-pointer flex-wrap items-center gap-5" onClick={() => go("job-detail", { jobId: job.id })}>
              <div className="flex-1">
                <div className="mb-1.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><span className="text-xs text-muted">Posted {job.postedAt}</span></div>
                <div className="mb-1 font-serif text-xl">{job.title}</div>
                <div className="mb-3 text-[15px] text-muted">{job.school} - {job.city} - {job.date}</div>
                <div className="flex flex-wrap gap-4 text-xs text-muted"><div className="flex items-center gap-1"><Icon name="pound" size={12} />£{job.rate}/day</div><div className="flex items-center gap-1"><Icon name="users" size={12} />{job.applicants} applied</div><div className="flex items-center gap-1"><Icon name="pin" size={12} />4.2 mi</div></div>
              </div>
              <div className="flex flex-col items-end gap-2.5"><MatchScore score={job.matchScore} /><Btn size="sm">{job.mode === "instant" ? "Accept" : "Apply"}</Btn></div>
            </div>
          ))}
          {!jobsQuery.isLoading && jobs.length === 0 ? (
            <div className="card card-pad text-muted">No jobs match these filters.</div>
          ) : null}
        </div>
        <div className="card card-pad">
          <div className="eyebrow mb-2.5">Map view</div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-gradient-to-br from-[var(--se-tint)] to-[var(--chalk)]">
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

function readDuration(value: (typeof durationOptions)[number]): JobListFilters["duration"] {
  if (value === "Single day") return "single-day";
  if (value === "Multi-day") return "multi-day";
  if (value === "Long-term") return "long-term";
  return undefined;
}

function readPay(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
