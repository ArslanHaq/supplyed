import { useState } from "react";

import { useActiveJobApplicantCount } from "@/features/applications/use-applications";
import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import { useRecommendedInstructors } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore } from "../atoms";
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
    <div className="app-page dashboard-page school-dashboard">
      <PageHead
        title="School hiring workspace"
        subtitle={`${counts?.ALL ?? 0} posted roles - ${activeCount} active - ${draftCount} drafts`}
      />
      <div aria-label="Hiring overview" className="hiring-metrics">
        <HiringMetric context={`${draftCount} ${draftCount === 1 ? "draft" : "drafts"} to publish`} icon="file" label="Active jobs" value={activeCount} emphasis />
        <HiringMetric context="Across all statuses" icon="building" label="Total posted" value={counts?.ALL ?? 0} />
        <HiringMetric context="Kept for your records" icon="checkCircle" label="Closed roles" value={counts?.CLOSED ?? 0} />
        <HiringMetric context={applicantCountQuery.isError ? "Count unavailable" : "Across your active jobs"} icon="users" label="Applicants" value={applicantCount ?? (applicantCountQuery.isError ? "-" : "...")} />
      </div>
      <div className="hiring-workspace-grid">
        <div className="hiring-workspace-main">
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
            refreshing={jobsQuery.isFetching}
            title="Job posts"
          />
          <RecentNotifications />
        </div>
        <aside aria-label="Teacher matches and quick actions" className="hiring-workspace-rail">
          <section className="hiring-matches-panel card">
            <header className="hiring-panel-heading">
              <div><h2>Top matches today</h2><p>Find the right fit for your classroom.</p></div>
              <span aria-hidden="true" className="hiring-panel-icon"><Icon name="zap" size={18} /></span>
            </header>
            {topMatchJob ? <div className="hiring-match-role"><span>Matching for</span><strong>{topMatchJob.title}</strong></div> : null}
            {topMatchJobsQuery.isLoading || topMatchesQuery.isLoading ? <div className="p-5"><SectionLoader rows={3} /></div> : null}
            {topMatchJobsQuery.isError ? (
              <div className="hiring-match-empty" role="alert"><Icon name="search" size={24} /><h3>Active jobs could not be loaded</h3><Btn size="sm" variant="ghost" onClick={() => void topMatchJobsQuery.refetch()}>Try again</Btn></div>
            ) : null}
            {topMatchesQuery.isError ? (
              <div className="hiring-match-empty" role="alert"><Icon name="search" size={24} /><h3>Matches could not be loaded</h3><Btn size="sm" variant="ghost" onClick={() => void topMatchesQuery.refetch()}>Try again</Btn></div>
            ) : null}
            {!topMatchJobsQuery.isLoading && !topMatchJobsQuery.isError && !topMatchJob ? (
              <div className="hiring-match-empty"><Icon name="users" size={26} /><h3>Your next great teacher is out there.</h3><p>Post an active job to see teacher matches.</p></div>
            ) : null}
            {!topMatchesQuery.isLoading && !topMatchesQuery.isError && topMatchJob && topMatches.length === 0 ? (
              <div className="hiring-match-empty"><Icon name="users" size={26} /><h3>No matches just yet</h3><p>No teachers currently meet the 70% match threshold.</p></div>
            ) : null}
            {topMatches.slice(0, 4).map(({ instructor, match }) => (
              <button className="hiring-teacher-match" key={instructor.id} onClick={() => go("teacher-profile", { teacherId: instructor.id })} type="button">
                <Avatar name={instructor.fullName} src={instructor.imageUrl} />
                <span><strong>{instructor.fullName}</strong><small>{instructor.subjects[0] ?? instructor.skills[0] ?? "Teacher"}</small></span>
                <MatchScore score={match.score} size={38} />
              </button>
            ))}
            <div className="hiring-panel-footer"><Btn iconRight="arrowRight" size="sm" variant="ghost" onClick={() => go("find-teachers")}>Browse all teachers</Btn></div>
          </section>
          <section className="hiring-actions-panel card">
            <header className="hiring-panel-heading"><div><h2>Quick actions</h2><p>Keep your school moving.</p></div></header>
            <HiringAction icon="plus" label="Post a job" description="Find cover for your classroom" onClick={() => go("post-job")} />
            <HiringAction icon="search" label="Browse teachers" description="Explore the teacher directory" onClick={() => go("find-teachers")} />
            <HiringAction icon="message" label="Open messages" description="Keep conversations moving" onClick={() => go("messaging")} />
            <HiringAction icon="file" label="View invoices" description="Manage your booking payments" onClick={() => go("billing")} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function HiringMetric({ context, emphasis, icon, label, value }: { context: string; emphasis?: boolean; icon: string; label: string; value: number | string }) {
  return <div className={`hiring-metric${emphasis ? " is-primary" : ""}`}><div className="hiring-metric-top"><span>{label}</span><Icon name={icon} size={18} /></div><strong>{value}</strong><p>{context}</p></div>;
}

function HiringAction({ description, icon, label, onClick }: { description: string; icon: string; label: string; onClick: () => void }) {
  return <button className="hiring-action" onClick={onClick} type="button"><span aria-hidden="true" className="hiring-action-icon"><Icon name={icon} size={17} /></span><span><strong>{label}</strong><small>{description}</small></span><Icon name="chevronRight" size={16} /></button>;
}
