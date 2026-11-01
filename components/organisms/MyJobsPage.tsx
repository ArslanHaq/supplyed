import { useState, type FormEvent } from "react";

import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job, JobType } from "@/features/jobs/types";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Icon } from "../atoms";
import { PageHead } from "../molecules";
import { DeleteJobModal } from "./DeleteJobModal";
import { JobManagementList, type JobStatusFilter } from "./JobManagementList";

type TypeFilter = "ALL" | JobType;

export function MyJobsPage({ ctx, go, toast }: Pick<RouteProps, "ctx" | "go" | "toast">) {
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState(ctx.search ?? "");
  const [search, setSearch] = useState((ctx.search ?? "").trim().slice(0, 100));
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const jobsQuery = useMyJobs({
    jobType: typeFilter === "ALL" ? undefined : typeFilter,
    limit: 20,
    page,
    search: search || undefined,
    status: statusFilter === "ALL" ? undefined : statusFilter,
  });
  const countsQuery = useMyJobs({ limit: 1, page: 1 });
  const counts = countsQuery.data?.statusCounts ?? jobsQuery.data?.statusCounts;
  const updateJob = useUpdateJob({
    onSuccess: (result) => toast({ title: result.ok ? "Job updated" : "Could not update job", msg: result.message ?? "The job status was updated.", tone: result.ok ? "success" : "danger" }),
    onError: () => toast({ title: "Could not update job", msg: "Please try again.", tone: "danger" }),
  });
  const deleteJob = useDeleteJob({
    onSuccess: (result) => {
      if (result.ok || result.code === "JOB_HISTORY_PROTECTED") setDeleteTarget(null);
      toast({ title: result.ok ? "Job deleted" : "Could not delete job", msg: result.message ?? "The job could not be deleted.", tone: result.ok ? "success" : "danger" });
    },
    onError: () => toast({ title: "Could not delete job", msg: "Please try again.", tone: "danger" }),
  });

  function applySearch(event?: FormEvent) {
    event?.preventDefault();
    setSearch(searchDraft.trim().slice(0, 100));
    setPage(1);
  }

  return (
    <div className="app-page my-jobs-page">
      <DeleteJobModal job={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={(job) => deleteJob.mutate(job.id)} pending={deleteJob.isPending} />
      <PageHead title="My Jobs" subtitle="Search, filter and manage every role your school has created." actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>} />

      <form className="card card-pad mb-5 flex flex-wrap items-center gap-3" onSubmit={applySearch}>
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3.5 py-2.5">
          <Icon name="search" size={16} />
          <span className="sr-only">Search your jobs</span>
          <input className="min-w-0 flex-1 border-0 bg-transparent outline-none" maxLength={100} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search by title, subject or location" value={searchDraft} />
        </label>
        <Btn icon="search" type="submit">Search</Btn>
        {search ? <Btn variant="ghost" onClick={() => { setSearchDraft(""); setSearch(""); setPage(1); }}>Clear</Btn> : null}
      </form>

      <div aria-label="Filter jobs by type" className="mb-4 flex flex-wrap gap-2">
        {(["ALL", "INSTANT", "BRIEF"] as const).map((value) => (
          <Btn key={value} aria-pressed={typeFilter === value} size="sm" variant={typeFilter === value ? "secondary" : "ghost"} onClick={() => { setTypeFilter(value); setPage(1); }}>
            {value === "ALL" ? "All job types" : value === "INSTANT" ? "Instant jobs" : "Brief jobs"}
          </Btn>
        ))}
      </div>

      {jobsQuery.isError ? (
        <div className="card card-pad mb-4 text-center" role="alert">
          <h2 className="font-heading text-xl">Jobs could not be loaded</h2>
          <p className="mt-2 text-sm text-muted">{jobsQuery.error.message}</p>
          <Btn className="mt-4" variant="secondary" onClick={() => void jobsQuery.refetch()}>Try again</Btn>
        </div>
      ) : null}

      {!jobsQuery.isError ? <JobManagementList
        actionPending={updateJob.isPending || deleteJob.isPending}
        counts={counts}
        emptyMessage={search ? "No jobs match your current search and filters." : "Create a role to start matching with approved instructors."}
        filter={statusFilter}
        jobs={jobsQuery.data?.jobs ?? []}
        loading={jobsQuery.isLoading}
        onApplications={(job) => go("applications", { jobId: job.id })}
        onClose={(job) => updateJob.mutate({ id: job.id, status: "CLOSED" })}
        onCreate={() => go("post-job")}
        onDelete={setDeleteTarget}
        onEdit={(job) => go("post-job", { jobId: job.id })}
        onInvitations={() => go("job-invitations")}
        onViewPublic={(job) => window.location.assign(`/jobs/${encodeURIComponent(job.id)}`)}
        onFilterChange={(filter) => { setStatusFilter(filter); setPage(1); }}
        onPageChange={setPage}
        pagination={jobsQuery.data?.pagination}
        refreshing={jobsQuery.isFetching}
        title="All job posts"
      /> : null}
    </div>
  );
}
