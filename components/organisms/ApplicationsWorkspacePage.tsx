import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";
import { useSchoolHiringAllowed } from "@/features/auth/use-school-hiring";
import { useRateLimit } from "@/lib/rate-limit";
import { useState } from "react";
import { useStartConversation } from "@/features/conversations/use-conversations";

import type { ApplicantSummary, JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useApplicationHistory, useJobApplications, useUpdateApplicationStatus } from "@/features/applications/use-applications";
import { hasRecordedApplicationTerms } from "@/features/applications/terms";
import { AgreedTerms } from "../molecules/AgreedTerms";
import { applicationPipeline, canTransitionApplication } from "@/features/applications/workflow";
import type { Job } from "@/features/jobs/types";
import { useJob, useUpdateJob } from "@/features/jobs/use-jobs";
import type { MatchedInstructor, MatchResult } from "@/features/matching/types";
import { useRankedApplications } from "@/features/matching/use-matching";
import type { ProfileReview } from "@/features/reviews/types";
import { useInstructorReviews } from "@/features/reviews/use-reviews";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { MatchScorePanel, Modal, PageHead, ProposalContent, SectionLoader } from "../molecules";
import { BookingPaymentNotice } from "../molecules/BookingPaymentNotice";
import { ProposalPreview } from "../molecules/ProposalPreviewModal";
import { ApplicationsJobList } from "./ApplicationsJobList";
import { RatingStars } from "./ProfileReviewsPanel";
import { WorkspaceEmptyState, WorkspaceSummary } from "./WorkspacePanels";

type ApplicationRow = {
  application: JobApplication;
  instructor?: ApplicantSummary | MatchedInstructor;
  match?: MatchResult;
};

