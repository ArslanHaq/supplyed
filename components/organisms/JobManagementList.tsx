import { useState } from "react";

import { useJobApplications } from "@/features/applications/use-applications";
import type { Job, JobStatus } from "@/features/jobs/types";
import type { Tone } from "@/types/supplyed";

import { Btn, Icon, Tag } from "../atoms";
import { SectionLoader } from "../molecules";

export type JobStatusFilter = "ALL" | JobStatus;

type JobManagementListProps = {
  actionPending?: boolean;
  emptyActionLabel?: string;
  emptyMessage: string;
  filter: JobStatusFilter;
  jobs: Job[];
  loading?: boolean;
  onApplications: (job: Job) => void;
  onClose: (job: Job) => void;
  onCreate: () => void;
  onDelete: (job: Job) => void;
  onEdit: (job: Job) => void;
  onFilterChange: (filter: JobStatusFilter) => void;
  title: string;
};

const statusFilters: Array<{ label: string; value: JobStatusFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Draft", value: "DRAFT" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Closed", value: "CLOSED" },
];

export function JobManagementList({
  actionPending,
  emptyActionLabel = "Post a job",
  emptyMessage,
  filter,
  jobs,
  loading,
  onApplications,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onFilterChange,
  title,
}: JobManagementListProps) {
  const filteredJobs = filter === "ALL" ? jobs : jobs.filter((job) => job.status === filter);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="section-title mb-0">{title}</div>
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((statusFilter) => {
            const count = statusFilter.value === "ALL" ? jobs.length : jobs.filter((job) => job.status === statusFilter.value).length;
            return (
              <button
                key={statusFilter.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filter === statusFilter.value ? "border-brand bg-brand-tint text-brand" : "border-border bg-white text-slate hover:bg-chalk"
                }`}
                onClick={() => onFilterChange(statusFilter.value)}
                type="button"
              >
                {statusFilter.label} {count}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card overflow-visible">
        {loading ? <div className="p-5"><SectionLoader rows={3} /></div> : null}
        {!loading && filteredJobs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="font-serif text-[22px]">No roles found</div>
            <p className="mx-auto mt-2 max-w-[380px] text-sm leading-6 text-muted">{emptyMessage}</p>
            <Btn className="mt-4" icon="plus" onClick={onCreate}>{emptyActionLabel}</Btn>
          </div>
        ) : null}
        {filteredJobs.map((job) => (
          <JobManagementRow
            key={job.id}
            actionPending={actionPending}
            job={job}
            onApplications={onApplications}
            onClose={onClose}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>
    </>
  );
}

function JobManagementRow({
  actionPending,
  job,
  onApplications,
  onClose,
  onDelete,
  onEdit,
}: {
  actionPending?: boolean;
  job: Job;
  onApplications: (job: Job) => void;
  onClose: (job: Job) => void;
  onDelete: (job: Job) => void;
  onEdit: (job: Job) => void;
}) {
  const canClose = job.status === "ACTIVE" || job.status === "DRAFT";
  const applicationsQuery = useJobApplications(job.id, { limit: 1 });
  const applicantCount = applicationsQuery.data?.pagination.total;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_44px] gap-4 border-b border-border px-5 py-4 transition hover:bg-chalk/60 last:border-b-0 lg:grid-cols-[40px_minmax(0,1fr)_92px_44px] lg:items-center"
      onClick={() => onApplications(job)}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand">
        <Icon name={job.status === "ACTIVE" ? "checkCircle" : job.status === "DRAFT" ? "edit" : "file"} size={18} />
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {job.urgent ? <Tag tone="red">Urgent</Tag> : null}
          <Tag tone={statusTone(job.status)}>{formatJobStatus(job.status)}</Tag>
          <Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag>
          <span className="text-xs text-muted">{job.postedAt}</span>
        </div>
        <div className="break-words text-[15px] font-semibold leading-5">{job.title}</div>
        <div className="mt-0.5 break-words text-xs leading-5 text-muted">{[job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC"} - {job.date} - {formatPay(job)}</div>
        {job.requiredSkills.length || job.minExperienceYears != null ? <div className="mt-1 flex flex-wrap gap-1">{job.requiredSkills.slice(0, 4).map((skill) => <span key={skill} className="pill">{skill}</span>)}{job.minExperienceYears != null ? <span className="pill">{job.minExperienceYears}+ years</span> : null}</div> : null}
      </div>
      <div className="col-start-2 text-left lg:col-start-auto lg:text-center">
        <div aria-label={applicantCount !== undefined ? `${applicantCount} applicants` : applicationsQuery.isError ? "Applicant count unavailable" : "Loading applicant count"} aria-live="polite" className="font-serif text-[22px] text-brand">
          {applicantCount ?? (applicationsQuery.isError ? "-" : "...")}
        </div>
        <div className="text-xs text-muted">Applicants</div>
      </div>
      <div className="relative col-start-3 row-start-1 self-start justify-self-end lg:col-start-auto lg:row-auto lg:self-center" onClick={(event) => event.stopPropagation()}>
        <button
          aria-expanded={menuOpen}
          aria-label={`Options for ${job.title}`}
          className="grid h-10 w-10 place-items-center rounded-lg border border-border-strong bg-white text-slate transition hover:border-brand hover:bg-brand-tint hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <Icon name="moreH" size={18} />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-border bg-white p-1.5 shadow-(--shadow-sm)">
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-ink hover:bg-chalk"
              onClick={() => {
                setMenuOpen(false);
                onApplications(job);
              }}
              type="button"
            >
              <Icon name="users" size={14} />
              Applications
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-ink hover:bg-chalk"
              onClick={() => {
                setMenuOpen(false);
                onEdit(job);
              }}
              type="button"
            >
              <Icon name="edit" size={14} />
              Edit
            </button>
            {canClose ? (
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-ink hover:bg-chalk disabled:cursor-not-allowed disabled:opacity-50"
                disabled={actionPending}
                onClick={() => {
                  setMenuOpen(false);
                  onClose(job);
                }}
                type="button"
              >
                <Icon name="x" size={14} />
                Close
              </button>
            ) : null}
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-danger hover:bg-danger-tint disabled:cursor-not-allowed disabled:opacity-50"
              disabled={actionPending}
              onClick={() => {
                setMenuOpen(false);
                onDelete(job);
              }}
              type="button"
            >
              <Icon name="x" size={14} />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function formatPay(job: Job) {
  if (!job.rate) return "Rate TBC";
  if (job.payType === "hourly") return `GBP ${job.rate}/hr`;
  if (job.payType === "fixed") return `GBP ${job.rate} fixed`;
  return `GBP ${job.rate}/day`;
}

export function formatJobStatus(status: Job["status"]) {
  return status ? status.toLowerCase().replace(/_/g, " ") : "draft";
}

function statusTone(status: Job["status"]): Tone | "ghost" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "amber";
  return "ghost";
}
