import { useState } from "react";

import { useActiveJobApplicantCount } from "@/features/applications/use-applications";
import { useBookings } from "@/features/bookings/use-bookings";
import { useInvitations } from "@/features/invitations/use-invitations";
import { getJobVisibilityLabel } from "@/features/jobs/listing-window";
import { useDeleteJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Icon, Stat, Tag } from "../../atoms";
import { PageHead, SectionLoader } from "../../molecules";
import { DeleteJobModal } from "../DeleteJobModal";
import { JobManagementList, type JobStatusFilter } from "../JobManagementList";
import { WorkspaceCallout, WorkspaceEmptyState } from "../WorkspacePanels";

export function SchoolDashboard({ go, toast, tweaks }: Pick<RouteProps, "go" | "toast" | "tweaks">) {
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const jobsQuery = useMyJobs({ limit: 20, page, status: statusFilter === "ALL" ? undefined : statusFilter });
  const applicantsQuery = useActiveJobApplicantCount();
  const invitationsQuery = useInvitations({ limit: 3, page: 1, status: "PENDING" });
  const bookingsQuery = useBookings({ limit: 3, page: 1, status: "CONFIRMED" });
  const jobs = jobsQuery.data?.jobs ?? [];
  const counts = jobsQuery.data?.statusCounts;
  const activeCount = counts?.ACTIVE ?? 0;
  const draftCount = counts?.DRAFT ?? 0;
  const visibleOnPage = jobs.filter((job) => getJobVisibilityLabel(job) === "live").length;
  const scheduledOnPage = jobs.filter((job) => getJobVisibilityLabel(job) === "scheduled").length;
  const refreshing = jobsQuery.isFetching || applicantsQuery.isFetching || invitationsQuery.isFetching || bookingsQuery.isFetching;
  const updateJob = useUpdateJob({
    onSuccess: (result) => toast({ title: result.ok ? "Job updated" : "Could not update job", msg: result.message ?? "The job status was updated.", tone: result.ok ? "success" : "danger" }),
    onError: () => toast({ title: "Could not update job", msg: "Please try again.", tone: "danger" }),
  });
  const deleteJob = useDeleteJob({
    onSuccess: (result) => {
      if (result.ok || result.code === "JOB_HISTORY_PROTECTED") setDeleteTarget(null);
      toast({ title: result.ok ? "Job deleted" : "Could not delete job", msg: result.message ?? "The job was deleted.", tone: result.ok ? "success" : "danger" });
    },
    onError: () => toast({ title: "Could not delete job", msg: "Please try again.", tone: "danger" }),
  });

  function refresh() {
    void Promise.allSettled([jobsQuery.refetch(), applicantsQuery.refetch(), invitationsQuery.refetch(), bookingsQuery.refetch()]);
  }

  return (
    <>
      <DeleteJobModal job={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={(job) => deleteJob.mutate(job.id)} pending={deleteJob.isPending} />
      {tweaks.urgentBanner ? <div className="urgent-banner"><Icon name="zap" size={16} /><strong>{activeCount || draftCount ? `${activeCount} active roles.` : "Ready to post your first role."}</strong><span style={{ opacity: 0.8 }}>Publish now or schedule a listing for a future UK date.</span><div className="ml-auto flex gap-2"><Btn variant="danger" size="sm" onClick={() => go("post-job")}>Post urgent</Btn></div></div> : null}
      <div className="app-page dashboard-page school-dashboard">
        <PageHead title="School hiring workspace" subtitle={jobsQuery.isError ? "Job totals are temporarily unavailable. Your other workspace tools are still available." : `${counts?.ALL ?? 0} roles across your hiring pipeline`} actions={<><Btn variant="secondary" icon="refresh" loading={refreshing} onClick={refresh}>Refresh</Btn><Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn></>} />
        <WorkspaceCallout eyebrow="Your hiring workspace" icon="users" title="Plan listings, review applicants, and confirm teachers." action={<Btn variant="secondary" iconRight="arrowRight" onClick={() => go("find-teachers")}>Explore teachers</Btn>}>
          Normal applicants are booked as soon as you hire them. Direct invitations create a booking only after the teacher accepts.
        </WorkspaceCallout>

        <div className="dashboard-metrics grid-4 mb-7">
          <Stat value={metric(jobsQuery, activeCount)} label="Active jobs" delta={scheduledOnPage ? `${scheduledOnPage} scheduled on this page` : `${visibleOnPage} live on this page`} />
          <Stat value={metric(applicantsQuery, applicantsQuery.data?.total ?? 0)} label="Active-job applicants" delta="Across every active role" />
          <Stat value={metric(invitationsQuery, invitationsQuery.data?.pagination.total ?? 0)} label="Pending invitations" delta="Awaiting teacher response" />
          <Stat value={metric(bookingsQuery, bookingsQuery.data?.pagination.total ?? 0)} label="Confirmed bookings" delta="Current booked placements" />
        </div>

        <div className="two-col">
          <div>
            <JobManagementList actionPending={updateJob.isPending || deleteJob.isPending} counts={counts} emptyMessage="Create a role to start matching with approved teachers." error={jobsQuery.isError} filter={statusFilter} jobs={jobs} loading={jobsQuery.isLoading} onApplications={(job) => go("applications", { jobId: job.id })} onClose={(job) => updateJob.mutate({ id: job.id, status: "CLOSED" })} onCreate={() => go("post-job")} onDelete={setDeleteTarget} onEdit={(job) => go("post-job", { jobId: job.id })} onFilterChange={(filter) => { setStatusFilter(filter); setPage(1); }} onPageChange={setPage} onRetry={() => void jobsQuery.refetch()} pagination={jobsQuery.data?.pagination} refreshing={jobsQuery.isFetching} retrying={jobsQuery.isFetching} title="Job posts" />

            <div className="section-title mt-7">Confirmed placements</div>
            {bookingsQuery.isLoading ? <SectionLoader rows={3} /> : bookingsQuery.error ? <DashboardError message="Confirmed bookings could not be loaded." onRetry={() => void bookingsQuery.refetch()} /> : bookingsQuery.data?.bookings.length ? <div className="card overflow-hidden">{bookingsQuery.data.bookings.map((booking) => <button className="flex w-full items-center gap-3 border-b border-border p-4 text-left last:border-0 hover:bg-chalk" key={booking.id} onClick={() => go("bookings", { bookingId: booking.id })} type="button"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand"><Icon name="calendar" size={18} /></span><span className="min-w-0 flex-1"><strong className="block truncate">{booking.job.title}</strong><span className="block text-xs text-muted">{booking.instructor.fullName || "Teacher"} · {dateRange(booking.startDate, booking.endDate)}</span></span><Tag tone="green">Confirmed</Tag><Icon name="chevronRight" size={16} /></button>)}</div> : <WorkspaceEmptyState icon="calendar" title="No confirmed placements" message="A booking appears here after you hire an applicant or a teacher accepts an invitation." />}
          </div>

          <div>
            <div className="section-title">Pending invitations</div>
            {invitationsQuery.isLoading ? <SectionLoader rows={3} /> : invitationsQuery.error ? <DashboardError message="Invitations could not be loaded." onRetry={() => void invitationsQuery.refetch()} /> : invitationsQuery.data?.invitations.length ? <div className="sidebar-panel overflow-hidden">{invitationsQuery.data.invitations.map((invitation) => <button className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-left last:border-0 hover:bg-chalk" key={invitation.id} onClick={() => go("job-invitations", { invitationId: invitation.id })} type="button"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon name="mail" size={17} /></span><span className="min-w-0 flex-1"><strong className="block truncate">{invitation.instructor.fullName}</strong><span className="block truncate text-xs text-muted">{invitation.job.title}</span><small className="text-xs text-muted">Reply by {formatDate(invitation.expiresAt)}</small></span><Icon name="chevronRight" size={16} /></button>)}</div> : <WorkspaceEmptyState icon="mail" title="No pending invitations" message="Invite a teacher from the directory or a teacher profile." />}
            <Btn className="mt-3 w-full" variant="secondary" iconRight="arrowRight" onClick={() => go("job-invitations")}>View all invitations</Btn>

            <div className="section-title mt-7">Quick actions</div>
            <div className="dashboard-quick-actions sidebar-panel card-pad flex flex-col gap-3">
              <Btn icon="plus" className="justify-start" onClick={() => go("post-job")}>Post or schedule a job</Btn>
              <Btn variant="secondary" icon="search" className="justify-start" onClick={() => go("find-teachers")}>Browse and invite teachers</Btn>
              <Btn variant="secondary" icon="users" className="justify-start" onClick={() => go("applications")}>Review applications</Btn>
              <Btn variant="secondary" icon="calendar" className="justify-start" onClick={() => go("bookings")}>Manage bookings</Btn>
              <Btn variant="secondary" icon="message" className="justify-start" onClick={() => go("messaging")}>Open messages</Btn>
            </div>

            <div className="mt-7 rounded-xl border border-brand bg-brand-tint p-5">
              <div className="flex items-start gap-3"><Icon name="shield" size={20} /><div><h3 className="font-heading text-lg">Two clear hiring routes</h3><p className="mt-1 text-sm leading-6 text-muted">Hiring an applicant creates the booking immediately and closes the job. An invitation stays pending until the selected teacher accepts.</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function metric(query: { isLoading: boolean; isError: boolean }, value: number) { return query.isLoading ? "..." : query.isError ? "—" : value; }
function formatDate(value?: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)) : "Date to confirm"; }
function dateRange(start?: string | null, end?: string | null) { const first = formatDate(start); const last = formatDate(end); return first === last ? first : `${first} – ${last}`; }
function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="card p-5" role="alert"><p className="text-sm text-muted">{message}</p><Btn className="mt-3" size="sm" variant="secondary" onClick={onRetry}>Try again</Btn></div>; }
