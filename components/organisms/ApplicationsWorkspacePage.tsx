import { useEffect, useRef, useState } from "react";

import type { ApplicantSummary, JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useJobApplications, useUpdateApplicationStatus } from "@/features/applications/use-applications";
import type { Job } from "@/features/jobs/types";
import { useJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { MatchedInstructor, MatchResult } from "@/features/matching/types";
import { useRankedApplications } from "@/features/matching/use-matching";
import type { ProfileReview } from "@/features/reviews/types";
import { useInstructorReviews } from "@/features/reviews/use-reviews";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { MatchScorePanel, Modal, PageHead, ProposalContent, SectionLoader } from "../molecules";
import { BookingPaymentNotice } from "../molecules/BookingPaymentNotice";

type ApplicationRow = {
  application: JobApplication;
  instructor?: ApplicantSummary | MatchedInstructor;
  match?: MatchResult;
};

const pipelineStatuses: Exclude<JobApplicationStatus, "REJECTED">[] = ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEW", "HIRED"];

export function ApplicationsPage({ go, ctx, toast }: Pick<RouteProps, "go" | "ctx" | "toast">) {
  const [hireTarget, setHireTarget] = useState<JobApplication | null>(null);
  const autoViewedApplicationIds = useRef<Set<string>>(new Set());
  // Only the newest job is needed, as the default when no job was chosen.
  const myJobsQuery = useMyJobs({ limit: 1 });
  const selectedJobId = ctx.jobId ?? myJobsQuery.data?.jobs[0]?.id;
  const jobQuery = useJob(selectedJobId ?? "", true);
  const job = jobQuery.data ?? null;
  const applicationsQuery = useJobApplications(selectedJobId, { limit: 100 });
  const rankedQuery = useRankedApplications(selectedJobId, { limit: 100, minScore: 0, page: 1 });
  const applications = applicationsQuery.data?.applications ?? [];
  const rows = toApplicationRows(applications, rankedQuery.data?.applications ?? []);
  const selectedRow = ctx.applicationId ? rows.find((row) => row.application.id === ctx.applicationId) : undefined;

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
      const autoViewed = result.ok && result.data.status === "VIEWED" && autoViewedApplicationIds.current.has(result.data.id);
      if (autoViewed && result.ok) autoViewedApplicationIds.current.delete(result.data.id);
      if (!autoViewed) {
        toast({
          title: hired ? "Teacher hired" : result.ok ? "Application updated" : "Could not update application",
          msg: hired
            ? "Your booking is ready. Once completed, create its Stripe invoice from Bookings."
            : result.message ?? "The application status was updated.",
          tone: result.ok ? "success" : "danger",
        });
      }
      if (result.ok) setHireTarget(null);
    },
  });

  useEffect(() => {
    const applicationId = selectedRow?.application.id;
    if (!applicationId || selectedRow.application.status !== "APPLIED") return;
    if (autoViewedApplicationIds.current.has(applicationId)) return;
    autoViewedApplicationIds.current.add(applicationId);
    updateStatus.mutate({ id: applicationId, status: "VIEWED" });
  }, [selectedRow?.application.id, selectedRow?.application.status, updateStatus]);

  function openApplication(application: JobApplication) {
    if (!selectedJobId) return;
    go("applications", { applicationId: application.id, jobId: selectedJobId });
  }

  function closeApplication() {
    if (!selectedJobId) return;
    go("applications", { jobId: selectedJobId });
  }

  function changeStatus(application: JobApplication, status: JobApplicationStatus) {
    if (status === "HIRED") {
      setHireTarget(application);
      return;
    }
    updateStatus.mutate({ id: application.id, status });
  }

  if (!selectedJobId && !myJobsQuery.isLoading) {
    return (
      <div className="app-page">
        <PageHead
          title="Applications"
          subtitle="Post a role first, then applicants will appear here."
          actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>}
        />
        <EmptyState title="No posted roles yet" message="Create an active role to start receiving teacher applications." />
      </div>
    );
  }

  const loading = myJobsQuery.isLoading || applicationsQuery.isLoading;
  const error = applicationsQuery.error;

  return (
    <>
      <div className="app-page">
        {selectedRow ? (
          <ApplicationDetail
            applicationRow={selectedRow}
            job={job}
            loadingScore={rankedQuery.isLoading}
            onBack={closeApplication}
            onBookInterview={(application) => changeStatus(application, "INTERVIEW")}
            onHire={setHireTarget}
            onMessage={(applicationId) => go("messaging", { applicationId })}
            onOpenTeacher={(teacherId) => go("teacher-profile", { teacherId })}
            onStatusChange={changeStatus}
            pending={updateStatus.isPending}
          />
        ) : (
          <>
            <PageHead
              title={job?.title ?? "Applications"}
              subtitle={`${job ? `${formatLocation(job)} - ${job.date} - ${formatPay(job)} - ` : ""}${applicationsQuery.data?.pagination.total ?? applications.length} applications`}
              actions={
                <>
                  <Btn variant="secondary" size="sm" onClick={() => go("post-job")}>Post another role</Btn>
                  {selectedJobId ? <Btn variant="secondary" size="sm" icon="edit" onClick={() => go("post-job", { jobId: selectedJobId })}>Edit role</Btn> : null}
                  {job?.status === "ACTIVE" || job?.status === "DRAFT" ? (
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

            <div className="card card-pad mb-6 flex flex-wrap items-center justify-between gap-3">
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
          <BookingPaymentNotice job={job} />
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn variant="ghost" disabled={updateStatus.isPending} onClick={() => setHireTarget(null)}>Cancel</Btn>
            <Btn loading={updateStatus.isPending} onClick={() => {
              if (hireTarget) updateStatus.mutate({ id: hireTarget.id, status: "HIRED" });
            }}>Hire & create booking</Btn>
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
    <article className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_120px_170px] md:items-center">
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
  onBookInterview,
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
  onBookInterview: (application: JobApplication) => void;
  onHire: (application: JobApplication) => void;
  onMessage: (applicationId: string) => void;
  onOpenTeacher: (teacherId: string) => void;
  onStatusChange: (application: JobApplication, status: JobApplicationStatus) => void;
  pending: boolean;
}) {
  const { application, instructor, match } = applicationRow;
  const canBookInterview = application.status === "SHORTLISTED";
  const interviewLocked = application.status === "HIRED" || application.status === "REJECTED" || application.status === "INTERVIEW";
  const canHire = application.status !== "HIRED" && application.status !== "REJECTED";
  const reviewsQuery = useInstructorReviews(instructor?.id);

  return (
    <>
      <PageHead
        title={instructor?.fullName ?? "Application"}
        subtitle={job ? `${job.title} - ${formatLocation(job)} - ${formatPay(job)}` : "Application detail"}
        actions={<Btn icon="arrowLeft" variant="secondary" onClick={onBack}>Back to applications</Btn>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="border-b border-border bg-[linear-gradient(135deg,#fff_0%,#f6fbf8_55%,rgb(var(--se-rgb)/0.10)_100%)] px-5 py-5 sm:px-7">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={instructor?.fullName ?? "Teacher"} size="lg" src={instructor?.imageUrl ?? undefined} />
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <ApplicationStatusTag status={application.status} />
                    {instructor?.dbsVerified ? <Tag tone="green">DBS verified</Tag> : null}
                  </div>
                  <button
                    className="truncate text-left font-heading text-3xl leading-tight hover:text-brand"
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
                <div className="mt-5 rounded-xl border border-border bg-white p-5">
                  <div className="section-title mb-2">Proposal</div>
                  <ProposalContent value={application.coverLetter} />
                </div>
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
          <JobDetailPanel job={job} />
        </div>

        <aside aria-label="Application actions and supporting details" className="min-w-0 space-y-5">
          <section className="sidebar-panel card-pad-lg">
            <div className="section-title mb-4">Main actions</div>
            <div className="grid gap-3">
              <Btn className="h-12 w-full" icon="message" size="lg" onClick={() => onMessage(application.id)}>
                Message teacher
              </Btn>
              <InterviewButton
                application={application}
                canBookInterview={canBookInterview}
                interviewLocked={interviewLocked}
                onBookInterview={onBookInterview}
                pending={pending}
              />
              <Btn
                className="h-12 w-full"
                disabled={!canHire || pending}
                icon="check"
                loading={pending && canHire}
                loadingLabel="Hiring"
                size="lg"
                onClick={() => onHire(application)}
              >
                {application.status === "HIRED" ? "Hired" : "Hire teacher"}
              </Btn>
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
            <article key={`${review.id}-${index}`} className="rounded-xl border border-border bg-white p-4">
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

function RatingStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);

  return (
    <div className="flex items-center gap-0.5 text-brand">
      {[1, 2, 3, 4, 5].map((value) => (
        <Icon key={value} className={value <= rounded ? "fill-current" : "text-muted"} name="star" size={13} />
      ))}
    </div>
  );
}

function InterviewButton({
  application,
  canBookInterview,
  interviewLocked,
  onBookInterview,
  pending,
}: {
  application: JobApplication;
  canBookInterview: boolean;
  interviewLocked: boolean;
  onBookInterview: (application: JobApplication) => void;
  pending: boolean;
}) {
  return (
    <Btn
      className="h-12 w-full"
      disabled={!canBookInterview || pending}
      icon="calendar"
      loading={pending && canBookInterview}
      loadingLabel="Booking"
      size="lg"
      variant="secondary"
      onClick={() => onBookInterview(application)}
    >
      {application.status === "INTERVIEW" ? "Interview selected" : interviewLocked ? "Interview locked" : "Book interview"}
    </Btn>
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
  const [draggingStatus, setDraggingStatus] = useState<JobApplicationStatus | null>(null);
  const currentIndex = workflowIndex(application.status);
  const nextStatus = nextWorkflowStatus(application.status);
  const rejected = application.status === "REJECTED";

  function moveTo(status: JobApplicationStatus) {
    if (!canMoveTo(application.status, status) || pending) return;
    if (status === "HIRED") onHire(application);
    else onStatusChange(application, status);
  }

  return (
    <section className="card card-pad-lg">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="section-title mb-1">Application progress</div>
          <p className="text-sm leading-6 text-muted">Previous stages stay locked once the application moves forward.</p>
        </div>
        <Btn disabled={application.status === "HIRED" || rejected || pending} size="sm" variant="danger" onClick={() => onStatusChange(application, "REJECTED")}>
          Reject application
        </Btn>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {pipelineStatuses.map((status, index) => {
          const active = application.status === status;
          const complete = currentIndex > index || application.status === "HIRED";
          const available = canMoveTo(application.status, status);
          const dropActive = draggingStatus !== null && available;

          return (
            <div
              key={status}
              className={`min-h-[132px] rounded-xl border p-4 transition ${
                active
                  ? "border-brand bg-brand-tint"
                  : dropActive
                    ? "border-brand bg-white shadow-(--shadow-xs)"
                    : complete
                      ? "border-border bg-chalk text-muted"
                      : "border-border bg-white"
              }`}
              onDragOver={(event) => {
                if (available) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDraggingStatus(null);
                moveTo(status);
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-[1px]">{formatStatus(status)}</div>
                {complete && !active ? <Icon name="lock" size={14} /> : null}
                {active ? <Icon name="checkCircle" size={15} /> : null}
              </div>
              {active ? (
                <div
                  className="rounded-lg border border-brand bg-white px-3 py-2 text-sm font-semibold text-ink shadow-(--shadow-xs)"
                  draggable={!pending && application.status !== "HIRED"}
                  onDragEnd={() => setDraggingStatus(null)}
                  onDragStart={() => setDraggingStatus(application.status)}
                >
                  Current stage
                </div>
              ) : (
                <div className="text-sm leading-6 text-muted">{statusHelp(status)}</div>
              )}
              {available && status === nextStatus ? (
                <Btn className="mt-3 w-full" disabled={pending} loading={pending} loadingLabel="Moving" size="sm" variant="secondary" onClick={() => moveTo(status)}>
                  Move here
                </Btn>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function JobDetailPanel({ job }: { job: Job | null }) {
  if (!job) {
    return <EmptyState title="Job details unavailable" message="The selected job could not be loaded." />;
  }

  return (
    <section className="card card-pad-lg">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-title mb-1">Posted job details</div>
          <h2 className="font-heading text-2xl leading-tight">{job.title}</h2>
          <p className="mt-1 text-sm text-muted">{formatLocation(job)} - {job.date} - {formatPay(job)}</p>
        </div>
        <Tag tone={job.status === "ACTIVE" ? "green" : "ghost"}>{job.status ?? "Role"}</Tag>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoTile label="Subject" value={job.subject || "Not specified"} />
        <InfoTile label="Key stage" value={job.keyStages?.join(", ") || job.keyStage || "Not specified"} />
        <InfoTile label="Mode" value={job.mode === "instant" ? "Instant" : "Brief"} />
        <InfoTile label="Pay" value={formatPay(job)} />
        <InfoTile label="Minimum experience" value={job.minExperienceYears != null ? `${job.minExperienceYears}+ years` : "Not specified"} />
        <InfoTile label="Expires" value={formatDate(job.expiresAt)} />
      </div>

      {job.description ? (
        <div className="mt-5 rounded-xl border border-border bg-chalk p-5">
          <div className="section-title mb-2">Description</div>
          <p className="text-sm leading-7 text-muted">{stripHtml(job.description)}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoLine label="Required skills" value={job.requiredSkills?.join(", ") || "Not specified"} />
        <InfoLine label="Parking" value={job.parkingInfo || "Not shared"} />
        <InfoLine label="Created" value={formatDate(job.createdAt)} />
        <InfoLine label="Updated" value={formatDate(job.updatedAt)} />
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

function canMoveTo(current: JobApplicationStatus, target: JobApplicationStatus) {
  if (current === "HIRED" || current === "REJECTED") return false;
  if (target === "REJECTED") return true;
  if (target === "HIRED") return true;
  return nextWorkflowStatus(current) === target;
}

function nextWorkflowStatus(status: JobApplicationStatus): JobApplicationStatus | undefined {
  if (status === "APPLIED") return "VIEWED";
  if (status === "VIEWED") return "SHORTLISTED";
  if (status === "SHORTLISTED") return "INTERVIEW";
  if (status === "INTERVIEW") return "HIRED";
  return undefined;
}

function workflowIndex(status: JobApplicationStatus) {
  if (status === "REJECTED") return -1;
  return pipelineStatuses.indexOf(status);
}

function statusHelp(status: JobApplicationStatus) {
  if (status === "APPLIED") return "Application received.";
  if (status === "VIEWED") return "Reviewed by your team.";
  if (status === "SHORTLISTED") return "Ready for interview.";
  if (status === "INTERVIEW") return "Interview selected.";
  if (status === "HIRED") return "Booking ready.";
  return "";
}

function ApplicationStatusTag({ status }: { status: JobApplicationStatus }) {
  const tone = status === "HIRED" ? "green" : status === "INTERVIEW" || status === "SHORTLISTED" ? "purple" : status === "REJECTED" ? "red" : "ghost";
  return <Tag tone={tone}>{formatStatus(status)}</Tag>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-chalk p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="card card-pad-lg text-center"><div className="font-heading text-[24px]">{title}</div><p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">{message}</p></div>;
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
