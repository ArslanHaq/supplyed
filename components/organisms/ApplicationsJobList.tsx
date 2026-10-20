import type { Invitation } from "@/features/invitations/types";
import { useAllInvitations } from "@/features/invitations/use-invitations";
import { effectiveInvitationStatus } from "@/features/invitations/schemas";
import { formatJobVisibilityLabel, getJobVisibilityLabel } from "@/features/jobs/listing-window";
import type { Job } from "@/features/jobs/types";
import { useMyJobs } from "@/features/jobs/use-jobs";

import { Btn, Icon, Tag } from "../atoms";
import { SectionLoader } from "../molecules";
import { WorkspaceEmptyState } from "./WorkspacePanels";

export type ApplicationsJobFilter = "ACTIVE" | "INVITED";
type InvitationSummary = { job: Job; pending: number; total: number };

export function ApplicationsJobList({ filter, onFilterChange, onOpenJob, onPageChange, page }: {
  filter: ApplicationsJobFilter;
  onFilterChange: (filter: ApplicationsJobFilter) => void;
  onOpenJob: (jobId: string) => void;
  onPageChange: (page: number) => void;
  page: number;
}) {
  const jobsQuery = useMyJobs({ limit: 6, page, status: "ACTIVE" });
  const invitationsQuery = useAllInvitations();
  const invitationSummaries = summarizeInvitedJobs(invitationsQuery.data ?? []);
  const invitationByJob = new Map(invitationSummaries.map((item) => [item.job.id, item]));
  const invitedStartIndex = (page - 1) * 6;
  const invitedTotal = invitationSummaries.length;
  const invitedJobs = invitationSummaries.slice(invitedStartIndex, invitedStartIndex + 6).map((item) => item.job);
  const jobs = filter === "INVITED" ? invitedJobs : jobsQuery.data?.jobs ?? [];
  const pagination = filter === "INVITED" ? {
    hasNextPage: invitedStartIndex + 6 < invitedTotal,
    limit: 6,
    page,
    total: invitedTotal,
    totalPages: Math.ceil(invitedTotal / 6),
  } : jobsQuery.data?.pagination;
  const currentPage = pagination?.page ?? page;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const total = pagination?.total ?? jobs.length;
  const start = jobs.length ? (currentPage - 1) * (pagination?.limit ?? 6) + 1 : 0;
  const end = jobs.length ? Math.min(total, start + jobs.length - 1) : 0;
  const loading = filter === "INVITED" ? invitationsQuery.isLoading : jobsQuery.isLoading;
  const fetching = filter === "INVITED" ? invitationsQuery.isFetching : jobsQuery.isFetching;
  const error = filter === "INVITED" ? invitationsQuery.error : jobsQuery.error;

  if (loading) return <SectionLoader rows={4} />;
  if (error) {
    return <WorkspaceEmptyState
      action={<Btn variant="secondary" onClick={() => void (filter === "INVITED" ? invitationsQuery.refetch() : jobsQuery.refetch())}>Try again</Btn>}
      icon="file"
      message={error.message || "Your jobs could not be loaded. Please try again."}
      title="Jobs unavailable"
    />;
  }

  if (!jobs.length && total === 0) {
    return <section className="card overflow-hidden">
      <JobFilterHeader activeTotal={jobsQuery.data?.pagination.total ?? 0} filter={filter} invitedTotal={invitedTotal} onFilterChange={onFilterChange} />
      <WorkspaceEmptyState
        icon="file"
        message={filter === "INVITED" ? "Jobs appear here after your school sends at least one teacher invitation." : "Publish a job to start receiving teacher applications. Your active jobs will appear here first."}
        title={filter === "INVITED" ? "No invited jobs yet" : "No active jobs yet"}
      />
    </section>;
  }

  return (
    <section aria-busy={fetching} aria-label={filter === "INVITED" ? "Invited jobs" : "Active jobs"} className="applications-job-list card overflow-hidden">
      <div className="applications-job-list-heading">
        <div>
          <h2>{filter === "INVITED" ? "Invited jobs" : "Active jobs"}</h2>
          <p>{filter === "INVITED" ? "Jobs where your school has directly invited at least one teacher." : "Open a job to see everyone who has applied."}</p>
        </div>
        <Tag tone={filter === "INVITED" ? "purple" : "green"}>{total} {filter === "INVITED" ? "invited" : "active"} {total === 1 ? "job" : "jobs"}</Tag>
      </div>
      <JobFilterHeader activeTotal={jobsQuery.data?.pagination.total ?? 0} filter={filter} invitedTotal={invitedTotal} onFilterChange={onFilterChange} />
      {filter === "ACTIVE" && invitationsQuery.error ? <p className="border-b border-border bg-amber-50 px-5 py-3 text-xs text-amber-900" role="status">Invitation tags are temporarily unavailable. Active jobs are still shown.</p> : null}
      <div>
        {jobs.map((job) => <ApplicationJobRow invitation={invitationByJob.get(job.id)} job={job} key={job.id} onOpen={() => onOpenJob(job.id)} />)}
        {!jobs.length ? <p className="p-6 text-sm text-muted">No jobs on this page. Choose a previous page to continue.</p> : null}
      </div>
      {pagination ? (
        <div className="job-pagination">
          <p aria-live="polite" className="job-pagination-summary">
            {fetching ? "Loading jobs…" : jobs.length ? `Showing ${start}–${end} of ${total} ${total === 1 ? "job" : "jobs"}` : "No jobs on this page"}
          </p>
          <nav aria-label="Application job pages" className="job-pagination-controls">
            <Btn disabled={fetching || currentPage <= 1} icon="arrowLeft" onClick={() => onPageChange(currentPage - 1)} size="sm" variant="secondary">Previous</Btn>
            <span className="applications-job-page-number">Page {currentPage} of {totalPages}</span>
            <Btn disabled={fetching || !pagination.hasNextPage || currentPage >= totalPages} iconRight="arrow" onClick={() => onPageChange(currentPage + 1)} size="sm" variant="secondary">Next</Btn>
          </nav>
        </div>
      ) : null}
    </section>
  );
}

