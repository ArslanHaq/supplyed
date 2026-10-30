import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { createInvitationAction } from "@/features/invitations/actions";
import type { InvitationInput } from "@/features/invitations/types";
import { useSchoolHiringAllowed } from "@/features/auth/use-school-hiring";
import type { Job } from "@/features/jobs/types";
import { useJob } from "@/features/jobs/use-jobs";
import type { RecommendedInstructor } from "@/features/matching/types";
import { useRecommendedInstructors } from "@/features/matching/use-matching";
import { queryKeys } from "@/lib/query/keys";
import { useRateLimit } from "@/lib/rate-limit";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Field, Tag } from "../atoms";
import { Modal, PageHead, SectionLoader } from "../molecules";
import { WorkspaceEmptyState } from "./WorkspacePanels";

const PAGE_SIZE = 20;
const POST_PUBLISH_PAGE_SIZE = 5;

const disabledMessages: Record<string, string> = {
  JOB_UNAVAILABLE: "This job is not open for invitations.",
  ALREADY_BOOKED: "This teacher already has booking history for this job.",
  APPLICATION_REJECTED: "This application was rejected.",
  INVITATION_DECLINED: "This teacher declined an invitation for this job.",
  INVITATION_PENDING: "An invitation is already pending.",
  SCHOOL_ONLY: "Only the owning school can send invitations.",
};

export function InstantJobTeachersSection({ job, go, toast }: { job: Job; go: RouteProps["go"]; toast: RouteProps["toast"] }) {
  const [page, setPage] = useState(1);
  const [inviteTarget, setInviteTarget] = useState<RecommendedInstructor | null>(null);
  const hiringAllowed = useSchoolHiringAllowed();
  const teachersQuery = useRecommendedInstructors(job.id, { limit: PAGE_SIZE, minScore: 0, page }, job.jobType === "INSTANT");
  const teachers = [...(teachersQuery.data?.instructors ?? [])].sort((left, right) => right.match.score - left.match.score);
  const pagination = teachersQuery.data?.pagination;

  if (job.jobType !== "INSTANT") return null;

  return (
    <section aria-labelledby="related-teachers-heading" className="mt-6">
      <div className="workspace-toolbar card card-pad mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="section-title mb-1" id="related-teachers-heading">Related teachers</div>
          <p className="text-sm leading-6 text-muted">All eligible teachers for this instant job, with the highest match scores first.</p>
        </div>
        <Tag tone="ghost">{pagination?.total ?? teachers.length} total</Tag>
      </div>

      {teachersQuery.isLoading ? <SectionLoader rows={4} /> : null}
      {teachersQuery.isError ? (
        <div className="card card-pad text-center" role="alert">
          <h3 className="font-heading text-xl">Related teachers could not be loaded</h3>
          <p className="mt-2 text-sm text-muted">{teachersQuery.error.message}</p>
          <Btn className="mt-4" variant="secondary" onClick={() => void teachersQuery.refetch()}>Try again</Btn>
        </div>
      ) : null}

      {!teachersQuery.isLoading && !teachersQuery.isError ? (
        teachers.length ? <div className="space-y-3">{teachers.map((teacher) => (
          <RelatedTeacherCard key={teacher.instructor.id} item={teacher} inviteAllowed={Boolean(hiringAllowed)} onInvite={() => setInviteTarget(teacher)} onProfile={() => go("teacher-profile", { jobId: job.id, teacherId: teacher.instructor.id })} />
        ))}</div> : <WorkspaceEmptyState icon="users" title="No eligible teachers right now" message="Matching considers current profile status, approved documents, location, travel range and confirmed booking conflicts." />
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <nav aria-label="Related teacher pages" className="mt-5 flex items-center justify-center gap-3">
          <Btn disabled={page <= 1 || teachersQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage((value) => value - 1)}>Previous</Btn>
          <span className="text-sm text-muted">Page {page} of {pagination.totalPages}</span>
          <Btn disabled={!pagination.hasNextPage || teachersQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage((value) => value + 1)}>Next</Btn>
        </nav>
      ) : null}

      {inviteTarget ? (
        <RelatedTeacherInvitationModal
          item={inviteTarget}
          jobId={job.id}
          jobTitle={job.title}
          onClose={() => setInviteTarget(null)}
          onSent={async () => {
            setInviteTarget(null);
            await teachersQuery.refetch();
            toast({ title: "Invitation sent", msg: "The job remains open until a teacher accepts or an applicant is hired.", tone: "success" });
          }}
        />
      ) : null}
    </section>
  );
}

