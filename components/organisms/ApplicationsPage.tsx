import { useState } from "react";

import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useJobApplications, useUpdateApplicationStatus } from "@/features/applications/use-applications";
import type { Job } from "@/features/jobs/types";
import { useJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { MatchedInstructor } from "@/features/matching/types";
import { useRankedApplications, useRecommendedInstructors } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Tag } from "../atoms";
import { MatchScorePanel, PageHead, SectionLoader } from "../molecules";

type Tab = "best" | "pipeline" | "recommended";

export function ApplicationsPage({ go, ctx, toast }: Pick<RouteProps, "go" | "ctx" | "toast">) {
  const [tab, setTab] = useState<Tab>("best");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);
  const myJobsQuery = useMyJobs();
  const selectedJobId = ctx.jobId ?? myJobsQuery.data?.[0]?.id;
  const publicJobQuery = useJob(selectedJobId ?? "");
  const job = myJobsQuery.data?.find((item) => item.id === selectedJobId) ?? publicJobQuery.data ?? null;
  const applicationsQuery = useJobApplications(selectedJobId, { limit: 100 });
  const rankedQuery = useRankedApplications(selectedJobId, { limit: 20, minScore, page });
  const instructorsQuery = useRecommendedInstructors(selectedJobId, { limit: 20, minScore, page });
  const applications = applicationsQuery.data?.applications ?? [];
  const updateJob = useUpdateJob({ onSuccess: (result) => toast({ title: result.ok ? "Job updated" : "Could not update job", msg: result.message ?? "The job status was updated.", tone: result.ok ? "success" : "danger" }) });
  const updateStatus = useUpdateApplicationStatus({ onSuccess: (result) => toast({ title: result.ok ? "Application updated" : "Could not update application", msg: result.message ?? "The application status was updated.", tone: result.ok ? "success" : "danger" }) });

  if (!selectedJobId && !myJobsQuery.isLoading) {
    return <div className="app-page"><PageHead title="Applications" subtitle="Post a role first, then applicants will appear here." actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>} /><EmptyState title="No posted roles yet" message="Create an active role to start receiving and matching teacher applications." /></div>;
  }

  const pagination = tab === "best" ? rankedQuery.data?.pagination : tab === "recommended" ? instructorsQuery.data?.pagination : undefined;
  const activeLoading = myJobsQuery.isLoading || (tab === "best" ? rankedQuery.isLoading : tab === "recommended" ? instructorsQuery.isLoading : applicationsQuery.isLoading);
  const activeError = tab === "best" ? rankedQuery.error : tab === "recommended" ? instructorsQuery.error : applicationsQuery.error;

  return (
    <div className="app-page">
      <PageHead
        title={job?.title ?? "Applications"}
        subtitle={`${job ? `${formatLocation(job)} - ${job.date} - ${formatPay(job)} - ` : ""}${applicationsQuery.data?.pagination.total ?? applications.length} applications`}
        actions={<><Btn variant="secondary" size="sm" onClick={() => go("post-job")}>Post another role</Btn>{selectedJobId ? <Btn variant="secondary" size="sm" icon="edit" onClick={() => go("post-job", { jobId: selectedJobId })}>Edit role</Btn> : null}{job?.status === "ACTIVE" || job?.status === "DRAFT" ? <Btn disabled={updateJob.isPending} loading={updateJob.isPending} loadingLabel="Closing" size="sm" variant="ghost" onClick={() => updateJob.mutate({ id: job.id, status: "CLOSED" })}>Close role</Btn> : null}</>}
      />

      <div className="card card-pad mb-6 flex flex-wrap items-center gap-3">
        {([['best', 'Best match'], ['pipeline', 'All applications'], ['recommended', 'Recommended teachers']] as const).map(([value, label]) => <Btn key={value} size="sm" variant={tab === value ? "secondary" : "ghost"} onClick={() => { setTab(value); setPage(1); }}>{label}</Btn>)}
        {tab !== "pipeline" ? <label className="ml-auto flex items-center gap-2 text-xs font-semibold">Minimum score<input aria-label="Minimum match score" className="input w-24" min={0} max={100} type="number" value={minScore} onChange={(event) => { setMinScore(Math.min(100, Math.max(0, Number(event.target.value) || 0))); setPage(1); }} /></label> : null}
      </div>

      {activeLoading ? <SectionLoader rows={4} /> : null}
      {activeError && !activeLoading ? <EmptyState title="Matches unavailable" message={activeError.message || "You may not have permission to view matches for this job."} /> : null}

      {!activeLoading && !activeError && tab === "best" ? <div className="space-y-4">
        {(rankedQuery.data?.applications ?? []).map(({ application, instructor, match }) => <div key={application.id} className="card card-pad-lg"><CandidateHeader instructor={instructor} status={application.status} onOpen={() => go("teacher-profile", { teacherId: instructor.id })} />{application.coverLetter ? <p className="my-4 border-l-2 border-brand-tint-2 pl-4 text-sm leading-6 text-muted">{application.coverLetter}</p> : null}<MatchScorePanel match={match} /><StatusActions application={application} pending={updateStatus.isPending} onUpdate={(status) => updateStatus.mutate({ id: application.id, status })} /></div>)}
        {rankedQuery.data?.applications.length === 0 ? <EmptyState title="No matching applications" message="No applications meet the selected minimum score." /> : null}
      </div> : null}

      {!activeLoading && !activeError && tab === "pipeline" ? <div className="card overflow-hidden">{applications.length ? <div className="divide-y divide-border">{applications.map((application) => <div key={application.id} className="p-5"><CandidateHeader instructor={application.instructor} status={application.status} onOpen={() => go("teacher-profile", { teacherId: application.instructor?.id })} />{application.coverLetter ? <p className="mt-3 text-sm leading-6 text-muted">{application.coverLetter}</p> : null}<StatusActions application={application} pending={updateStatus.isPending} onUpdate={(status) => updateStatus.mutate({ id: application.id, status })} /></div>)}</div> : <EmptyState title="No applications yet" message="Applications will appear here when instructors apply." />}</div> : null}

      {!activeLoading && !activeError && tab === "recommended" ? <div className="space-y-4">
        {(instructorsQuery.data?.instructors ?? []).map(({ instructor, match }) => <div key={instructor.id} className="card card-pad-lg"><CandidateHeader instructor={instructor} onOpen={() => go("teacher-profile", { teacherId: instructor.id })} /><div className="mt-4"><MatchScorePanel match={match} /></div></div>)}
        {instructorsQuery.data?.instructors.length === 0 ? <EmptyState title="No recommended teachers" message="No eligible instructors meet the selected minimum score." /> : null}
      </div> : null}

      {pagination && pagination.totalPages > 1 ? <div className="mt-5 flex items-center justify-between"><Btn disabled={page <= 1} variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn><span className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</span><Btn disabled={!pagination.hasNextPage} variant="secondary" onClick={() => setPage((value) => value + 1)}>Next</Btn></div> : null}
    </div>
  );
}

