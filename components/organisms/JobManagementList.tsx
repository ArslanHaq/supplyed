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

      <div className="card overflow-hidden">
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

  return (
    <div className="flex cursor-pointer flex-wrap items-center gap-4 border-b border-border px-5 py-4 last:border-b-0" onClick={() => onApplications(job)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
        <Icon name={job.status === "ACTIVE" ? "checkCircle" : job.status === "DRAFT" ? "edit" : "file"} size={18} />
      </div>
      <div className="min-w-[240px] flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {job.urgent ? <Tag tone="red">Urgent</Tag> : null}
          <Tag tone={statusTone(job.status)}>{formatJobStatus(job.status)}</Tag>
          <Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag>
          <span className="text-xs text-muted">{job.postedAt}</span>
        </div>
        <div className="text-[15px] font-semibold">{job.title}</div>
        <div className="text-xs text-muted">{job.location ?? job.city} - {job.date} - {formatPay(job)}</div>
      </div>
      <div className="text-center">
        <div className="font-serif text-[22px] text-brand">{job.applicants}</div>
        <div className="text-xs text-muted">Applicants</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Btn
          size="sm"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onApplications(job);
          }}
        >
          Applications
        </Btn>
        <Btn
          size="sm"
          variant="secondary"
          icon="edit"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(job);
          }}
        >
          Edit
        </Btn>
        {canClose ? (
          <Btn
            disabled={actionPending}
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onClose(job);
            }}
          >
            Close
          </Btn>
        ) : null}
        <Btn
          disabled={actionPending}
          size="sm"
          variant="danger"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(job);
          }}
        >
          Delete
        </Btn>
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