export function InstantJobMatchesModal({
  go,
  job,
  onContinue,
  toast,
}: {
  go: RouteProps["go"];
  job: Job;
  onContinue: () => void;
  toast: RouteProps["toast"];
}) {
  const [page, setPage] = useState(1);
  const [inviteTarget, setInviteTarget] = useState<RecommendedInstructor | null>(null);
  const hiringAllowed = useSchoolHiringAllowed();
  const teachersQuery = useRecommendedInstructors(job.id, { limit: POST_PUBLISH_PAGE_SIZE, minScore: 0, page }, true);
  const teachers = [...(teachersQuery.data?.instructors ?? [])].sort((left, right) => right.match.score - left.match.score);
  const pagination = teachersQuery.data?.pagination;

  if (inviteTarget) {
    return (
      <RelatedTeacherInvitationModal
        item={inviteTarget}
        jobId={job.id}
        jobTitle={job.title}
        onClose={() => setInviteTarget(null)}
        onSent={async () => {
          setInviteTarget(null);
          await teachersQuery.refetch();
          toast({ title: "Invitation sent", msg: "You can invite another matched teacher or continue to applications.", tone: "success" });
        }}
      />
    );
  }

  return (
    <Modal label={`Matched teachers for ${job.title}`} onClose={onContinue} open size="xl">
      <div className="border-b border-border bg-surface-2 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2"><Tag tone="green">Job published</Tag><Tag tone="amber">Instant job</Tag></div>
            <h2 className="font-heading text-2xl leading-tight">Invite matched teachers</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Review the best-matched eligible teacher profiles for <strong className="text-ink">{job.title}</strong>. You can send multiple invitations before continuing to applications.</p>
          </div>
          <div className="flex items-center gap-2">
            <Tag tone="ghost">{pagination?.total ?? teachers.length} matches</Tag>
            <Btn aria-label="Close matched teachers and continue to applications" icon="x" size="sm" variant="ghost" onClick={onContinue} />
          </div>
        </div>
      </div>

      <div className="min-h-[260px] bg-chalk p-4 sm:p-6">
        {teachersQuery.isLoading ? <SectionLoader rows={3} /> : null}
        {teachersQuery.isError ? (
          <WorkspaceEmptyState
            action={<Btn variant="secondary" onClick={() => void teachersQuery.refetch()}>Try again</Btn>}
            icon="users"
            message={teachersQuery.error.message || "Matched teachers could not be loaded. You can retry or continue to applications."}
            title="Matches unavailable"
          />
        ) : null}
        {!teachersQuery.isLoading && !teachersQuery.isError ? (
          teachers.length ? (
            <div className="space-y-3">
              {teachers.map((teacher) => (
                <RelatedTeacherCard
                  key={teacher.instructor.id}
                  inviteAllowed={Boolean(hiringAllowed)}
                  item={teacher}
                  onInvite={() => setInviteTarget(teacher)}
                  onProfile={() => go("teacher-profile", { jobId: job.id, teacherId: teacher.instructor.id })}
                />
              ))}
            </div>
          ) : (
            <WorkspaceEmptyState icon="users" title="No eligible teachers right now" message="The job is published. New matches can appear as verified teachers update their availability and location." />
          )
        ) : null}

        {pagination && pagination.totalPages > 1 ? (
          <nav aria-label="Matched teacher pages" className="mt-5 flex items-center justify-center gap-3">
            <Btn disabled={page <= 1 || teachersQuery.isFetching} size="sm" variant="secondary" onClick={() => setPage((value) => value - 1)}>Previous</Btn>
            <span className="text-sm text-muted">Page {page} of {pagination.totalPages}</span>
            <Btn disabled={!pagination.hasNextPage || teachersQuery.isFetching} size="sm" variant="secondary" onClick={() => setPage((value) => value + 1)}>Next</Btn>
          </nav>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-4 sm:px-7">
        <p className="text-xs leading-5 text-muted">Inviting a teacher does not reserve the job. It remains open until a teacher accepts or an applicant is hired.</p>
        <Btn iconRight="arrow" onClick={onContinue}>Continue to applications</Btn>
      </div>
    </Modal>
  );
}

export function InstantJobTeachersPage({ ctx, go, toast }: Pick<RouteProps, "ctx" | "go" | "toast">) {
  const jobId = ctx.jobId ?? "";
  const [page, setPage] = useState(1);
  const [inviteTarget, setInviteTarget] = useState<RecommendedInstructor | null>(null);
  const hiringAllowed = useSchoolHiringAllowed();
  const jobQuery = useJob(jobId, Boolean(jobId));
  const instant = jobQuery.data?.jobType === "INSTANT";
  const teachersQuery = useRecommendedInstructors(jobId, { limit: PAGE_SIZE, minScore: 0, page }, instant);
  const teachers = teachersQuery.data?.instructors ?? [];
  const pagination = teachersQuery.data?.pagination;

  if (!jobId) {
    return <div className="app-page"><WorkspaceEmptyState icon="users" title="Choose an instant job" message="Open an instant job from Applications to see its related teachers." action={<Btn onClick={() => go("applications")}>Back to applications</Btn>} /></div>;
  }

  if (jobQuery.isLoading) return <div className="app-page"><SectionLoader rows={5} /></div>;

  if (jobQuery.isError || !jobQuery.data) {
    return <div className="app-page"><WorkspaceEmptyState icon="users" title="Job unavailable" message={jobQuery.error?.message || "This job could not be loaded."} action={<Btn variant="secondary" onClick={() => void jobQuery.refetch()}>Try again</Btn>} /></div>;
  }

  const job = jobQuery.data;
  if (!instant) {
    return (
      <div className="app-page">
        <PageHead title="Related teachers" subtitle={job.title} actions={<Btn icon="arrowLeft" variant="secondary" onClick={() => go("applications", { jobId })}>Back to applications</Btn>} />
        <WorkspaceEmptyState icon="users" title="Related teachers are only available for instant jobs" message="Brief jobs collect normal applications and notify eligible teachers automatically. Individual invitations are disabled." />
      </div>
    );
  }

  return (
    <div className="app-page teacher-discovery">
      <PageHead
        title="Related teachers"
        subtitle={`Eligible teachers matched to ${job.title}. Results update as profiles, documents and bookings change.`}
        actions={<><Btn icon="arrowLeft" variant="secondary" onClick={() => go("applications", { jobId })}>Back to applications</Btn><Btn variant="ghost" onClick={() => go("job-detail", { jobId })}>View job</Btn></>}
      />

      <section className="card card-pad mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Tag tone="amber">Instant job</Tag><Tag tone="ghost">{job.status?.toLowerCase()}</Tag></div>
          <h2 className="mt-2 font-heading text-xl">{job.title}</h2>
          <p className="mt-1 text-sm text-muted">{job.subject} · {job.city} · {job.date}</p>
        </div>
        <div className="text-sm text-muted"><strong className="font-heading text-2xl text-ink">{pagination?.total ?? teachers.length}</strong><span className="ml-2">related teachers</span></div>
      </section>

      {teachersQuery.isLoading ? <SectionLoader rows={5} /> : null}
      {teachersQuery.isError ? (
        <div className="card card-pad text-center" role="alert">
          <h2 className="font-heading text-xl">Related teachers could not be loaded</h2>
          <p className="mt-2 text-sm text-muted">{teachersQuery.error.message}</p>
          <Btn className="mt-4" variant="secondary" onClick={() => void teachersQuery.refetch()}>Try again</Btn>
        </div>
      ) : null}

      {!teachersQuery.isLoading && !teachersQuery.isError ? (
        teachers.length ? <div className="space-y-3">{teachers.map((teacher) => (
          <RelatedTeacherCard key={teacher.instructor.id} item={teacher} inviteAllowed={Boolean(hiringAllowed)} onInvite={() => setInviteTarget(teacher)} onProfile={() => go("teacher-profile", { jobId, teacherId: teacher.instructor.id })} />
        ))}</div> : <WorkspaceEmptyState icon="users" title="No eligible teachers right now" message="Matching considers current profile status, approved documents, location, travel range and confirmed booking conflicts." />
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <nav aria-label="Related teacher pages" className="mt-5 flex items-center justify-center gap-3">
          <Btn disabled={page <= 1 || teachersQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage((value) => value - 1)}>Previous</Btn>
          <span className="text-sm text-muted">Page {page} of {pagination.totalPages}</span>
          <Btn disabled={!pagination.hasNextPage || teachersQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage((value) => value + 1)}>Next</Btn>
        </nav>
      ) : null}

      {inviteTarget ? (
        <RelatedTeacherInvitationModal
          item={inviteTarget}
          jobId={jobId}
          jobTitle={job.title}
          onClose={() => setInviteTarget(null)}
          onSent={async () => {
            setInviteTarget(null);
            await teachersQuery.refetch();
            toast({ title: "Invitation sent", msg: "The job remains open until a teacher accepts or an applicant is hired.", tone: "success" });
          }}
        />
      ) : null}
    </div>
  );
}

function RelatedTeacherCard({ item, inviteAllowed, onInvite, onProfile }: { item: RecommendedInstructor; inviteAllowed: boolean; onInvite: () => void; onProfile: () => void }) {
  const teacher = item.instructor;
  const distance = item.match.flags.distanceKnown && item.match.distanceMiles !== null ? `${item.match.distanceMiles.toFixed(1)} miles away` : "Distance unknown";
  const disabledReason = item.inviteDisabledReason ? disabledMessages[item.inviteDisabledReason] ?? "This teacher cannot be invited right now." : null;
  const tags = [...teacher.subjects, ...teacher.keyStages, ...teacher.skills].slice(0, 6);

  return (
    <article className="teacher-directory-card card card-pad flex flex-wrap items-start gap-4">
      <Avatar name={teacher.fullName} size="lg" src={teacher.imageUrl ?? undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button className="font-heading text-lg hover:text-brand hover:underline" onClick={onProfile} type="button">{teacher.fullName}</button>
          <Tag tone={item.match.score >= 70 ? "green" : "ghost"}>{item.match.score}% match</Tag>
          {item.application ? <Tag tone="purple">{item.application.status === "APPLIED" ? "Applied" : `Applied · ${label(item.application.status)}`}</Tag> : null}
          {item.invitation ? <Tag tone={item.invitation.status === "ACCEPTED" ? "green" : item.invitation.status === "PENDING" ? "amber" : "ghost"}>Invitation · {label(item.invitation.status)}</Tag> : null}
        </div>
        <p className="mt-2 text-sm text-muted">{[teacher.city, teacher.county].filter(Boolean).join(", ") || "Location not provided"} · {distance}</p>
        <p className="mt-1 text-xs text-muted">{teacher.experience == null ? "Experience not shared" : `${teacher.experience} years experience`} · {teacher.ratingCount ? `${teacher.ratingAverage} rating from ${teacher.ratingCount} reviews` : "No ratings yet"}</p>
        {tags.length ? <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((value) => <Tag key={value} tone="ghost">{value}</Tag>)}</div> : null}
        {disabledReason ? <p className="mt-3 text-xs text-muted">{disabledReason}</p> : null}
      </div>
      <div className="flex min-w-[150px] flex-col gap-2">
        <Btn disabled={!item.canInvite || !inviteAllowed} icon="send" size="sm" onClick={onInvite}>Invite to job</Btn>
        <Btn size="sm" variant="secondary" onClick={onProfile}>View profile</Btn>
      </div>
    </article>
  );
}

function RelatedTeacherInvitationModal({ item, jobId, jobTitle, onClose, onSent }: { item: RecommendedInstructor; jobId: string; jobTitle: string; onClose: () => void; onSent: () => void | Promise<void> }) {
  const teacher = item.instructor;
  const client = useQueryClient();
  const hiringAllowed = useSchoolHiringAllowed();
  const retryAfter = useRateLimit();
  const storageKey = `supplyed:instant-invitation:v1:${jobId}:${teacher.id}`;
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState<InvitationInput | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as InvitationInput | null;
      return saved?.jobId === jobId && saved.instructorId === teacher.id ? saved : null;
    } catch { return null; }
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function send() {
    if (submitting.current || retryAfter || !hiringAllowed || !item.canInvite || message.length > 1000) return;
    const input: InvitationInput = attempt ?? { requestId: crypto.randomUUID(), jobId, instructorId: teacher.id, ...(message.trim() ? { message: message.trim() } : {}) };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input));
    } catch {
      setError("Enable browser session storage to safely send and retry this invitation.");
      return;
    }
    setAttempt(input);
    setBusy(true);
    submitting.current = true;
    setError("");
    try {
      const result = await createInvitationAction(input);
      if (!result.ok) {
        setError(result.message);
        if (!result.uncertain) {
          sessionStorage.removeItem(storageKey);
          setAttempt(null);
          for (const key of [queryKeys.matching.all, queryKeys.invitations.all, queryKeys.jobs.all]) void client.invalidateQueries({ queryKey: key });
        }
        return;
      }
      sessionStorage.removeItem(storageKey);
      for (const key of [queryKeys.matching.all, queryKeys.invitations.all, queryKeys.jobs.all, queryKeys.notifications.all]) void client.invalidateQueries({ queryKey: key });
      await onSent();
    } catch {
      setError("The result could not be confirmed. Retry the same invitation request.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal label={`Invite ${teacher.fullName}`} onClose={() => { if (!busy) onClose(); }} open>
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-3"><Avatar name={teacher.fullName} src={teacher.imageUrl ?? undefined} /><div><p className="text-xs text-muted">Invite to {jobTitle}</p><h2 className="font-heading text-xl">{teacher.fullName}</h2></div></div>
        <p className="mt-4 rounded-lg bg-brand-tint p-4 text-sm leading-6">The position remains open. The first valid acceptance or school hire fills it. Sending this invitation does not reserve or fill the job.</p>
        <div className="mt-4"><Field error={message.length > 1000 ? "Use 1,000 characters or fewer." : undefined} label="Message (optional)" htmlFor="instant-invitation-message">
          <textarea className="input min-h-28" disabled={Boolean(attempt)} id="instant-invitation-message" maxLength={1001} onChange={(event) => setMessage(event.target.value)} placeholder="Would you be available for this cover?" value={attempt?.message ?? message} />
        </Field></div>
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
        {attempt ? <p className="mt-3 text-xs text-muted">This request is saved. Retrying uses the same request reference and exact details.</p> : null}
        <div className="mt-6 flex justify-end gap-2"><Btn disabled={busy} variant="secondary" onClick={onClose}>Cancel</Btn><Btn disabled={!hiringAllowed || Boolean(retryAfter) || busy || message.length > 1000} loading={busy} loadingLabel="Sending" icon="send" onClick={() => void send()}>{attempt ? "Retry same invitation" : "Send invitation"}</Btn></div>
      </div>
    </Modal>
  );
}

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}