export function ApplicationsPage({ go, ctx, toast }: Pick<RouteProps, "go" | "ctx" | "toast">) {
  const hiringAllowed = useSchoolHiringAllowed();
  const retryAfter = useRateLimit();
  const message = useStartConversation();
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsFilter, setJobsFilter] = useState<"ACTIVE" | "INVITED">("ACTIVE");
  const [hireTarget, setHireTarget] = useState<JobApplication | null>(null);
  const selectedJobId = ctx.jobId;
  const jobQuery = useJob(selectedJobId ?? "", true);
  const job = jobQuery.data ?? null;
  const applicationsQuery = useJobApplications(selectedJobId, { limit: 100 });
  const rankedQuery = useRankedApplications(selectedJobId, { limit: 100, minScore: 0, page: 1 });
  const applications = applicationsQuery.data?.applications ?? [];
  const rows = toApplicationRows(applications, rankedQuery.data?.applications ?? []);
  const selectedRow = ctx.applicationId ? rows.find((row) => row.application.id === ctx.applicationId) : undefined;
  const currentHireTarget = hireTarget ? applications.find((application) => application.id === hireTarget.id) : undefined;
  const canConfirmHire = Boolean(hiringAllowed && !retryAfter && currentHireTarget && hasRecordedApplicationTerms(currentHireTarget) && job?.status === "ACTIVE" && canTransitionApplication(currentHireTarget.status, "HIRED"));

  const updateJob = useUpdateJob({
    onSuccess: (result) => {
      toast({
        title: result.ok ? "Job updated" : "Could not update job",
        msg: result.message ?? "The job status was updated.",
        tone: result.ok ? "success" : "danger",
      });
    },
  });

  const updateStatus = useUpdateApplicationStatus({
    onSuccess: (result) => {
      const hired = result.ok && result.data.status === "HIRED";
      toast({
        title: hired ? "Teacher hired" : result.ok ? "Application updated" : "Could not update application",
        msg: hired
          ? `Your booking is ready.${result.data.automaticallyRejectedCount ? ` ${result.data.automaticallyRejectedCount} other ${result.data.automaticallyRejectedCount === 1 ? "application was" : "applications were"} automatically rejected.` : ""} Once completed, create its Stripe invoice from Bookings.`
          : result.message ?? "The application status was updated.",
        tone: result.ok ? "success" : "danger",
      });
      if (result.ok) setHireTarget(null);
    },
  });

  function openApplication(application: JobApplication) {
    if (!selectedJobId) return;
    go("applications", { applicationId: application.id, jobId: selectedJobId });
  }

  function closeApplication() {
    if (!selectedJobId) return;
    go("applications", { jobId: selectedJobId });
  }

  function changeStatus(application: JobApplication, status: JobApplicationStatus) {
    const current = applications.find((item) => item.id === application.id);
    if (updateStatus.isPending || !current || !canTransitionApplication(current.status, status)) return;
    if (status === "HIRED") {
      if (!hiringAllowed || retryAfter || !hasRecordedApplicationTerms(current) || job?.status !== "ACTIVE") return;
      setHireTarget(current);
      return;
    }
    updateStatus.mutate({ id: current.id, status });
  }

  function confirmHire() {
    if (updateStatus.isPending || !canConfirmHire || !currentHireTarget || !canTransitionApplication(currentHireTarget.status, "HIRED")) return;
    updateStatus.mutate({ id: currentHireTarget.id, status: "HIRED" });
  }

  if (!selectedJobId) {
    return (
      <div className="app-page applications-workspace">
        <PageHead
          title="Applications"
          subtitle="Choose an active job to review its applications and manage each teacher's progress."
          actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>}
        />
        <ApplicationsJobList
          filter={jobsFilter}
          onFilterChange={(filter) => { setJobsFilter(filter); setJobsPage(1); }}
          onOpenInvitationStatus={() => go("job-invitations")}
          onOpenJob={(jobId) => go("applications", { jobId })}
          onPageChange={setJobsPage}
          page={jobsPage}
        />
      </div>
    );
  }

  const loading = jobQuery.isLoading || applicationsQuery.isLoading;
  const error = applicationsQuery.error ?? jobQuery.error;

  return (
    <>
      <div className="app-page applications-workspace">
        {selectedRow ? (
          <ApplicationDetail
            applicationRow={selectedRow}
            job={job}
            loadingScore={rankedQuery.isLoading}
            onBack={closeApplication}
            onHire={(application) => changeStatus(application, "HIRED")}
            onMessage={(applicationId) => {
              if (!message.isPending) message.mutate({ applicationId }, {
                onSuccess: conversation => go("messaging", { conversationId: conversation.id }),
                onError: error => toast({ title: "Could not open conversation", msg: error.message, tone: "danger" }),
              });
            }}
            onOpenTeacher={(teacherId) => go("teacher-profile", { teacherId })}
            onStatusChange={changeStatus}
            pending={updateStatus.isPending || Boolean(retryAfter)}
          />
        ) : (
          <>
            <PageHead
              title={job?.title ?? "Applications"}
              subtitle={`${job ? `${formatLocation(job)} - ${job.date} - ${formatPay(job)} - ` : ""}${applicationsQuery.data?.pagination.total ?? applications.length} applications`}
              actions={
                <>
                  <Btn variant="secondary" size="sm" icon="arrowLeft" onClick={() => go("applications")}>Back to active jobs</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => go("post-job")}>Post another role</Btn>
                  {selectedJobId ? <Btn variant="secondary" size="sm" icon="edit" onClick={() => go("post-job", { jobId: selectedJobId })}>Edit role</Btn> : null}
                  {job && job.status !== "CLOSED" ? (
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
                </>
              }
            />

            {!loading && !error ? <WorkspaceSummary label="Current applications" items={[
              { label: "To review", value: rows.filter(({ application }) => application.status === "APPLIED" || application.status === "VIEWED").length },
              { label: "Shortlisted", value: rows.filter(({ application }) => application.status === "SHORTLISTED").length },
              { label: "Hired", value: rows.filter(({ application }) => application.status === "HIRED").length },
            ]} /> : null}
            <div className="workspace-toolbar card card-pad mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-title mb-1">Applications</div>
                <p className="text-sm leading-6 text-muted">Open an application to review the teacher, score, job fit, and hiring progress.</p>
              </div>
              <Tag tone="ghost">{rows.length} total</Tag>
            </div>

            {loading ? <SectionLoader rows={4} /> : null}
            {error && !loading ? <EmptyState title="Applications unavailable" message={error.message || "You may not have permission to view applications for this job."} /> : null}
            {!loading && !error ? (
              <div className="card overflow-hidden">
                {rows.length ? (
                  <div className="divide-y divide-border">
                    {rows.map((row) => (
                      <ApplicationListRow
                        key={row.application.id}
                        row={row}
                        onOpen={() => openApplication(row.application)}
                        onOpenTeacher={(teacherId) => go("teacher-profile", { teacherId })}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No applications yet" message="Applications will appear here when teachers apply." />
                )}
              </div>
            ) : null}

            {ctx.applicationId && !loading && !selectedRow ? (
              <div className="mt-5">
                <EmptyState title="Application not found" message="This application is no longer available for the selected job." />
              </div>
            ) : null}
          </>
        )}
      </div>

      <Modal open={Boolean(hireTarget)} onClose={() => {
        if (!updateStatus.isPending) setHireTarget(null);
      }}>
        <div className="p-6 sm:p-7">
          <Tag tone="amber">Hire creates booking</Tag>
          <h2 className="mt-4 font-heading text-2xl">Hire {hireTarget?.instructor?.fullName || "this teacher"}?</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Hiring locks the earlier application stages and creates the booking contract from this job.
          </p>
          <p className="mt-3 rounded-lg bg-warning-tint px-4 py-3 text-sm leading-6 text-ink">
            All other active applications for this job will be rejected automatically. Each affected teacher will see the updated outcome in My applications.
          </p>
          <AgreedTerms terms={currentHireTarget?.agreedTerms} /><BookingPaymentNotice job={currentHireTarget?.agreedTerms} />
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn variant="ghost" disabled={updateStatus.isPending} onClick={() => setHireTarget(null)}>Cancel</Btn>
            <Btn disabled={!canConfirmHire} loading={updateStatus.isPending} onClick={confirmHire}>Hire & create booking</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ApplicationListRow({
  onOpen,
  onOpenTeacher,
  row,
}: {
  onOpen: () => void;
  onOpenTeacher: (teacherId: string) => void;
  row: ApplicationRow;
}) {
  const { application, instructor, match } = row;

  return (
    <article className="application-list-row grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_120px_170px] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={instructor?.fullName ?? "Teacher"} src={instructor?.imageUrl ?? undefined} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="text-left font-semibold hover:text-brand"
              onClick={() => instructor?.id ? onOpenTeacher(instructor.id) : undefined}
              type="button"
            >
              {instructor?.fullName ?? "Teacher"}
            </button>
            <ApplicationStatusTag status={application.status} />
          </div>
          <div className="mt-1 text-xs text-muted">
            {[instructor?.city, instructor?.county].filter(Boolean).join(", ") || "Location not shared"} - {instructor?.experience != null ? `${instructor.experience} years experience` : "Experience not shared"}
          </div>
          {application.coverLetter ? (
            <ProposalContent
              className="mt-3 line-clamp-2 border-l-2 border-brand-tint-2 pl-3"
              preview
              value={application.coverLetter}
            />
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {instructor?.subjects.slice(0, 3).map((subject) => <span className="pill" key={subject}>{subject}</span>)}
            {instructor?.keyStages.slice(0, 2).map((stage) => <span className="pill" key={stage}>{stage}</span>)}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-chalk px-3 py-2 text-center md:justify-self-center">
        <div className="font-heading text-xl text-brand">{match ? `${match.score}%` : "-"}</div>
        <div className="text-xs text-muted">Match score</div>
      </div>
      <Btn className="w-full" iconRight="arrow" onClick={onOpen}>
        Open application
      </Btn>
    </article>
  );
}

function ApplicationDetail({
  applicationRow,
  job,
  loadingScore,
  onBack,
  onHire,
  onMessage,
  onOpenTeacher,
  onStatusChange,
  pending,
}: {
  applicationRow: ApplicationRow;
  job: Job | null;
  loadingScore: boolean;
  onBack: () => void;
  onHire: (application: JobApplication) => void;
  onMessage: (applicationId: string) => void;
  onOpenTeacher: (teacherId: string) => void;
  onStatusChange: (application: JobApplication, status: JobApplicationStatus) => void;
  pending: boolean;
}) {
  const { application, instructor, match } = applicationRow;
  const hiringAllowed = useSchoolHiringAllowed();
  const canHire = hiringAllowed && hasRecordedApplicationTerms(application) && job?.status === "ACTIVE" && canTransitionApplication(application.status, "HIRED");
  const reviewsQuery = useInstructorReviews(instructor?.id);
  const historyQuery = useApplicationHistory(application.id);

  return (
    <>
      <PageHead
        title={instructor?.fullName ?? "Application"}
        subtitle={application.agreedTerms?.title ?? application.jobName ?? "Application detail"}
        actions={<Btn icon="arrowLeft" variant="secondary" onClick={onBack}>Back to applications</Btn>}
      />

      <div className="application-detail-grid grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="border-b border-border bg-brand-tint px-5 py-5 sm:px-7">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={instructor?.fullName ?? "Teacher"} size="lg" src={instructor?.imageUrl ?? undefined} />
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <ApplicationStatusTag status={application.status} />
                    {instructor?.dbsVerified ? <Tag tone="green">DBS verified</Tag> : null}
                  </div>
                  <button
                    className="max-w-full break-words text-left font-heading text-3xl leading-tight hover:text-brand"
                    onClick={() => instructor?.id ? onOpenTeacher(instructor.id) : undefined}
                    type="button"
                  >
                    {instructor?.fullName ?? "Teacher"}
                  </button>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {[instructor?.city, instructor?.county].filter(Boolean).join(", ") || "Location not shared"} - {instructor?.experience != null ? `${instructor.experience} years experience` : "Experience not shared"}
                  </p>
                </div>
              </div>
            </div>

            <div className="card-pad-lg">
              <div className="grid gap-4 md:grid-cols-3">
                <InfoTile label="Applied" value={formatDate(application.createdAt)} />
                <InfoTile label="Updated" value={formatDate(application.updatedAt)} />
                <InfoTile label="Rating" value={formatRating(instructor)} />
              </div>

              {application.coverLetter ? (
                <ProposalPreview
                  key={application.id}
                  applicantImage={instructor?.imageUrl}
                  applicantName={instructor?.fullName ?? "Teacher"}
                  jobTitle={application.agreedTerms?.title ?? application.jobName ?? undefined}
                  schoolName={job?.school}
                  submittedAt={application.createdAt}
                  value={application.coverLetter}
                />
              ) : null}

              <div className="mt-5">
                {match ? <MatchScorePanel match={match} initiallyExpanded /> : (
                  <div className="rounded-xl border border-border bg-chalk p-5 text-sm text-muted">
                    {loadingScore ? "Loading score details..." : "Score details are not available for this application yet."}
                  </div>
                )}
              </div>
            </div>
          </section>

          <StatusWorkflow application={application} onHire={onHire} onStatusChange={onStatusChange} pending={pending} />
          <section className="card card-pad-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><div className="section-title mb-1">Status history</div><p className="text-sm text-muted">Recorded decisions for this application, oldest first.</p></div>
              {historyQuery.isFetching ? <span className="text-xs text-muted">Refreshing...</span> : null}
            </div>
            {historyQuery.isLoading ? <SectionLoader rows={3} /> : historyQuery.error ? <div className="rounded-xl border border-danger/30 bg-danger-tint p-4 text-sm" role="alert"><p>We could not load the application history.</p><Btn className="mt-3" size="sm" variant="secondary" onClick={() => void historyQuery.refetch()}>Try again</Btn></div> : historyQuery.data?.history.length ? <ol className="space-y-3">{historyQuery.data.history.map((entry) => <li className="flex gap-3 rounded-xl border border-border bg-chalk p-4" key={entry.id}><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-tint text-brand"><Icon name="checkCircle" size={15} /></span><div className="min-w-0"><p className="text-sm font-semibold text-ink">{entry.fromStatus === null ? `Application ${formatStatus(entry.toStatus)}` : entry.fromStatus === entry.toStatus ? `${formatStatus(entry.toStatus)} retained during status migration` : `${formatStatus(entry.fromStatus)} to ${formatStatus(entry.toStatus)}`}</p><p className="mt-1 text-xs text-muted">{formatDate(entry.createdAt)}</p></div></li>)}</ol> : <p className="text-sm text-muted">No status history is available yet.</p>}
          </section>
          <AgreedTerms terms={application.agreedTerms} />
        </div>

        <aside aria-label="Application actions and supporting details" className="min-w-0 space-y-5">
          <section className="sidebar-panel card-pad-lg">
            <div className="section-title mb-4">Main actions</div>
            <div className="grid gap-3">
              {instructor?.id ? (
                <Btn className="h-12 w-full" size="lg" variant="secondary" onClick={() => onOpenTeacher(instructor.id)}>
                  View teacher profile
                </Btn>
              ) : null}
              <Btn className="h-12 w-full" icon="message" size="lg" onClick={() => onMessage(application.id)}>
                Message teacher
              </Btn>
              {!hasRecordedApplicationTerms(application) ? <Btn variant="secondary" onClick={() => onOpenTeacher(application.instructorId)}>Send invitation from teacher profile</Btn> : <Btn
                className="h-12 w-full"
                disabled={!canHire || pending}
                icon="check"
                loading={pending && canHire}
                loadingLabel="Hiring"
                size="lg"
                onClick={() => onHire(application)}
              >
                {application.status === "HIRED" ? "Hired" : "Hire teacher"}
              </Btn>}
            </div>
          </section>

          <TeacherReviewsPanel
            averageRating={reviewsQuery.data?.averageRating ?? null}
            error={reviewsQuery.error}
            isLoading={reviewsQuery.isLoading}
            reviews={reviewsQuery.data?.reviews ?? []}
            total={reviewsQuery.data?.total ?? 0}
          />

          <section className="card card-pad-lg">
            <div className="section-title mb-4">Teacher profile</div>
            <div className="grid gap-3">
              <InfoLine label="Subjects" value={instructor?.subjects.join(", ") || "Not shared"} />
              <InfoLine label="Key stages" value={instructor?.keyStages.join(", ") || "Not shared"} />
              <InfoLine label="Skills" value={instructor?.skills.join(", ") || "Not shared"} />
              <InfoLine label="DBS" value={instructor?.dbsVerified ? "Verified" : "Not verified"} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function TeacherReviewsPanel({
  averageRating,
  error,
  isLoading,
  reviews,
  total,
}: {
  averageRating: number | null;
  error: Error | null;
  isLoading: boolean;
  reviews: ProfileReview[];
  total: number;
}) {
  return (
    <section className="card card-pad-lg">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-title mb-1">School reviews</div>
          <p className="text-sm leading-6 text-muted">Feedback given by other schools for this teacher.</p>
        </div>
        <Tag tone={total > 0 ? "green" : "ghost"}>{total} reviews</Tag>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-chalk" />)}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-xl border border-border bg-chalk p-4 text-sm leading-6 text-muted">
          Reviews could not be loaded right now.
        </div>
      ) : null}

      {!isLoading && !error && reviews.length === 0 ? (
        <div className="rounded-xl border border-border bg-chalk p-4 text-sm leading-6 text-muted">
          No school reviews have been shared for this teacher yet.
        </div>
      ) : null}

      {!isLoading && !error && reviews.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-chalk px-4 py-3">
            <div className="text-sm font-semibold">Average rating</div>
            <div className="flex items-center gap-2">
              <RatingStars rating={averageRating ?? 0} />
              <span className="text-sm font-semibold">{averageRating?.toFixed(1) ?? "0.0"}</span>
            </div>
          </div>
          {reviews.slice(0, 4).map((review, index) => (
            <article key={`${review.id}-${index}`} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{review.reviewerName || "School review"}</div>
                  <div className="text-xs text-muted">{review.jobTitle || formatDate(review.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-brand">
                  <Icon className="fill-current" name="star" size={14} />
                  {review.rating}/5
                </div>
              </div>
              {review.comment ? <p className="break-words text-sm leading-6 text-muted">{review.comment}</p> : <p className="text-sm text-muted">No written comment.</p>}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StatusWorkflow({
  application,
  onHire,
  onStatusChange,
  pending,
}: {
  application: JobApplication;
  onHire: (application: JobApplication) => void;
  onStatusChange: (application: JobApplication, status: JobApplicationStatus) => void;
  pending: boolean;
}) {
  const hiringAllowed = useSchoolHiringAllowed();
  const choices = useDropdown("applicationStatus");
  const formatStatus = (value: JobApplicationStatus) => choices.data?.options.find(option => option.value === value)?.label ?? value.toLowerCase();
  const enabled = (value: JobApplicationStatus) => (value !== "HIRED" || (hiringAllowed && hasRecordedApplicationTerms(application))) && !choices.isError && Boolean(choices.data?.options.some(option => option.value === value));
  const [draggingStatus, setDraggingStatus] = useState<JobApplicationStatus | null>(null);
  const currentIndex = workflowIndex(application.status);
  const rejected = application.status === "REJECTED";

  function moveTo(status: JobApplicationStatus) {
    if (!enabled(status) || !canTransitionApplication(application.status, status) || pending) return;
    if (status === "HIRED") onHire(application);
    else onStatusChange(application, status);
  }

  return (
    <section aria-busy={pending} className="card card-pad-lg"><DropdownStatus name="applicationStatus" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="section-title mb-1">Application progress</div>
          <p className="text-sm leading-6 text-muted">{rejected ? "This application was rejected. Its stages are locked." : application.status === "HIRED" ? "This teacher has been hired. Earlier stages are locked." : "Choose any later stage, or drag the current stage forward. You can skip stages; earlier stages stay locked."}</p>
        </div>
        <Btn disabled={!enabled("REJECTED") || !canTransitionApplication(application.status, "REJECTED") || pending} size="sm" variant="danger" onClick={() => moveTo("REJECTED")}>
          Reject application
        </Btn>
      </div>

      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        {applicationPipeline.map((status, index) => {
          const active = application.status === status;
          const complete = currentIndex > index || application.status === "HIRED";
          const available = enabled(status) && canTransitionApplication(application.status, status) && !pending;
          const dropActive = draggingStatus === application.status && available;

          return (
            <div
              key={status}
              className={`flex min-h-[132px] min-w-0 flex-col overflow-hidden rounded-xl border transition ${
                active
                  ? "border-brand bg-brand-tint"
                  : dropActive
                    ? "border-brand bg-surface shadow-(--shadow-xs)"
                    : complete
                      ? "border-border bg-chalk text-muted"
                      : "border-border bg-surface"
              }`}
              onDragOver={(event) => {
                if (dropActive) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const validDrop = draggingStatus === application.status && available;
                setDraggingStatus(null);
                if (validDrop) moveTo(status);
              }}
            >
              <button
                aria-current={active ? "step" : undefined}
                aria-label={active ? `${formatStatus(status)}, current stage` : available ? `Move application to ${formatStatus(status)}` : `${formatStatus(status)}, locked`}
                className="flex w-full flex-1 flex-col p-4 text-left transition hover:enabled:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:cursor-default"
                disabled={!available}
                onClick={() => moveTo(status)}
                type="button"
              >
                <span className="mb-3 flex w-full flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-[1px]">{formatStatus(status)}</span>
                  {(complete && !active) || rejected ? <Icon name="lock" size={14} /> : null}
                  {active ? <Icon name="checkCircle" size={15} /> : null}
                  {available ? <Icon name="arrow" size={14} className="text-brand" /> : null}
                </span>
                {!active ? <span className="text-sm leading-6 text-muted">{statusHelp(status)}</span> : null}
              </button>
              {active ? (
                <div
                  className="mx-4 mb-4 rounded-lg border border-brand bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-(--shadow-xs)"
                  draggable={!pending && application.status !== "HIRED"}
                  onDragEnd={() => setDraggingStatus(null)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", application.id);
                    setDraggingStatus(application.status);
                  }}
                >
                  Current stage
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function toApplicationRows(
  applications: JobApplication[],
  rankedApplications: Array<{ application: JobApplication; instructor: MatchedInstructor; match: MatchResult }>,
): ApplicationRow[] {
  return applications.map((application) => {
    const ranked = rankedApplications.find((item) => item.application.id === application.id);
    return {
      application,
      instructor: ranked?.instructor ?? application.instructor,
      match: ranked?.match,
    };
  });
}

function workflowIndex(status: JobApplicationStatus) {
  if (status === "REJECTED") return -1;
  return applicationPipeline.indexOf(status);
}

function statusHelp(status: JobApplicationStatus) {
  if (status === "APPLIED") return "Application received.";
  if (status === "VIEWED") return "Reviewed by your team.";
  if (status === "SHORTLISTED") return "Selected for final review.";
  if (status === "HIRED") return "Booking ready.";
  return "";
}

function ApplicationStatusTag({ status }: { status: JobApplicationStatus }) {
  const tone = status === "HIRED" ? "green" : status === "SHORTLISTED" ? "purple" : status === "REJECTED" ? "red" : "ghost";
  return <Tag tone={tone}>{formatStatus(status)}</Tag>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="application-info-tile rounded-xl border border-border bg-chalk p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <WorkspaceEmptyState icon="users" message={message} title={title} />;
}

function formatPay(job: Job) {
  if (!job.rate) return "Rate TBC";
  if (job.payType === "hourly") return `GBP ${job.rate}/hr`;
  if (job.payType === "fixed") return `GBP ${job.rate} fixed`;
  return `GBP ${job.rate}/day`;
}

function formatLocation(job: Job) {
  return [job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC";
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp));
}

function formatRating(instructor?: ApplicantSummary | MatchedInstructor) {
  if (!instructor) return "Not shared";
  if (!instructor.ratingCount) return "No ratings yet";
  return `${instructor.ratingAverage} from ${instructor.ratingCount} reviews`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
