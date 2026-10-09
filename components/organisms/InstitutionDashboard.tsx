import { useState } from "react";

import { useActiveJobApplicantCount } from "@/features/applications/use-applications";
import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import { useRecommendedInstructors } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, MatchScore, Stat } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { JobManagementList, type JobStatusFilter } from "./JobManagementList";
import { RecentNotifications } from "./RecentNotifications";

export function InstitutionDashboard({ go, toast }: Pick<RouteProps, "go" | "toast">) {
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ACTIVE");
  const [page, setPage] = useState(1);
  const jobsQuery = useMyJobs({ limit: 6, page, status: statusFilter === "ALL" ? undefined : statusFilter });
  const jobs = jobsQuery.data?.jobs ?? [];
  const counts = jobsQuery.data?.statusCounts;
  const activeCount = counts?.ACTIVE ?? 0;
  const draftCount = counts?.DRAFT ?? 0;
  const applicantCountQuery = useActiveJobApplicantCount();
  const applicantCount = applicantCountQuery.data?.total;
  const topMatchJobsQuery = useMyJobs({ limit: 6, page: 1, status: "ACTIVE" });
  const topMatchJob = topMatchJobsQuery.data?.jobs[0];
  const topMatchesQuery = useRecommendedInstructors(topMatchJob?.id, { limit: 4, minScore: 70, page: 1 });
  const topMatches = topMatchesQuery.data?.instructors ?? [];
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
          title="School hiring workspace"
          subtitle={`${counts?.ALL ?? 0} posted roles - ${activeCount} active - ${draftCount} drafts`}
          actions={<><Btn variant="secondary" icon="download">Export</Btn><Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn></>}
        />
        <div className="grid-4 mb-7">
          <Stat value={activeCount} label="Active jobs" delta={`${draftCount} drafts`} />
          <Stat value={counts?.ALL ?? 0} label="Total posted" delta="Across all statuses" />
          <Stat value={counts?.CLOSED ?? 0} label="Closed roles" delta="Kept for records" />
          <Stat
            value={applicantCount ?? (applicantCountQuery.isError ? "-" : "...")}
            label="Applicants"
            delta={applicantCountQuery.isError ? "Count unavailable" : "Across all active jobs"}
          />
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
          </div>
          <div>
            <div className="section-title">Top matches today</div>
            <div className="sidebar-panel overflow-hidden">
              {topMatchJob ? <div className="border-b border-border bg-chalk px-3.5 py-2 text-xs text-muted">For {topMatchJob.title}</div> : null}
              {topMatchJobsQuery.isLoading || topMatchesQuery.isLoading ? <div className="p-3.5"><SectionLoader rows={4} /></div> : null}
              {topMatchJobsQuery.isError ? (
                <div className="p-4 text-center" role="alert">
                  <div className="text-sm font-semibold">Active jobs could not be loaded</div>
                  <Btn className="mt-2" size="sm" variant="ghost" onClick={() => void topMatchJobsQuery.refetch()}>Try again</Btn>
                </div>
              ) : null}
              {topMatchesQuery.isError ? (
                <div className="p-4 text-center" role="alert">
                  <div className="text-sm font-semibold">Matches could not be loaded</div>
                  <Btn className="mt-2" size="sm" variant="ghost" onClick={() => void topMatchesQuery.refetch()}>Try again</Btn>
                </div>
              ) : null}
              {!topMatchJobsQuery.isLoading && !topMatchJobsQuery.isError && !topMatchJob ? (
                <div className="p-4 text-center text-sm text-muted">Post an active job to see teacher matches.</div>
              ) : null}
              {!topMatchesQuery.isLoading && !topMatchesQuery.isError && topMatchJob && topMatches.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted">No teachers currently meet the 70% match threshold.</div>
              ) : null}
              {topMatches.slice(0, 4).map(({ instructor, match }) => (
                <button
                  key={instructor.id}
                  className="flex w-full items-center gap-2.5 border-b border-border px-3.5 py-3 text-left transition last:border-b-0 hover:bg-chalk"
                  onClick={() => go("teacher-profile", { teacherId: instructor.id })}
                  type="button"
                >
                  <Avatar name={instructor.fullName} src={instructor.imageUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{instructor.fullName}</span>
                    <span className="block truncate text-xs text-muted">{instructor.subjects[0] ?? instructor.skills[0] ?? "Teacher"}</span>
                  </span>
                  <MatchScore score={match.score} size={38} />
                </button>
              ))}
            </div>
            <div className="section-title mt-7">Quick actions</div>
            <div className="sidebar-panel card-pad flex flex-col gap-3">
              <Btn icon="plus" className="justify-start" onClick={() => go("post-job")}>Post a job</Btn>
              <Btn variant="secondary" icon="search" className="justify-start" onClick={() => go("find-teachers")}>Browse teachers</Btn>
              <Btn variant="secondary" icon="message" className="justify-start" onClick={() => go("messaging")}>Open messages</Btn>
              <Btn variant="secondary" icon="file" className="justify-start" onClick={() => go("billing")}>View invoices</Btn>
            </div>
          </div>
        </div>
        <RecentNotifications />
    </div>
  );
}
