import { useState } from "react";
import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { applicationTransitions, applicationStatuses, statusLabel } from "@/features/applications/status";
import { useJobApplications, useUpdateApplicationStatus } from "@/features/applications/use-applications";
import { useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import { formatJobPay } from "@/features/jobs/presentation";
import type { MatchedInstructor } from "@/features/matching/types";
import { useRankedApplications, useRecommendedInstructors } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";
import { Avatar, Btn, Tag } from "../atoms";
import { MatchScorePanel, PageHead, SectionLoader } from "../molecules";
import { ApplicationHistory } from "./ApplicationHistory";
type Tab = "pipeline" | "best" | "recommended";

export function ApplicationsPage({ go, ctx, toast, state }: Pick<RouteProps, "go" | "ctx" | "toast" | "state">) {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobApplicationStatus>();
  const jobsQuery = useMyJobs();
  const selectedJobId = ctx.jobId ?? jobsQuery.data?.[0]?.id;
  const job = jobsQuery.data?.find((item) => item.id === selectedJobId);
  const applicationsQuery = useJobApplications(job?.id, { limit: 20, page, status });
  const rankedQuery = useRankedApplications(tab === "best" ? job?.id : undefined, { limit: 20, minScore, page });
  const instructorsQuery = useRecommendedInstructors(tab === "recommended" ? job?.id : undefined, {
    limit: 20,
    minScore,
    page,
  });
  const updateJob = useUpdateJob({
    onSuccess: (result) =>
      toast({
        title: result.ok ? "Job updated" : "Could not update job",
        msg: result.message ?? "Please refresh and try again.",
        tone: result.ok ? "success" : "danger",
      }),
  });
  const updateStatus = useUpdateApplicationStatus({
    onSuccess: async (result) => {
      toast({
        title: result.ok ? "Application updated" : "Could not update application",
        msg: result.message ?? "Please refresh and try again.",
        tone: result.ok ? "success" : "danger",
      });
      if (!result.ok) await applicationsQuery.refetch();
    },
    onError: () => toast({ title: "Could not update application", msg: "Please try again.", tone: "danger" }),
  });
  const query = tab === "best" ? rankedQuery : tab === "recommended" ? instructorsQuery : applicationsQuery;
  const pagination = query.data?.pagination;
  const canManage = state.applicationStatus === "approved";
  function changeStatus(application: JobApplication, next: JobApplicationStatus) {
    if (next === "HIRED" && !window.confirm("Hire this instructor? This closes the job to new applications.")) return;
    updateStatus.mutate({ id: application.id, status: next });
  }
  if (jobsQuery.isLoading)
    return (
      <div className="app-page">
        <SectionLoader rows={4} />
      </div>
    );
  if (jobsQuery.isError)
    return (
      <div className="app-page">
        <p role="alert">{jobsQuery.error.message}</p>
        <Btn onClick={() => void jobsQuery.refetch()}>Try again</Btn>
      </div>
    );
  return (
    <div className="app-page">
      <PageHead
        title={job?.title ?? "Applications"}
        subtitle={job ? `${job.date} ? ${formatJobPay(job)}` : "Select one of your posted roles to review applicants."}
        actions={
          <>
            <Btn variant="secondary" disabled={!state.isFullyVerified} onClick={() => go("post-job")}>
              Post a role
            </Btn>
            {job ? (
              <Btn variant="secondary" onClick={() => go("post-job", { jobId: job.id })}>
                Edit role
              </Btn>
            ) : null}
            {job && ["ACTIVE", "DRAFT", "EXPIRED"].includes(job.status ?? "") ? (
              <Btn
                disabled={updateJob.isPending}
                variant="ghost"
                onClick={() => updateJob.mutate({ id: job.id, status: "CLOSED" })}
              >
                Close role
              </Btn>
            ) : null}
          </>
        }
      />
      <label className="mb-5 block text-sm">
        Your role
        <select
          className="select mt-2"
          value={selectedJobId ?? ""}
          onChange={(event) => {
            setPage(1);
            go("applications", { jobId: event.target.value });
          }}
        >
          {!job ? <option value="">Choose a role</option> : null}
          {jobsQuery.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} ({item.status?.toLowerCase()})
            </option>
          ))}
        </select>
      </label>
      {!job ? (
        <EmptyState title="No role selected" message="Post a role or select one of your existing listings." />
      ) : (
        <>
          <div className="card card-pad mb-5 flex flex-wrap items-center gap-3">
            {(
              [
                ["pipeline", "All applications"],
                ["best", "Best match"],
                ["recommended", "Recommended instructors"],
              ] as const
            ).map(([value, label]) => (
              <Btn
                key={value}
                size="sm"
                variant={tab === value ? "secondary" : "ghost"}
                onClick={() => {
                  setTab(value);
                  setPage(1);
                }}
              >
                {label}
              </Btn>
            ))}
            {tab === "pipeline" ? (
              <select
                aria-label="Filter application status"
                className="select ml-auto max-w-[220px]"
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
            ) : (
              <label className="ml-auto flex items-center gap-2 text-sm">
                Minimum score
                <input
                  className="input w-24"
                  min={0}
                  max={100}
                  type="number"
                  value={minScore}
                  onChange={(event) => {
                    setMinScore(Math.min(100, Math.max(0, Number(event.target.value) || 0)));
                    setPage(1);
                  }}
                />
              </label>
            )}
          </div>
          {!canManage ? (
            <p className="mb-4 text-sm text-muted">
              You can review applications. An active profile is required to change their status.
            </p>
          ) : null}
          {query.isLoading ? (
            <SectionLoader rows={3} />
          ) : query.isError ? (
            <div role="alert">
              <EmptyState title="Could not load results" message={query.error.message} />
              <Btn onClick={() => void query.refetch()}>Try again</Btn>
            </div>
          ) : (
            <div className="space-y-4">
              {tab === "pipeline"
                ? applicationsQuery.data?.applications.map((application) => (
                    <article className="card card-pad-lg" key={application.id}>
                      <CandidateHeader
                        instructor={application.instructor}
                        status={application.status}
                        onOpen={() => go("teacher-profile", { teacherId: application.instructorId })}
                      />
                      {application.coverLetter ? (
                        <p className="my-4 whitespace-pre-line text-sm">{application.coverLetter}</p>
                      ) : null}
                      <StatusActions
                        application={application}
                        pending={updateStatus.isPending || !canManage}
                        onUpdate={(next) => changeStatus(application, next)}
                      />
                      <ApplicationHistory id={application.id} />
                    </article>
                  ))
                : null}
              {tab === "best"
                ? rankedQuery.data?.applications.map(({ application, instructor, match }) => (
                    <article className="card card-pad-lg" key={application.id}>
                      <CandidateHeader
                        instructor={instructor}
                        status={application.status}
                        onOpen={() => go("teacher-profile", { teacherId: instructor.id })}
                      />
                      {application.coverLetter ? (
                        <p className="my-4 whitespace-pre-line text-sm">{application.coverLetter}</p>
                      ) : null}
                      <MatchScorePanel match={match} />
                      <StatusActions
                        application={application}
                        pending={updateStatus.isPending || !canManage}
                        onUpdate={(next) => changeStatus(application, next)}
                      />
                      <ApplicationHistory id={application.id} />
                    </article>
                  ))
                : null}
              {tab === "recommended"
                ? instructorsQuery.data?.instructors.map(({ instructor, match }) => (
                    <article className="card card-pad-lg" key={instructor.id}>
                      <CandidateHeader
                        instructor={instructor}
                        onOpen={() => go("teacher-profile", { teacherId: instructor.id })}
                      />
                      <MatchScorePanel match={match} />
                    </article>
                  ))
                : null}
              {pagination?.total === 0 ? (
                <EmptyState
                  title="No results"
                  message={
                    tab === "recommended"
                      ? "No instructors meet the selected match score."
                      : "No applications match this view yet."
                  }
                />
              ) : null}
            </div>
          )}
          {pagination && pagination.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between">
              <Btn disabled={page <= 1} variant="secondary" onClick={() => setPage(page - 1)}>
                Previous
              </Btn>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Btn disabled={!pagination.hasNextPage} variant="secondary" onClick={() => setPage(page + 1)}>
                Next
              </Btn>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
function CandidateHeader({
  instructor,
  status,
  onOpen,
}: {
  instructor?: MatchedInstructor;
  status?: JobApplicationStatus;
  onOpen: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Avatar name={instructor?.fullName ?? "Instructor"} />
      <div className="flex-1">
        <button className="text-left font-semibold hover:text-brand" onClick={onOpen}>
          {instructor?.fullName ?? "View instructor profile"}
        </button>
        <p className="text-xs text-muted">
          {[instructor?.city, instructor?.county].filter(Boolean).join(", ") || "Location not shared"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {instructor?.subjects?.map((subject) => (
            <Tag key={subject} tone="ghost">
              {subject}
            </Tag>
          ))}
        </div>
      </div>
      {status ? (
        <Tag tone={status === "HIRED" || status === "COMPLETED" ? "green" : "ghost"}>{statusLabel(status)}</Tag>
      ) : (
        <Tag tone="ghost">Recommendation</Tag>
      )}
    </div>
  );
}
function StatusActions({
  application,
  pending,
  onUpdate,
}: {
  application: JobApplication;
  pending: boolean;
  onUpdate: (status: JobApplicationStatus) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {applicationTransitions[application.status].map((status) => (
        <Btn
          key={status}
          disabled={pending}
          size="sm"
          variant={status === "REJECTED" ? "danger" : "secondary"}
          onClick={() => onUpdate(status)}
        >
          {status === "VIEWED" ? "Mark viewed" : status === "COMPLETED" ? "Mark completed" : statusLabel(status)}
        </Btn>
      ))}
    </div>
  );
}
function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="card card-pad-lg text-center">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 text-muted">{message}</p>
    </div>
  );
}
