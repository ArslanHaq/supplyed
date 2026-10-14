import { useState } from "react";

import { useJobApplications } from "@/features/applications/use-applications";
import type { Job, JobsPagination, JobStatus, JobStatusCounts } from "@/features/jobs/types";
import type { Tone } from "@/types/supplyed";

import { Btn, Icon, Tag } from "../atoms";
import { SectionLoader } from "../molecules";

export type JobStatusFilter = "ALL" | JobStatus;

type JobManagementListProps = {
  actionPending?: boolean;
  /** Totals per status across every job, so each tab shows its full count whatever page is open. */
  counts?: JobStatusCounts;
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
  onPageChange?: (page: number) => void;
  pagination?: JobsPagination;
  refreshing?: boolean;
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
  counts,
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
  onPageChange,
  pagination,
  refreshing = false,
  title,
}: JobManagementListProps) {
  // The backend already filtered by status; this only guards against a stale page during a tab switch.
  const filteredJobs = filter === "ALL" ? jobs : jobs.filter((job) => job.status === filter);

  const resultOffset = pagination ? (pagination.page - 1) * pagination.limit : 0;
  const resultStart = pagination && filteredJobs.length ? Math.min(pagination.total, resultOffset + 1) : 0;
  const resultEnd = pagination ? Math.min(pagination.total, resultOffset + filteredJobs.length) : filteredJobs.length;

  return (
    <section aria-busy={loading || refreshing || undefined} className="job-management-workspace card">
      <header className="job-management-heading">
        <div><h2>{title}</h2><p>Manage your roles and find your next great teacher.</p></div>
        <Btn icon="plus" size="sm" variant="secondary" onClick={onCreate}>New role</Btn>
      </header>
        <div aria-label="Filter roles by status" className="workspace-status-filters job-status-toolbar">
          {statusFilters.map((statusFilter) => {
            const count = counts?.[statusFilter.value];
            return (
              <button
                key={statusFilter.value}
                aria-pressed={filter === statusFilter.value}
                className={`min-h-9 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  filter === statusFilter.value ? "border-brand bg-brand-tint text-brand" : "border-border bg-white text-slate hover:bg-chalk"
                }`}
                onClick={() => onFilterChange(statusFilter.value)}
                type="button"
              >
                <span>{statusFilter.label}</span>{count === undefined ? null : <span className="job-status-count">{count}</span>}
              </button>
            );
          })}
        </div>

      <div className="job-management-list">
        {loading ? <div className="p-5"><SectionLoader rows={3} /></div> : null}
        {!loading && filteredJobs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="font-heading text-[22px]">No roles found</div>
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
      {pagination && onPageChange ? (
        <footer className="job-pagination">
          <p aria-live="polite" className="job-pagination-summary">{loading || refreshing ? "Loading roles…" : pagination.total > 0 ? `Showing ${resultStart}–${resultEnd} of ${pagination.total} ${pagination.total === 1 ? "role" : "roles"}` : "No roles to show"}</p>
          <nav aria-label="Job pages" className="job-pagination-controls">
          <Btn disabled={pagination.page <= 1 || loading || refreshing} size="sm" variant="ghost" onClick={() => onPageChange(pagination.page - 1)}>Previous</Btn>
          {pageItems(pagination.page, Math.max(1, pagination.totalPages)).map((item, index) =>
            typeof item === "number" ? (
              <button
                key={item}
                aria-current={item === pagination.page ? "page" : undefined}
                aria-label={`Page ${item}`}
                className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold transition-colors ${
                  item === pagination.page
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-white text-slate hover:border-brand hover:bg-brand-tint hover:text-brand"
                }`}
                disabled={loading || refreshing}
                onClick={() => onPageChange(item)}
                type="button"
              >
                {item}
              </button>
            ) : (
              <span key={`${item}-${index}`} aria-hidden="true" className="px-1 text-muted">…</span>
            ),
          )}
          <Btn disabled={!pagination.hasNextPage || loading || refreshing} size="sm" variant="ghost" onClick={() => onPageChange(pagination.page + 1)}>Next</Btn>
          </nav>
        </footer>
      ) : null}
    </section>
  );
}

function pageItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  const pages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];

  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  });

  return items;
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
      className="job-management-row"
      onClick={() => onApplications(job)}
    >
      <div aria-hidden="true" className="job-management-icon"><Icon name={job.status === "ACTIVE" ? "file" : job.status === "DRAFT" ? "edit" : "checkCircle"} size={22} /></div>
      <div className="job-management-copy">
        <div className="job-management-status"><Tag tone={statusTone(job.status)}>{formatJobStatus(job.status)}</Tag>{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<span>Posted {job.postedAt}</span></div>
        <button className="job-management-title" onClick={(event) => { event.stopPropagation(); onApplications(job); }} type="button">{job.title}</button>
        <div className="job-management-meta"><span><Icon name="pin" size={13} />{[job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC"}</span><span><Icon name="calendar" size={13} />{job.date}</span><span><Icon name="pound" size={13} />{formatPay(job)}</span></div>
        <div className="job-management-skills"><Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag>{job.requiredSkills.slice(0, 4).map((skill) => <span key={skill} className="pill">{skill}</span>)}{job.minExperienceYears != null ? <span className="pill">{job.minExperienceYears}+ years</span> : null}</div>
      </div>
      <button className="job-applicant-action" onClick={(event) => { event.stopPropagation(); onApplications(job); }} type="button">
        <span aria-label={applicantCount !== undefined ? `${applicantCount} applicants` : applicationsQuery.isError ? "Applicant count unavailable" : "Loading applicant count"} aria-live="polite"><strong>{applicantCount ?? (applicationsQuery.isError ? "-" : "...")}</strong><span>{applicantCount === 1 ? "applicant" : "applicants"}</span></span>
        <span>Review <Icon name="arrowRight" size={13} /></span>
      </button>
      <div className="job-management-menu" onClick={(event) => event.stopPropagation()}>
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
