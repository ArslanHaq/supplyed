import { useState } from "react";

import { seedTeachers } from "@/data/supplyed";
import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stat, Tag, VerifyBadge } from "../atoms";
import { PageHead } from "../molecules";
import { JobManagementList, type JobStatusFilter } from "./JobManagementList";

export function IndividualDashboard({ go, toast }: Pick<RouteProps, "go" | "toast">) {
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ALL");
  const jobsQuery = useMyJobs();
  const jobs = jobsQuery.data ?? [];
  const activeJobs = jobs.filter((job) => job.status === "ACTIVE");
  const draftJobs = jobs.filter((job) => job.status === "DRAFT");
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
  const deleteJob = useDeleteJob({
    onSuccess: (result) => {
      toast({
        title: result.ok ? "Job deleted" : "Could not delete job",
        msg: result.message ?? "The job was deleted.",
        tone: result.ok ? "success" : "danger",
      });
    },
    onError: () => {
      toast({ title: "Could not delete job", msg: "Please try again.", tone: "danger" });
    },
  });

  function closeJob(job: Job) {
    updateJob.mutate({ id: job.id, status: "CLOSED" });
  }

  function removeJob(job: Job) {
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    deleteJob.mutate(job.id);
  }

  return (
    <div className="app-page">
      <PageHead
        title="Hiring workspace"
        subtitle={`${jobs.length} posted roles - ${activeJobs.length} active - ${draftJobs.length} drafts`}
        actions={
          <>
            <Btn variant="secondary" icon="message" onClick={() => go("messaging")}>
              Messages
            </Btn>
            <Btn icon="plus" onClick={() => go("post-job")}>
              Post a job
            </Btn>
          </>
        }
      />

      <div className="grid-4 mb-7">
        <Stat value={activeJobs.length} label="Active jobs" delta={`${draftJobs.length} drafts`} />
        <Stat value={jobs.length} label="Total posted" delta="All statuses" />
        <Stat value={jobs.filter((job) => job.status === "CLOSED").length} label="Closed roles" delta="History retained" />
        <Stat value="100%" label="Safety setup" delta="Account-led contact" />
      </div>

      <div className="two-col">
        <div>
          <JobManagementList
            actionPending={updateJob.isPending || deleteJob.isPending}
            emptyMessage="Post your first hiring need and review verified instructors from this workspace."
            filter={statusFilter}
            jobs={jobs}
            loading={jobsQuery.isLoading}
            onApplications={(job) => go("applications", { jobId: job.id })}
            onClose={closeJob}
            onCreate={() => go("post-job")}
            onDelete={removeJob}
            onEdit={(job) => go("post-job", { jobId: job.id })}
            onFilterChange={setStatusFilter}
            title="Posted roles"
          />

          <div className="section-title mt-7">Recommended verified teachers</div>
          <div className="flex flex-col gap-3">
            {seedTeachers.slice(0, 3).map((teacher) => (
              <div key={teacher.id} className="card card-pad flex cursor-pointer flex-wrap items-center gap-4" onClick={() => go("teacher-profile", { teacherId: teacher.id })}>
                <Avatar name={teacher.name} tone={teacher.tone} />
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{teacher.name}</div>
                    {teacher.dbs ? <VerifyBadge /> : null}
                    {teacher.qts ? <Tag tone="ghost">QTS</Tag> : null}
                  </div>
                  <div className="text-xs text-muted">
                    {teacher.role} - {teacher.city} - Available {teacher.availability}
                  </div>
                </div>
                <MatchScore score={teacher.matchScore} size={40} />
                <Btn
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    toast({ title: "Request sent", msg: `${teacher.name} has received your availability request.` });
                  }}
                >
                  Request
                </Btn>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title">Safeguarding</div>
          <div className="card card-pad border-brand bg-brand-tint">
            <Tag tone="green">Verified teachers only</Tag>
            <div className="mt-3 font-serif text-[24px]">Documents stay private</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              Hirers see verification badges. DBS, identity, and right-to-work documents stay restricted.
            </p>
            <div className="mt-4 space-y-2">
              {["Account-led messaging", "No learner account required", "Location shared after accepted request"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <Icon name="checkCircle" size={15} className="text-brand" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-title mt-7">Quick actions</div>
          <div className="card card-pad flex flex-col gap-2">
            <Btn icon="plus" className="justify-start" onClick={() => go("post-job")}>
              Post a job
            </Btn>
            <Btn icon="search" className="justify-start" onClick={() => go("find-teachers")}>
              Browse teachers
            </Btn>
            <Btn variant="secondary" icon="users" className="justify-start" onClick={() => go("applications")}>
              Review applications
            </Btn>
            <Btn variant="secondary" icon="message" className="justify-start" onClick={() => go("messaging")}>
              Open messages
            </Btn>
            <Btn variant="secondary" icon="calendar" className="justify-start">
              Review schedule
            </Btn>
            <Btn variant="secondary" icon="file" className="justify-start" onClick={() => go("billing")}>
              Payment settings
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
