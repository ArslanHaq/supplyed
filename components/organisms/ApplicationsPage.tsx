import { useState } from "react";

import { useJobApplications, useUpdateApplicationStatus } from "@/features/applications/use-applications";
import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, MatchScore, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

const stages: JobApplicationStatus[] = ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEW", "HIRED"];

export function ApplicationsPage({ go, ctx, toast }: Pick<RouteProps, "go" | "ctx" | "toast">) {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const myJobsQuery = useMyJobs();
  const selectedJobId = ctx.jobId ?? myJobsQuery.data?.[0]?.id;
  const publicJobQuery = useJob(selectedJobId ?? "");
  const job = myJobsQuery.data?.find((item) => item.id === selectedJobId) ?? publicJobQuery.data ?? null;
  const applicationsQuery = useJobApplications(selectedJobId, { limit: 100 });
  const applications = applicationsQuery.data?.applications ?? [];
  const loading = myJobsQuery.isLoading || applicationsQuery.isLoading;
  const updateJob = useUpdateJob({
    onSuccess: (result) => {
      toast({
        title: result.ok ? "Job updated" : "Could not update job",
        msg: result.message ?? "The job status was updated.",
        tone: result.ok ? "success" : "danger",
      });
    },
    onError: () => {
      toast({ title: "Could not update job", msg: "Please try again.", tone: "danger" });
    },
  });
  const updateApplicationStatus = useUpdateApplicationStatus({
    onError: (error) => {
      toast({ title: "Could not update application", msg: error.message, tone: "danger" });
    },
    onSuccess: (application) => {
      toast({
        title: "Application updated",
        msg: `Moved to ${formatStatus(application.status)}.`,
        tone: "success",
      });
    },
  });

  function moveApplication(application: JobApplication, status: JobApplicationStatus) {
    updateApplicationStatus.mutate({ id: application.id, status });
  }

  if (!selectedJobId && !myJobsQuery.isLoading) {
    return (
      <div className="app-page">
        <PageHead
          title="Applications"
          subtitle="Post a role first, then applicants will appear here."
          actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>}
        />
        <div className="card card-pad-lg text-center">
          <div className="font-serif text-[26px]">No posted roles yet</div>
          <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-muted">
            Applications are grouped by job. Create an active role to start receiving teacher applications.
          </p>
          <Btn className="mt-5" icon="plus" onClick={() => go("post-job")}>Post a job</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageHead
        title={job?.title ?? "Applications"}
        subtitle={`${job ? `${job.location ?? job.city} - ${job.date} - ${formatPay(job)} - ` : ""}${applications.length} applications`}
        actions={
          <>
            <Btn variant="secondary" size="sm" onClick={() => go("post-job")}>Post another role</Btn>
            {selectedJobId ? <Btn variant="secondary" size="sm" icon="edit" onClick={() => go("post-job", { jobId: selectedJobId })}>Edit role</Btn> : null}
            {job?.status === "ACTIVE" || job?.status === "DRAFT" ? (
              <Btn
                disabled={updateJob.isPending}
                loading={updateJob.isPending}
                loadingLabel="Closing"
                size="sm"
                variant="ghost"
                onClick={() => updateJob.mutate({ id: job.id, status: "CLOSED" })}
              >
                Close role
              </Btn>
            ) : null}
            {selectedJobId ? <Btn size="sm" onClick={() => go("find-teachers")}>Find candidates</Btn> : null}
          </>
        }
      />

      <div className="card card-pad mb-6 flex flex-wrap items-center gap-5">
        <div className="flex gap-2">
          {job?.urgent ? <Tag tone="red">Urgent</Tag> : null}
          {job?.status ? <Tag tone={job.status === "ACTIVE" ? "green" : job.status === "DRAFT" ? "amber" : "ghost"}>{formatStatus(job.status)}</Tag> : null}
          {job ? <Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode}</Tag> : null}
        </div>
        <div><div className="text-xs text-muted">Applicants</div><div className="font-serif text-[22px]">{applications.length}</div></div>
        <div><div className="text-xs text-muted">Shortlisted</div><div className="font-serif text-[22px]">{applications.filter((item) => item.status === "SHORTLISTED").length}</div></div>
        <div className="ml-auto flex gap-1.5">
          <Btn variant={view === "kanban" ? "secondary" : "ghost"} size="sm" icon="grid" onClick={() => setView("kanban")}>Kanban</Btn>
          <Btn variant={view === "list" ? "secondary" : "ghost"} size="sm" icon="list" onClick={() => setView("list")}>List</Btn>
        </div>
      </div>

      {loading ? <SectionLoader rows={4} /> : null}

      {!loading && applications.length === 0 ? (
        <div className="card card-pad-lg text-center">
          <div className="font-serif text-[24px]">No applications yet</div>
          <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-muted">
            The job is published. Applications will appear here when instructors apply.
          </p>
          <Btn className="mt-5" variant="secondary" onClick={() => go("find-teachers")}>Browse teachers</Btn>
        </div>
      ) : null}

      {!loading && applications.length > 0 && view === "kanban" ? (
        <div className="kanban">
          {stages.map((stage) => (
            <div key={stage} className="kanban-col">
              <div className="kanban-head"><div className="label-xs">{formatStatus(stage)}</div><div className="pill">{applications.filter((item) => item.status === stage).length}</div></div>
              {applications.filter((item) => item.status === stage).map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  disabled={updateApplicationStatus.isPending}
                  onMove={moveApplication}
                  onOpen={() => go("teacher-profile", { teacherId: application.instructor?.id })}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {!loading && applications.length > 0 && view === "list" ? (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Teacher</th><th>Experience</th><th>Rating</th><th>Stage</th><th>Applied</th><th>Actions</th></tr></thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td><ApplicantName application={application} /></td>
                  <td>{application.instructor?.experience ? `${application.instructor.experience} years` : "Not shared"}</td>
                  <td><MatchScore score={ratingScore(application)} size={36} /></td>
                  <td><ApplicationStatusTag status={application.status} /></td>
                  <td>{formatRelativeTime(application.createdAt)}</td>
                  <td>
                    <ApplicationActions
                      application={application}
                      disabled={updateApplicationStatus.isPending}
                      onMove={moveApplication}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationCard({
  application,
  disabled,
  onMove,
  onOpen,
}: {
  application: JobApplication;
  disabled?: boolean;
  onMove: (application: JobApplication, status: JobApplicationStatus) => void;
  onOpen: () => void;
}) {
  return (
    <div className="kanban-card" onClick={onOpen}>
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={application.instructor?.fullName ?? "Teacher"} size="sm" />
        <div className="flex-1">
          <div className="font-medium">{application.instructor?.fullName ?? "Teacher"}</div>
          <div className="text-xs text-muted">{application.instructor?.subjects.slice(0, 2).join(", ") || "Subject not shared"}</div>
        </div>
        <MatchScore score={ratingScore(application)} size={32} />
      </div>
      <div className="mb-2 text-xs text-muted">{application.coverLetter ? `"${application.coverLetter.slice(0, 90)}..."` : "No cover letter added."}</div>
      <div className="flex items-center justify-between">
        <ApplicationStatusTag status={application.status} />
        <span className="text-xs text-muted">{formatRelativeTime(application.createdAt)}</span>
      </div>
      <ApplicationActions application={application} disabled={disabled} onMove={onMove} />
    </div>
  );
}

function ApplicationActions({
  application,
  disabled,
  onMove,
}: {
  application: JobApplication;
  disabled?: boolean;
  onMove: (application: JobApplication, status: JobApplicationStatus) => void;
}) {
  const actions = nextApplicationActions(application.status);
  if (actions.length === 0) return <span className="text-xs text-muted">No next action</span>;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((status) => (
        <Btn
          key={status}
          disabled={disabled}
          size="sm"
          variant={status === "REJECTED" ? "danger" : "secondary"}
          onClick={(event) => {
            event.stopPropagation();
            onMove(application, status);
          }}
        >
          {formatStatus(status)}
        </Btn>
      ))}
    </div>
  );
}

function ApplicantName({ application }: { application: JobApplication }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={application.instructor?.fullName ?? "Teacher"} size="sm" />
      <div>
        <div className="font-medium">{application.instructor?.fullName ?? "Teacher"}</div>
        <div className="text-xs text-muted">{application.instructor?.city ?? "Location not shared"}</div>
      </div>
    </div>
  );
}

function ApplicationStatusTag({ status }: { status: JobApplicationStatus }) {
  const tone = status === "HIRED" || status === "COMPLETED" ? "green" : status === "INTERVIEW" || status === "SHORTLISTED" ? "purple" : status === "REJECTED" ? "red" : "ghost";
  return <Tag tone={tone}>{formatStatus(status)}</Tag>;
}

function formatPay(job: Job) {
  if (!job.rate) return "Rate TBC";
  if (job.payType === "hourly") return `£${job.rate}/hr`;
  if (job.payType === "fixed") return `£${job.rate} fixed`;
  return `£${job.rate}/day`;
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function nextApplicationActions(status: JobApplicationStatus): JobApplicationStatus[] {
  if (status === "APPLIED") return ["VIEWED", "SHORTLISTED", "REJECTED"];
  if (status === "VIEWED") return ["SHORTLISTED", "REJECTED"];
  if (status === "SHORTLISTED") return ["INTERVIEW", "REJECTED"];
  if (status === "INTERVIEW") return ["HIRED", "REJECTED"];
  if (status === "HIRED") return ["COMPLETED"];
  return [];
}

function ratingScore(application: JobApplication) {
  const rating = application.instructor?.ratingAverage;
  return rating ? Math.min(100, Math.round(rating * 20)) : 80;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "recently";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
