import { useState } from "react";

import { seedTeachers } from "@/data/supplyed";
import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stat, Tag } from "../atoms";
import { PageHead } from "../molecules";
import { JobManagementList, type JobStatusFilter } from "./JobManagementList";

export function InstitutionDashboard({ go, toast, tweaks }: Pick<RouteProps, "go" | "toast" | "tweaks">) {
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const jobsQuery = useMyJobs({ limit: 20, page, status: statusFilter === "ALL" ? undefined : statusFilter });
  const jobs = jobsQuery.data?.jobs ?? [];
  const counts = jobsQuery.data?.statusCounts;
  const activeCount = counts?.ACTIVE ?? 0;
  const draftCount = counts?.DRAFT ?? 0;
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
      {tweaks.urgentBanner ? (
        <div className="urgent-banner">
          <Icon name="zap" size={16} />
          <strong>{activeCount || draftCount ? `${activeCount} active roles.` : "Ready to post your first role."}</strong>
          <span style={{ opacity: 0.8 }}>Approved school accounts can publish roles and review applicants from one workspace.</span>
          <div className="ml-auto flex gap-2">
            <Btn variant="danger" size="sm" onClick={() => go("post-job")}>Post urgent</Btn>
          </div>
        </div>
      ) : null}
      <div className="app-page">
        <PageHead
          title="School hiring workspace"
          subtitle={`${counts?.ALL ?? 0} posted roles - ${activeCount} active - ${draftCount} drafts`}
          actions={<><Btn variant="secondary" icon="download">Export</Btn><Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn></>}
        />
        <div className="grid-4 mb-7">
          <Stat value={activeCount} label="Active jobs" delta={`${draftCount} drafts`} />
          <Stat value={counts?.ALL ?? 0} label="Total posted" delta="Across all statuses" />
          <Stat value={counts?.CLOSED ?? 0} label="Closed roles" delta="Kept for records" />
          <Stat value="0" label="Applicants today" delta="Live count pending" />
        </div>
        <div className="two-col">
          <div>
            <JobManagementList
              actionPending={updateJob.isPending || deleteJob.isPending}
              counts={counts}
              emptyMessage="Create a role to start matching with approved instructors."
              filter={statusFilter}
              jobs={jobs}
              loading={jobsQuery.isLoading}
              onApplications={(job) => go("applications", { jobId: job.id })}
              onClose={closeJob}
              onCreate={() => go("post-job")}
              onDelete={removeJob}
              onEdit={(job) => go("post-job", { jobId: job.id })}
              onFilterChange={(filter) => { setStatusFilter(filter); setPage(1); }}
              onPageChange={setPage}
              pagination={jobsQuery.data?.pagination}
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
            <div className="sidebar-panel overflow-hidden">
              {seedTeachers.slice(0, 4).map((teacher, index) => (
                <div key={teacher.id} className="flex cursor-pointer items-center gap-2.5 border-b px-3.5 py-3" style={{ borderBottomColor: index < 3 ? "var(--border)" : "transparent" }} onClick={() => go("teacher-profile", { teacherId: teacher.id })}>
                  <Avatar name={teacher.name} tone={teacher.tone} />
                  <div className="flex-1"><div className="font-medium">{teacher.name}</div><div className="text-xs text-muted">{teacher.role}</div></div>
                  <MatchScore score={teacher.matchScore} size={38} />
                </div>
              ))}
            </div>
            <div className="section-title mt-7">Quick actions</div>
            <div className="sidebar-panel card-pad flex flex-col gap-3">
              <Btn icon="plus" className="justify-start" onClick={() => go("post-job")}>Post a job</Btn>
              <Btn variant="secondary" icon="search" className="justify-start" onClick={() => go("find-teachers")}>Browse teachers</Btn>
              <Btn variant="secondary" icon="message" className="justify-start" onClick={() => go("messaging")}>Open messages</Btn>
              <Btn variant="secondary" icon="file" className="justify-start" onClick={() => go("billing")}>View invoices</Btn>
            </div>
            <div className="section-title mt-7">Your plan</div>
            <div className="card card-pad border-brand bg-brand-tint">
              <Tag>Pro - Active</Tag>
              <div className="mt-2.5 font-heading text-[22px]">£99 / month</div>
              <div className="mt-1 text-xs text-muted">Renews 24 Apr 2026</div>
              <div className="progress mt-3.5"><div className="progress-fill" style={{ width: "58%" }} /></div>
              <Btn variant="ink" size="sm" className="mt-3.5 w-full" onClick={() => go("billing")}>Manage plan</Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
