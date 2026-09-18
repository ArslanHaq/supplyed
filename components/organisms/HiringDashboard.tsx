import { useState } from "react";
import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import { displayedJobStatus } from "@/features/jobs/presentation";
import type { RouteProps } from "@/types/supplyed";
import { Btn, Stat } from "../atoms";
import { PageHead } from "../molecules";
import { JobManagementList, type JobStatusFilter } from "./JobManagementList";
export function HiringDashboard({ go, toast, role, state }: Pick<RouteProps, "go" | "toast" | "role" | "state">) {
  const [filter, setFilter] = useState<JobStatusFilter>("ALL");
  const query = useMyJobs();
  const jobs = query.data ?? [];
  const notify = (result: { ok: boolean; message?: string }) =>
    toast({
      title: result.ok ? "Role updated" : "Could not update role",
      msg: result.message ?? "Please try again.",
      tone: result.ok ? "success" : "danger",
    });
  const update = useUpdateJob({ onSuccess: notify, onError: () => notify({ ok: false }) });
  const remove = useDeleteJob({ onSuccess: notify, onError: () => notify({ ok: false }) });
  return (
    <div className="app-page">
      <PageHead
        title={role === "institution" ? "School workspace" : "Hiring workspace"}
        subtitle="Manage your roles and review instructor applications."
        actions={
          <>
            <Btn variant="secondary" onClick={() => go("find-jobs")}>
              Browse jobs
            </Btn>
            <Btn disabled={!state.isFullyVerified} onClick={() => go("post-job")}>
              Post a job
            </Btn>
          </>
        }
      />
      <div className="grid-4 mb-7">
        {(
          [
            ["Posted roles", jobs.length],
            ["Active", jobs.filter((job) => displayedJobStatus(job) === "ACTIVE").length],
            ["Drafts", jobs.filter((job) => job.status === "DRAFT").length],
            ["Closed", jobs.filter((job) => job.status === "CLOSED").length],
          ] as const
        ).map(([label, value]) => (
          <Stat key={label} label={label} value={query.isLoading ? "..." : query.isError ? "?" : String(value)} />
        ))}
      </div>
      {query.isError ? (
        <div role="alert" className="card card-pad">
          <p>{query.error.message}</p>
          <Btn onClick={() => void query.refetch()}>Try again</Btn>
        </div>
      ) : (
        <JobManagementList
          title="Your roles"
          filter={filter}
          onFilterChange={setFilter}
          jobs={jobs}
          loading={query.isLoading}
          actionPending={update.isPending || remove.isPending}
          emptyMessage="Your saved drafts and posted roles will appear here."
          onCreate={() => go("post-job")}
          onEdit={(job) => go("post-job", { jobId: job.id })}
          onApplications={(job) => go("applications", { jobId: job.id })}
          onClose={(job) => update.mutate({ id: job.id, status: "CLOSED" })}
          onDelete={(job) => {
            if (
              window.confirm(
                `Permanently delete "${job.title}" and its applications? Close the role instead to preserve its records.`,
              )
            )
              remove.mutate(job.id);
          }}
        />
      )}
    </div>
  );
}
