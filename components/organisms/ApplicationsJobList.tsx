import type { Job } from "@/features/jobs/types";
import { useMyJobs } from "@/features/jobs/use-jobs";

import { Btn, Icon, Tag } from "../atoms";
import { SectionLoader } from "../molecules";
import { WorkspaceEmptyState } from "./WorkspacePanels";

export function ApplicationsJobList({ onOpenJob, onPageChange, page }: {
  onOpenJob: (jobId: string) => void;
  onPageChange: (page: number) => void;
  page: number;
}) {
  const jobsQuery = useMyJobs({ limit: 6, page, status: "ACTIVE" });
  const jobs = jobsQuery.data?.jobs ?? [];
  const pagination = jobsQuery.data?.pagination;
  const currentPage = pagination?.page ?? page;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const total = pagination?.total ?? jobs.length;
  const start = jobs.length ? (currentPage - 1) * (pagination?.limit ?? 6) + 1 : 0;
  const end = jobs.length ? Math.min(total, start + jobs.length - 1) : 0;

  if (jobsQuery.isLoading) return <SectionLoader rows={4} />;
  if (jobsQuery.error) {
    return <WorkspaceEmptyState
      action={<Btn variant="secondary" onClick={() => void jobsQuery.refetch()}>Try again</Btn>}
      icon="file"
      message={jobsQuery.error.message || "Your jobs could not be loaded. Please try again."}
      title="Jobs unavailable"
    />;
  }
  if (!jobs.length && total === 0) {
    return <WorkspaceEmptyState icon="file" message="Publish a job to start receiving teacher applications. Your active jobs will appear here first." title="No active jobs yet" />;
  }

  return (
    <section aria-busy={jobsQuery.isFetching} aria-label="Active jobs" className="applications-job-list card overflow-hidden">
      <div className="applications-job-list-heading">
        <div>
          <h2>Active jobs</h2>
          <p>Open a job to see everyone who has applied.</p>
        </div>
        <Tag tone="green">{total} active {total === 1 ? "job" : "jobs"}</Tag>
      </div>
      <div>
        {jobs.map((job) => <ApplicationJobRow job={job} key={job.id} onOpen={() => onOpenJob(job.id)} />)}
        {!jobs.length ? <p className="p-6 text-sm text-muted">No jobs on this page. Choose a previous page to continue.</p> : null}
      </div>
      {pagination ? (
        <div className="job-pagination">
          <p aria-live="polite" className="job-pagination-summary">
            {jobsQuery.isFetching ? "Loading jobs…" : jobs.length ? `Showing ${start}–${end} of ${total} ${total === 1 ? "job" : "jobs"}` : "No jobs on this page"}
          </p>
          <nav aria-label="Application job pages" className="job-pagination-controls">
            <Btn disabled={jobsQuery.isFetching || currentPage <= 1} icon="arrowLeft" onClick={() => onPageChange(currentPage - 1)} size="sm" variant="secondary">Previous</Btn>
            <span className="applications-job-page-number">Page {currentPage} of {totalPages}</span>
            <Btn disabled={jobsQuery.isFetching || !pagination.hasNextPage || currentPage >= totalPages} iconRight="arrow" onClick={() => onPageChange(currentPage + 1)} size="sm" variant="secondary">Next</Btn>
          </nav>
        </div>
      ) : null}
    </section>
  );
}

function ApplicationJobRow({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const location = [job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC";
  const pay = !job.rate ? "Rate TBC" : `GBP ${job.rate}${job.payType === "hourly" ? "/hr" : job.payType === "fixed" ? " fixed" : "/day"}`;

  return (
    <article className="applications-job-row">
      <span aria-hidden="true" className="applications-job-icon"><Icon name="file" size={22} /></span>
      <div className="applications-job-copy">
        <div className="applications-job-status">
          <Tag tone={job.status === "ACTIVE" ? "green" : job.status === "DRAFT" ? "amber" : "ghost"}>{job.status ?? "Job"}</Tag>
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
