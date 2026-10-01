import { useState } from "react";

import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useMyApplications } from "@/features/applications/use-applications";
import { useJob } from "@/features/jobs/use-jobs";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

type StatusFilter = "ALL" | JobApplicationStatus;

const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Applied", value: "APPLIED" },
  { label: "Viewed", value: "VIEWED" },
  { label: "Shortlisted", value: "SHORTLISTED" },
  { label: "Interview", value: "INTERVIEW" },
  { label: "Hired", value: "HIRED" },
  { label: "Rejected", value: "REJECTED" },
];

export function TeacherApplicationsPage({ go }: Pick<RouteProps, "go">) {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const applicationsQuery = useMyApplications({ limit: 20, page, status: status === "ALL" ? undefined : status });
  const applications = applicationsQuery.data?.applications ?? [];
  const pagination = applicationsQuery.data?.pagination;
  const total = pagination?.total ?? applications.length;

  return (
    <div className="app-page">
      <PageHead
        title="My applications"
        subtitle={`${total} ${total === 1 ? "application" : "applications"} tracked across your job searches`}
        actions={<Btn icon="search" onClick={() => go("find-jobs")}>Find jobs</Btn>}
      />

      <div className="card card-pad mb-6 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((item) => (
          <Btn
            key={item.value}
            size="sm"
            variant={status === item.value ? "secondary" : "ghost"}
            onClick={() => {
              setStatus(item.value);
              setPage(1);
            }}
          >
            {item.label}
          </Btn>
        ))}
      </div>

      {applicationsQuery.isLoading ? <SectionLoader rows={4} /> : null}
      {applicationsQuery.isError ? (
        <div className="card card-pad-lg text-center" role="alert">
          <div className="font-serif text-[24px]">Applications could not be loaded</div>
          <p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">{applicationsQuery.error.message}</p>
          <Btn className="mt-5" variant="secondary" onClick={() => void applicationsQuery.refetch()}>Try again</Btn>
        </div>
      ) : null}

      {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length === 0 ? (
        <div className="card card-pad-lg text-center">
          <div className="font-serif text-[24px]">No applications yet</div>
          <p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">Apply for a role and your application status will appear here.</p>
          <Btn className="mt-5" onClick={() => go("find-jobs")}>Find jobs</Btn>
        </div>
      ) : null}

      <div className="space-y-4">
        {applications.map((application) => <TeacherApplicationCard application={application} go={go} key={application.id} />)}
      </div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between">
          <Btn disabled={page <= 1} variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
          <span className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</span>
          <Btn disabled={!pagination.hasNextPage} variant="secondary" onClick={() => setPage((value) => value + 1)}>Next</Btn>
        </div>
      ) : null}
    </div>
  );
}

function TeacherApplicationCard({ application, go }: { application: JobApplication; go: RouteProps["go"] }) {
  const jobQuery = useJob(application.jobId);
  const job = jobQuery.data;
  const location = job ? [job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC" : "Job details unavailable";

  return (
    <div className="card card-pad-lg">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[240px] flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ApplicationStatusTag status={application.status} />
            {job?.status ? <Tag tone="ghost">Job {job.status.toLowerCase()}</Tag> : null}
            {application.createdAt ? <span className="text-xs text-muted">Applied {formatSubmittedAt(application.createdAt)}</span> : null}
          </div>
          <button className="cursor-pointer text-left font-serif text-2xl hover:text-brand" onClick={() => go("job-detail", { jobId: application.jobId })} type="button">
            {job?.title ?? (jobQuery.isLoading ? "Loading job..." : "Job no longer public")}
          </button>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted">
            <span className="flex items-center gap-1"><Icon name="building" size={13} />{job?.school ?? "Hiring account"}</span>
            <span className="flex items-center gap-1"><Icon name="pin" size={13} />{location}</span>
            {job?.date ? <span className="flex items-center gap-1"><Icon name="clock" size={13} />{job.date}</span> : null}
          </div>
          {application.coverLetter ? <p className="mt-4 border-l-2 border-brand-tint-2 pl-4 text-sm leading-6 text-muted">{application.coverLetter}</p> : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {job?.rate ? <div className="text-right"><div className="font-serif text-xl">GBP {job.rate}</div><div className="text-xs text-muted">per day</div></div> : null}
          <Btn size="sm" variant="secondary" onClick={() => go("job-detail", { jobId: application.jobId })}>View job</Btn>
        </div>
      </div>
    </div>
  );
}

function ApplicationStatusTag({ status }: { status: JobApplicationStatus }) {
  const tone = status === "HIRED" ? "green" : status === "INTERVIEW" || status === "SHORTLISTED" ? "purple" : status === "REJECTED" ? "red" : status === "VIEWED" ? "amber" : "ghost";
  return <Tag tone={tone}>{formatStatus(status)}</Tag>;
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function formatSubmittedAt(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(parsed));
}