function CandidateHeader({ instructor, status, onOpen }: { instructor?: MatchedInstructor; status?: JobApplicationStatus; onOpen: () => void }) {
  return <div className="flex flex-wrap items-center gap-3"><Avatar name={instructor?.fullName ?? "Teacher"} /><div className="min-w-[180px] flex-1"><button className="cursor-pointer text-left font-semibold hover:text-brand" onClick={onOpen} type="button">{instructor?.fullName ?? "Teacher"}</button><div className="text-xs text-muted">{[instructor?.city, instructor?.county].filter(Boolean).join(", ") || "Location not shared"} · {instructor?.experience != null ? `${instructor.experience} years experience` : "Experience not shared"}</div><div className="mt-1 flex flex-wrap gap-1">{instructor?.subjects.slice(0, 3).map((subject) => <span className="pill" key={subject}>{subject}</span>)}</div></div>{status ? <ApplicationStatusTag status={status} /> : <Tag tone="ghost">Recommendation</Tag>}</div>;
}

function StatusActions({ application, pending, onUpdate }: { application: JobApplication; pending: boolean; onUpdate: (status: JobApplicationStatus) => void }) {
  return <div className="mt-4 flex flex-wrap gap-2">{(["SHORTLISTED", "INTERVIEW", "HIRED", "REJECTED"] as JobApplicationStatus[]).filter((status) => status !== application.status).map((status) => <Btn key={status} disabled={pending} size="sm" variant={status === "REJECTED" ? "danger" : "secondary"} onClick={() => onUpdate(status)}>{formatStatus(status)}</Btn>)}</div>;
}

function ApplicationStatusTag({ status }: { status: JobApplicationStatus }) {
  const tone = status === "HIRED" || status === "COMPLETED" ? "green" : status === "INTERVIEW" || status === "SHORTLISTED" ? "purple" : status === "REJECTED" ? "red" : "ghost";
  return <Tag tone={tone}>{formatStatus(status)}</Tag>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="card card-pad-lg text-center"><div className="font-serif text-[24px]">{title}</div><p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">{message}</p></div>;
}

function formatPay(job: Job) { if (!job.rate) return "Rate TBC"; if (job.payType === "hourly") return `£${job.rate}/hr`; if (job.payType === "fixed") return `£${job.rate} fixed`; return `£${job.rate}/day`; }
function formatLocation(job: Job) { return [job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC"; }
function formatStatus(status: string) { return status.toLowerCase().replace(/_/g, " "); }