function JobFilterHeader({ activeTotal, filter, invitedTotal, onFilterChange }: {
  activeTotal: number;
  filter: ApplicationsJobFilter;
  invitedTotal: number;
  onFilterChange: (filter: ApplicationsJobFilter) => void;
}) {
  return <div className="flex flex-wrap gap-2 border-b border-border bg-chalk px-5 py-3" role="group" aria-label="Filter application jobs">
    <Btn aria-pressed={filter === "ACTIVE"} size="sm" variant={filter === "ACTIVE" ? "secondary" : "ghost"} onClick={() => onFilterChange("ACTIVE")}>Active jobs ({activeTotal})</Btn>
    <Btn aria-pressed={filter === "INVITED"} size="sm" variant={filter === "INVITED" ? "secondary" : "ghost"} onClick={() => onFilterChange("INVITED")}>Invited ({invitedTotal})</Btn>
  </div>;
}

function ApplicationJobRow({ invitation, job, onOpen }: { invitation?: InvitationSummary; job: Job; onOpen: () => void }) {
  const location = [job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC";
  const pay = !job.rate ? "Rate TBC" : `GBP ${job.rate}${job.payType === "hourly" ? "/hr" : job.payType === "fixed" ? " fixed" : "/day"}`;
  const visibility = getJobVisibilityLabel(job);

  return (
    <article className="applications-job-row">
      <span aria-hidden="true" className="applications-job-icon"><Icon name="file" size={22} /></span>
      <div className="applications-job-copy">
        <div className="applications-job-status">
          <Tag tone={visibility === "live" ? "green" : visibility === "scheduled" || visibility === "draft" ? "amber" : "ghost"}>{formatJobVisibilityLabel(visibility)}</Tag>
          {invitation ? <Tag tone="purple">Invited · {invitation.total}{invitation.pending ? ` · ${invitation.pending} pending` : ""}</Tag> : null}
          {job.subject ? <span>{job.subject}</span> : null}
        </div>
        <h3>{job.title}</h3>
        <div className="applications-job-meta">
          <span><Icon name="pin" size={14} />{location}</span>
          <span><Icon name="calendar" size={14} />{job.date}</span>
          <span>{pay}</span>
        </div>
      </div>
      <Btn aria-label={`View applications for ${job.title}`} iconRight="arrow" onClick={onOpen}>View applications</Btn>
    </article>
  );
}

export function summarizeInvitedJobs(invitations: Invitation[]): InvitationSummary[] {
  const byJob = new Map<string, InvitationSummary>();
  for (const invitation of invitations) {
    if (!invitation.job?.id) continue;
    const current = byJob.get(invitation.job.id);
    if (current) {
      current.total += 1;
      if (effectiveInvitationStatus(invitation) === "PENDING") current.pending += 1;
      continue;
    }
    byJob.set(invitation.job.id, { total: 1, pending: effectiveInvitationStatus(invitation) === "PENDING" ? 1 : 0, job: invitationJobSnapshot(invitation) });
  }
  return [...byJob.values()].sort((left, right) => left.job.title.localeCompare(right.job.title));
}

function invitationJobSnapshot(invitation: Invitation): Job {
  const job = invitation.job;
  const start = job.startDate && Number.isFinite(Date.parse(job.startDate)) ? new Date(job.startDate) : null;
  const end = job.endDate && Number.isFinite(Date.parse(job.endDate)) ? new Date(job.endDate) : null;
  const display = (value: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(value);
  const date = start && end ? (display(start) === display(end) ? display(start) : `${display(start)} - ${display(end)}`) : start ? display(start) : end ? `Until ${display(end)}` : "Date TBC";
  const statuses = ["ACTIVE", "CLOSED", "DRAFT", "EXPIRED", "SUSPENDED"] as const;
  const status = statuses.find((value) => value === invitation.jobStatus) ?? "DRAFT";
  const payAmount = Number(job.payAmount ?? 0);
  const rate = Number.isFinite(payAmount) ? payAmount : 0;
  return {
    id: job.id,
    address: job.address ?? null,
    city: job.city || "Location TBC",
    countryCode: job.countryCode || "GB",
    county: job.county ?? null,
    createdAt: invitation.createdAt ?? null,
    date,
    description: job.description,
    endDate: job.endDate ?? null,
    expiresAt: null,
    liveFrom: null,
    keyStage: job.keyStages?.[0] ?? "All stages",
    keyStages: job.keyStages ?? [],
    institution: null,
    latitude: job.latitude ?? null,
    longitude: job.longitude ?? null,
    minExperienceYears: job.minExperienceYears ?? null,
    mode: "instant",
    parkingInfo: job.parkingInfo ?? null,
    payAmount: rate,
    payType: job.payType ?? null,
    postedAt: "Invitation sent",
    postedByUserId: "",
    postalCode: job.postalCode ?? null,
    rate,
    requiredSkills: job.requiredSkills ?? [],
    school: invitation.institution.name || "Hiring account",
    startDate: job.startDate ?? null,
    status,
    subject: job.subjects?.join(", ") || job.subject || "General cover",
    subjects: job.subjects,
    title: job.title,
    updatedAt: invitation.updatedAt ?? null,
    urgent: false,
  };
}
