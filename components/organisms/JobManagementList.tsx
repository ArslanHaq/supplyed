import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";
import { useJobApplications } from "@/features/applications/use-applications";
import type { Job, JobsPagination, JobStatus, JobStatusCounts } from "@/features/jobs/types";
import { formatJobVisibilityLabel, getJobVisibilityLabel, type JobVisibilityLabel } from "@/features/jobs/listing-window";

import { Btn } from "../atoms";
import { JobListingPreview, jobListingPreviewData, SectionLoader } from "../molecules";

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
  const choices = useDropdown("jobStatus");
  const statusFilters: Array<{ label: string; value: JobStatusFilter }> = [{ label: "All", value: "ALL" }, ...(choices.data?.options ?? []).map(option => ({ label: option.label, value: option.value as JobStatusFilter }))];
  if (!statusFilters.some(option => option.value === "RESERVED")) statusFilters.push({ label: "Reserved", value: "RESERVED" });
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
          <DropdownStatus name="jobStatus" />
          {statusFilters.map((statusFilter) => {
            const count = counts?.[statusFilter.value];
            return (
              <button
                key={statusFilter.value}
                aria-pressed={filter === statusFilter.value}
                className={`min-h-9 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  filter === statusFilter.value ? "border-brand bg-brand-tint text-brand" : "border-border bg-surface text-slate hover:bg-chalk"
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
                    : "border-border bg-surface text-slate hover:border-brand hover:bg-brand-tint hover:text-brand"
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
  const canClose = job.status !== "CLOSED";
  const visibility = getJobVisibilityLabel(job);
  const applicationsQuery = useJobApplications(job.id, { limit: 1 });
  const applicantCount = applicationsQuery.data?.pagination.total;
  const status = { label: formatJobVisibilityLabel(visibility), tone: visibilityTone(visibility) } as const;

  return (
    <div className="border-b border-border p-4 last:border-0 sm:p-5">
      <JobListingPreview
        action={<Btn iconRight="arrowRight" size="sm" onClick={() => onApplications(job)}>Review applications</Btn>}
        data={jobListingPreviewData(job, status)}
        onOpen={() => onApplications(job)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-chalk px-3 py-2">
        <span className="mr-auto text-xs text-muted" aria-live="polite">
          <strong className="text-ink">{applicantCount ?? (applicationsQuery.isError ? "—" : "…")}</strong> {applicantCount === 1 ? "applicant" : "applicants"}
        </span>
        <Btn icon="edit" size="sm" variant="ghost" onClick={() => onEdit(job)}>{job.termsLocked ? "View terms" : "Edit"}</Btn>
        {canClose ? <Btn disabled={actionPending} size="sm" variant="ghost" onClick={() => onClose(job)}>Close</Btn> : null}
        {job.canDelete === true ? <Btn disabled={actionPending} size="sm" variant="danger" onClick={() => onDelete(job)}>Delete</Btn> : null}
      </div>
    </div>
  );
}

function visibilityTone(status: JobVisibilityLabel): "amber" | "ghost" | "green" | "red" {
  if (status === "live") return "green";
  if (status === "draft" || status === "scheduled" || status === "reserved") return "amber";
  if (status === "suspended") return "red";
  return "ghost";
}
