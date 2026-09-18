import { ProfileVerificationPanel } from "./ProfileVerificationPanel";
import { isJobOpen } from "@/features/jobs/presentation";
import { useState } from "react";

import { seedTeachers } from "@/data/supplyed";
import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stat, Tag } from "../atoms";
import { PageHead } from "../molecules";
import { JobManagementList, type JobStatusFilter } from "./JobManagementList";

export function InstitutionDashboard({
  go,
  toast,
  tweaks,
  state,
}: Pick<RouteProps, "go" | "toast" | "tweaks" | "state">) {
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ALL");
  const jobsQuery = useMyJobs();
  const jobs = jobsQuery.data ?? [];
  const activeJobs = jobs.filter(isJobOpen);
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
    <>
      <div className="app-page">
        <PageHead
          title="School dashboard"
          subtitle="Manage your roles, discover teachers and keep hiring moving."
          actions={
            <>
              <Btn variant="secondary" icon="download">
                Export
              </Btn>
              <Btn icon="plus" onClick={() => go("post-job")}>
                Post a job
              </Btn>
            </>
          }
        />
        <ProfileVerificationPanel embedded state={state} go={go} toast={toast} />
        <div className="grid-4 mb-7">
          <Stat value={activeJobs.length} icon="file" label="Active jobs" delta={`${draftJobs.length} drafts`} />
          <Stat value={jobs.length} icon="list" label="Total posted" delta="Across all statuses" />
          <Stat
            value={jobs.filter((job) => job.status === "CLOSED").length}
            icon="checkCircle"
            label="Closed roles"
            delta="Kept for records"
          />
          <Stat value="0" icon="users" label="Applicants today" delta="Applications received" />
        </div>
        <div className="two-col">
          <div>
            <JobManagementList
              actionPending={updateJob.isPending || deleteJob.isPending}
              emptyMessage="Create a role to start matching with approved instructors."
              filter={statusFilter}
              jobs={jobs}
              loading={jobsQuery.isLoading}
              onApplications={(job) => go("applications", { jobId: job.id })}
              onClose={closeJob}
              onCreate={() => go("post-job")}
              onDelete={removeJob}
              onEdit={(job) => go("post-job", { jobId: job.id })}
              onFilterChange={setStatusFilter}
              title="Job posts"
            />
            <div className="section-title mt-7">Recent activity</div>
            <div className="card card-pad">
              {[
                "Sarah Johnson applied to Y6 Maths cover",
                "Priya Mehta accepted the interview invitation",
                "Marcus Webb sent a message",
                "Invoice #INV-2041 generated",
              ].map((entry) => (
                <div key={entry} className="flex items-center justify-between border-b border-border py-2.5">
                  <div>{entry}</div>
                  <div className="text-xs text-muted">Today</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="section-title">Top matches today</div>
            <div className="card overflow-hidden">
              {seedTeachers.slice(0, 4).map((teacher, index) => (
                <div
                  key={teacher.id}
                  className="flex cursor-pointer items-center gap-2.5 border-b px-3.5 py-3"
                  style={{ borderBottomColor: index < 3 ? "var(--border)" : "transparent" }}
                  onClick={() => go("teacher-profile", { teacherId: teacher.id })}
                >
                  <Avatar name={teacher.name} tone={teacher.tone} />
                  <div className="flex-1">
                    <div className="font-medium">{teacher.name}</div>
                    <div className="text-xs text-muted">{teacher.role}</div>
                  </div>
                  <MatchScore score={teacher.matchScore} size={38} />
                </div>
              ))}
            </div>
            {tweaks.urgentBanner ? (
              <section className="mt-6 rounded-xl border border-brand/15 bg-brand-tint p-5">
                <div className="mb-2 flex items-center gap-2 text-brand">
                  <Icon name="zap" size={17} />
                  <h2 className="font-semibold">Need urgent cover?</h2>
                </div>
                <p className="mb-4 text-sm leading-6 text-slate">
                  Post a role and connect with teachers available for your school.
                </p>
                <Btn variant="secondary" size="sm" icon="plus" onClick={() => go("post-job")}>
                  Post urgent role
                </Btn>
              </section>
            ) : null}
            <div className="section-title mt-7">Quick actions</div>
            <div className="card card-pad flex flex-col gap-2">
              <Btn icon="plus" className="justify-start" onClick={() => go("post-job")}>
                Post a job
              </Btn>
              <Btn variant="secondary" icon="search" className="justify-start" onClick={() => go("find-teachers")}>
                Browse teachers
              </Btn>
              <Btn variant="secondary" icon="message" className="justify-start" onClick={() => go("messaging")}>
                Open messages
              </Btn>
              <Btn variant="secondary" icon="file" className="justify-start" onClick={() => go("billing")}>
                View invoices
              </Btn>
            </div>
            <div className="section-title mt-7">Your plan</div>
            <div className="card card-pad border-brand bg-brand-tint">
              <Tag>Pro - Active</Tag>
              <div className="mt-2.5 font-serif text-[22px]">£99 / month</div>
              <div className="mt-1 text-xs text-muted">Renews 24 Apr 2026</div>
              <div className="progress mt-3.5">
                <div className="progress-fill" style={{ width: "58%" }} />
              </div>
              <Btn variant="ink" size="sm" className="mt-3.5 w-full" onClick={() => go("billing")}>
                Manage plan
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
