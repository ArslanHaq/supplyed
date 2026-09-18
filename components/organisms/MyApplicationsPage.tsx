import { useState } from "react";
import { useMyApplications } from "@/features/applications/use-applications";
import { applicationStatuses, statusLabel } from "@/features/applications/status";
import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useJob } from "@/features/jobs/use-jobs";
import type { RouteProps } from "@/types/supplyed";
import { Btn, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { ApplicationHistory } from "./ApplicationHistory";
import { ApplicationDocuments } from "./ApplicationDocuments";

export function MyApplicationsPage({ go }: Pick<RouteProps, "go">) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobApplicationStatus>();
  const query = useMyApplications({ page, limit: 20, status });
  const pagination = query.data?.pagination;
  return (
    <div className="app-page">
      <PageHead
        title="My applications"
        subtitle="Track your applications, upload supporting documents, and follow hiring decisions."
        actions={<Btn onClick={() => go("find-jobs")}>Browse jobs</Btn>}
      />
      <label className="mb-5 block max-w-xs text-sm">
        Application status
        <select
          className="select mt-2"
          value={status ?? ""}
          onChange={(event) => {
            setStatus((event.target.value || undefined) as JobApplicationStatus | undefined);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {applicationStatuses.map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>
      </label>
      {query.isLoading ? (
        <SectionLoader rows={3} />
      ) : query.isError ? (
        <div role="alert" className="card card-pad">
          <p>{query.error.message}</p>
          <Btn onClick={() => void query.refetch()}>Try again</Btn>
        </div>
      ) : (
        <div className="space-y-4">
          {query.data?.applications.map((application) => (
            <ApplicationCard key={application.id} application={application} go={go} />
          ))}
          {!query.data?.applications.length ? (
            <div className="card card-pad-lg">
              <h2 className="font-serif text-2xl">No applications found</h2>
              <p className="mt-2 text-muted">Applications you submit will appear here.</p>
            </div>
          ) : null}
        </div>
      )}
      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between">
          <Btn variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Btn>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Btn variant="secondary" disabled={!pagination.hasNextPage} onClick={() => setPage(page + 1)}>
            Next
          </Btn>
        </div>
      ) : null}
    </div>
  );
}
function ApplicationCard({ application, go }: { application: JobApplication } & Pick<RouteProps, "go">) {
  const job = useJob(application.jobId);
  return (
    <article className="card card-pad-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">
            {job.data?.title ?? (job.isLoading ? "Loading role..." : "Listing no longer available")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Applied {application.createdAt ? new Date(application.createdAt).toLocaleDateString("en-GB") : "recently"}
          </p>
        </div>
        <Tag tone={application.status === "HIRED" || application.status === "COMPLETED" ? "green" : "ghost"}>
          {statusLabel(application.status)}
        </Tag>
      </div>
      {!job.data && !job.isLoading ? (
        <p className="mt-3 text-sm text-muted">
          This listing may be closed or expired. Your application and history are still available.
        </p>
      ) : null}
      {application.coverLetter ? <p className="mt-4 whitespace-pre-line text-sm">{application.coverLetter}</p> : null}
      {job.data ? (
        <Btn
          className="mt-3"
          size="sm"
          variant="secondary"
          onClick={() => go("job-detail", { jobId: application.jobId })}
        >
          View role
        </Btn>
      ) : null}
      <ApplicationHistory id={application.id} />
      <ApplicationDocuments applicationId={application.id} />
    </article>
  );
}
