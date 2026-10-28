"use client";
import { useRateLimit } from "@/lib/rate-limit";
import { formatPlannedUnits } from "@/features/jobs/work-units";

import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";


import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/use-current-user";
import { decideInvitationAction } from "@/features/invitations/actions";
import { invitationCanAccept } from "@/features/invitations/schemas";
import { invitationStatuses, type Invitation, type InvitationDecision, type InvitationStatus } from "@/features/invitations/types";
import { useInvitation, useInvitationClock, useInvitations } from "@/features/invitations/use-invitations";
import { invitationLoginHref } from "@/lib/invitation-links";
import { queryKeys } from "@/lib/query/keys";
import { useMounted } from "@/lib/use-mounted";
import type { RouteProps } from "@/types/supplyed";
import { Avatar, Btn, Icon, Tag } from "../atoms";
import { FormattedJobDescription, Modal, PageHead, SectionLoader } from "../molecules";
import { ListPagination } from "../molecules/ListPagination";
import { InvitationErrorNotice, useInvitationError } from "./InvitationErrorNotice";

type Props = Pick<RouteProps, "ctx" | "go" | "role" | "toast">;
const labels: Record<InvitationStatus, string> = { PENDING: "Awaiting response", ACCEPTED: "Accepted", DECLINED: "Declined", CANCELLED: "Withdrawn", EXPIRED: "Expired" };

export function JobInvitationsPage(props: Props) {
  if (props.role === "admin") return <div className="app-page"><PageHead title="Job invitations" subtitle="Invitations are available to the inviting school and invited teacher only." /></div>;
  return props.ctx.invitationId ? <InvitationDetail key={props.ctx.invitationId} {...props} id={props.ctx.invitationId} /> : <InvitationList {...props} />;
}

function InvitationList({ role, go }: Props) {
  const choices = useDropdown("jobInvitationStatus");
  const filters = [{ value: "", label: "All invitations" }, ...invitationStatuses.map(value => ({ value, label: choices.data?.options.find(option => option.value === value)?.label ?? value.charAt(0) + value.slice(1).toLowerCase() }))];
  const [status, setStatus] = useState<InvitationStatus | "">("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const query = useInvitations({ page, limit, status: status || undefined });
  return <div className="app-page">
    <PageHead title={role === "institution" ? "Sent invitations" : "Job invitations"} subtitle={role === "institution" ? "Track your offers and teacher responses. Bookings begin after acceptance." : "Review offers from schools and choose the placements that work for you."} actions={<Btn icon="refresh" variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>Refresh</Btn>} />
    <div className="card mb-5 flex flex-wrap items-center gap-2 p-4" aria-label="Invitation status filters">
      <DropdownStatus name="jobInvitationStatus" />{filters.map(({ value, label }) => <Btn key={value} size="sm" variant={status === value ? "secondary" : "ghost"} aria-pressed={status === value} onClick={() => { setStatus(value as InvitationStatus | ""); setPage(1); }}>{label}</Btn>)}
    </div>
    {query.isLoading ? <SectionLoader rows={3} /> : query.error ? <StateMessage title="Invitations unavailable" text={query.error.message} /> : !query.data?.invitations.length ? <StateMessage title="No invitations here yet" text={role === "institution" ? "Choose Invite to job on a teacher card or profile to send an offer." : "When a school invites you to a job, you can review and respond here."} /> : <div className="space-y-4">{query.data.invitations.map(invitation => <InvitationRow key={invitation.id} invitation={invitation} role={role} onOpen={() => go("job-invitations", { invitationId: invitation.id })} />)}</div>}
    {query.data ? <ListPagination {...query.data.pagination} busy={query.isFetching} onPage={setPage} onLimit={value => { setLimit(value); setPage(1); }} /> : null}
  </div>;
}

function InvitationRow({ invitation, role, onOpen }: { invitation: Invitation; role: Props["role"]; onOpen: () => void }) {
  const status = useInvitationClock(invitation)!;
  const party = role === "institution" ? { name: invitation.instructor.fullName, image: invitation.instructor.imageUrl } : { name: invitation.institution.name, image: invitation.institution.imageUrl };
  return <article className="card flex flex-wrap items-start gap-4 p-5 sm:p-6">
    <Avatar name={party.name} src={party.image} size="lg" />
    <div className="min-w-0 flex-1 basis-56"><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-lg font-semibold">{invitation.job.title}</h2><StatusTag status={status} /></div><p className="mt-1 text-sm text-muted">{role === "institution" ? "Invited" : "From"} {party.name}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span><DateText value={invitation.job.startDate} /></span><span className="font-semibold">{pay(invitation)}</span><span className="text-muted">{[invitation.job.city, invitation.job.postalCode].filter(Boolean).join(", ") || "Location not specified"}</span></div>{status === "PENDING" ? <p className="mt-2 text-xs text-muted">Respond by <DateText value={invitation.expiresAt} /></p> : null}</div>
    <Btn variant="secondary" size="sm" iconRight="arrowRight" onClick={onOpen}>View invitation</Btn>
  </article>;
}

function InvitationDetail(props: Props & { id: string }) {
  const user = useCurrentUser();
  if (user.error) return <div className="app-page"><StateMessage title="Account unavailable" text={user.error.message} /><Btn className="mt-3" variant="secondary" onClick={() => void user.refetch()}>Try again</Btn></div>;
  if (!user.data) return <div className="app-page"><SectionLoader rows={4} /></div>;
  return <InvitationReview key={`${props.id}:${user.data.id}`} {...props} accountId={user.data.id} />;
}

function InvitationReview({ id, role, go, toast, accountId }: Props & { id: string; accountId: string }) {
  const query = useInvitation(id);
  const invitation = query.data;
  const status = useInvitationClock(invitation);
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<InvitationDecision | null>(null);
  const storageKey = `supplyed:invitation-decision:${accountId}:${id}`;
  const [retry, setRetry] = useState<InvitationDecision | null>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return ["accept", "decline", "cancel"].includes(saved ?? "") ? saved as InvitationDecision : null;
    } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useInvitationError();
  const retryAfter = useRateLimit();
  const [conflicted, setConflicted] = useState(false);
  const [copyLink, setCopyLink] = useState("");
  useEffect(() => {
    if (status && status !== "PENDING") {
      if (storageKey) { try { sessionStorage.removeItem(storageKey); } catch {} }
    }
  }, [status, storageKey]);

  async function decide(decision: InvitationDecision) {
    if (busyRef.current || retryAfter) return;
    busyRef.current = true; setBusy(true); setError("");
    if (storageKey) { try { sessionStorage.setItem(storageKey, decision); } catch {} }
    try {
      const result = await decideInvitationAction(id, decision);
      if (!result.ok) {
        setError(result.message, result);
        setRetry(result.uncertain ? decision : null);
        if (!result.uncertain && storageKey) { try { sessionStorage.removeItem(storageKey); } catch {} }
        if (result.status === 409) {
          setConflicted(true);
          for (const queryKey of [queryKeys.jobs.all, queryKeys.invitations.all, queryKeys.notifications.all, queryKeys.teachers.all, queryKeys.publicProfiles.all]) void client.invalidateQueries({ queryKey });
        }
        if (result.status === 401) { window.location.assign(invitationLoginHref(`/job-invitations/${id}`)); return; }
        await query.refetch();
        return;
      }
      setRetry(null); setConfirm(null);
      if (storageKey) { try { sessionStorage.removeItem(storageKey); } catch {} }
      if (result.data.invitation) client.setQueryData(queryKeys.invitations.detail(id), result.data.invitation);
      for (const key of [queryKeys.notifications.all, queryKeys.invitations.all, queryKeys.jobs.all, queryKeys.bookings.all, queryKeys.applications.all, queryKeys.teachers.all, queryKeys.publicProfiles.all, queryKeys.conversations.all]) void client.invalidateQueries({ queryKey: key });
      if (result.data.booking) { client.setQueryData(queryKeys.bookings.detail(result.data.booking.id), result.data.booking); go("bookings", { bookingId: result.data.booking.id }); }
      else toast({ title: decision === "decline" ? "Invitation declined" : "Invitation withdrawn", msg: "The invitation status has been updated.", tone: "success" });
    } catch { setError("The result could not be confirmed. Retry the same response safely, or refresh to check its status."); setRetry(decision); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function copy() {
    const link = new URL(`/job-invitations/${id}`, window.location.origin).href;
    try { await navigator.clipboard.writeText(link); toast({ title: "Link copied", msg: "Only the invited teacher and your school can open this invitation.", tone: "success" }); }
    catch { setCopyLink(link); }
  }
  const pending = status === "PENDING";
  const canAccept = invitation && pending && invitationCanAccept(invitation) && !conflicted;
  const counterpart = invitation ? role === "institution" ? invitation.instructor.fullName : invitation.institution.name : "";
  return <div className="app-page">
    <PageHead title="Job invitation" subtitle="Review the offered terms and response deadline." actions={<Btn icon="arrowLeft" variant="secondary" onClick={() => go("job-invitations")}>All invitations</Btn>} />
    {query.isLoading ? <SectionLoader rows={4} /> : null}
    {query.error ? <div className="mb-5"><StateMessage title="Invitation unavailable" text={query.error.message || "This invitation may not belong to your account."} /><Btn className="mt-3" variant="secondary" onClick={() => void query.refetch()}>Try again</Btn></div> : null}
    {invitation && status ? <>
      <section className="card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 border-b border-border bg-brand-tint p-5 sm:p-7"><Avatar name={counterpart} src={role === "institution" ? invitation.instructor.imageUrl : invitation.institution.imageUrl} size="lg" /><div className="min-w-0 flex-1 basis-44"><p className="mb-1 text-sm text-muted">{role === "institution" ? `Invitation to ${counterpart}` : `An offer from ${counterpart}`}</p><h1 className="font-heading text-2xl font-semibold sm:text-3xl">{invitation.job.title}</h1></div><StatusTag status={status} /></div>
        <div className="p-5 sm:p-7" role="status"><p className="font-semibold">{status === "EXPIRED" ? "This invitation has expired and can no longer be accepted." : status === "ACCEPTED" ? "Invitation accepted — a booking was created." : status === "DECLINED" ? "The teacher declined this invitation." : status === "CANCELLED" ? "This invitation has been withdrawn or the position is no longer available." : role === "institution" ? "Invitation sent — awaiting teacher acceptance" : "You have been invited to this job."}</p><p className="mt-2 text-sm leading-6 text-muted">{pending ? "No booking exists yet. This position is reserved exclusively for the invited teacher until a decision or expiry." : status === "ACCEPTED" ? "Manage the placement, completion and invoicing from the booking." : "No booking was created by this invitation."}</p>{pending ? <p className="mt-3 text-sm font-medium">Respond by <DateText value={invitation.expiresAt} /></p> : null}</div>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
          <section className="card overflow-hidden border-brand-tint-2 bg-brand-tint">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="w-fit rounded-xl border-2 border-surface shadow-sm [&>div]:rounded-lg"><Avatar name={invitation.institution.name} size="lg" src={invitation.institution.imageUrl} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">About the hiring school</div>
                <h2 className="mt-1 font-heading text-xl font-semibold text-ink">{invitation.institution.name}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">View the school’s profile, details and reviews before responding.</p>
              </div>
              <Btn className="w-full sm:w-auto" icon="building" onClick={() => go("institution-profile", { institutionId: invitation.institution.id, jobId: invitation.job.id })}>View school profile</Btn>
            </div>
          </section>
          <section className="card overflow-hidden">
            <div className="border-b border-border p-5"><h2 className="font-heading text-lg font-semibold">Offered placement</h2><p className="mt-1 text-xs text-muted">These are the terms offered in this invitation.</p></div>
            <dl className="grid gap-6 p-5 sm:grid-cols-2 sm:p-7">
              <Fact label="Job title">{invitation.job.title}</Fact>
              <Fact label="Posted by">{invitation.institution.name}</Fact>
              <Fact label="Start date and time"><DateText value={invitation.job.startDate} /></Fact>
              <Fact label="End date and time"><DateText value={invitation.job.endDate} /></Fact>
              <Fact label="Pay">{pay(invitation)}</Fact>
              {invitation.job.payType !== "fixed" ? <Fact label="Planned work">{formatPlannedUnits(invitation.job)}</Fact> : null}
              <Fact label="Invitation sent"><DateText value={invitation.createdAt} /></Fact>
              <Fact label="Response deadline"><DateText value={invitation.expiresAt} /></Fact>
            </dl>
          </section>
          <section className="card p-5 sm:p-7"><h2 className="mb-4 font-heading text-lg font-semibold">Role details</h2><FormattedJobDescription description={invitation.job.description} /></section>
          <section className="card p-5 sm:p-7">
            <h2 className="mb-4 font-heading text-lg font-semibold">Requirements</h2>
            <dl className="grid gap-6 sm:grid-cols-2">
              <Fact label="Subjects">{invitation.job.subject || "Not specified"}</Fact>
              <Fact label="Key stages">{invitation.job.keyStages.join(", ") || "Not specified"}</Fact>
              <Fact label="Minimum experience">{invitation.job.minExperienceYears != null ? `${invitation.job.minExperienceYears} ${invitation.job.minExperienceYears === 1 ? "year" : "years"}` : "Not specified"}</Fact>
              <Fact label="Required skills">{invitation.job.requiredSkills?.length ? <span className="flex flex-wrap gap-2">{invitation.job.requiredSkills.map(skill => <Tag key={skill} tone="ghost">{skill}</Tag>)}</span> : "Not specified"}</Fact>
            </dl>
          </section>
          <section className="card p-5 sm:p-7">
            <h2 className="mb-4 font-heading text-lg font-semibold">Location and arrival</h2>
            <dl className="grid gap-6 sm:grid-cols-2">
              <Fact label="Address">{invitation.job.address || "Not specified"}</Fact>
              <Fact label="City">{invitation.job.city || "Not specified"}</Fact>
              <Fact label="County">{invitation.job.county || "Not specified"}</Fact>
              <Fact label="Postcode">{invitation.job.postalCode || "Not specified"}</Fact>
              <Fact label="Country">{countryName(invitation.job.countryCode)}</Fact>
              <Fact label="Parking and arrival information">{invitation.job.parkingInfo || "Not specified"}</Fact>
            </dl>
          </section>
          {invitation.message ? <section className="card p-5 sm:p-7"><h2 className="mb-3 font-heading text-lg font-semibold">Message from the school</h2><p className="whitespace-pre-wrap text-sm leading-7 text-slate">{invitation.message}</p></section> : null}
        </div>
        <aside className="card row-start-1 p-5 sm:p-6 xl:sticky xl:top-6 xl:col-start-2">
          <h2 className="font-heading text-lg font-semibold">{role === "institution" ? "Manage invitation" : "Your response"}</h2>
          {role === "teacher" && pending ? <p className="mt-2 text-sm leading-6 text-muted">Review the offered job details, then accept or decline. Accepting confirms your booking with the school.</p> : null}
          {error && !(confirm && pending) ? <InvitationErrorNotice error={error} /> : null}
          {pending && !invitationCanAccept(invitation) ? <p className="mt-3 text-sm leading-6 text-muted">This job is currently unavailable for acceptance. The school may need to update it and send a new invitation.</p> : null}
          <div className="mt-4 grid gap-2">
            <Btn icon="building" variant="secondary" onClick={() => go("institution-profile", { institutionId: invitation.institution.id, jobId: invitation.job.id })}>View school profile</Btn>
            {retry && pending && !query.error ? <><p className="mb-2 text-sm text-muted">Your previous response is unconfirmed. Retry that same response to recover its result.</p><Btn disabled={Boolean(retryAfter) || busy} loading={busy} onClick={() => void decide(retry)}>Retry {retry === "cancel" ? "withdrawal" : retry === "accept" ? "acceptance" : "decline"}</Btn></> : pending && !query.error ? role === "teacher" ? <><Btn icon="check" disabled={Boolean(retryAfter) || busy || !canAccept || query.isFetching} onClick={() => setConfirm("accept")}>Accept invitation</Btn><Btn variant="secondary" disabled={Boolean(retryAfter) || busy || query.isFetching} onClick={() => setConfirm("decline")}>Decline invitation</Btn></> : <Btn variant="secondary" disabled={Boolean(retryAfter) || busy || query.isFetching} onClick={() => setConfirm("cancel")}>Withdraw invitation</Btn> : null}
            {status === "ACCEPTED" && invitation.bookingId ? <Btn iconRight="arrowRight" onClick={() => go("bookings", { bookingId: invitation.bookingId! })}>View booking</Btn> : null}
            {role === "institution" ? <Btn icon="copy" variant="secondary" onClick={() => void copy()}>Copy invitation link</Btn> : null}
            <Btn variant="ghost" disabled={Boolean(retryAfter) || busy} loading={query.isFetching} onClick={() => void query.refetch()}>Refresh status</Btn>
          </div>
          {copyLink ? <label className="mt-3 block text-xs text-muted">Invitation link<input className="input mt-2" readOnly value={copyLink} onFocus={event => event.target.select()} /></label> : null}
          <div className="mt-5 border-t border-border pt-5 text-xs leading-6 text-muted"><p>Current job status: <strong className="text-ink">{invitation.jobStatus.toLowerCase()}</strong></p>{invitation.publishOnDecline ? <p className="mt-2">{status === "DECLINED" ? invitation.jobStatus === "ACTIVE" ? "This job is now public and other teachers can apply." : "The job remains unavailable for public applications." : "After decline or school cancellation, an eligible job normally becomes public again. Its current status is refreshed from the server."}</p> : <p className="mt-2">The server decides whether this job can be reopened after a decision.</p>}<p className="mt-2">Payment follows the normal invoice process after a completed booking.</p></div>
        </aside>
      </div>
    </> : null}
    <Modal open={Boolean(confirm) && pending} onClose={() => { if (!busy) setConfirm(null); }} label="Confirm invitation response"><div className="p-6"><h2 className="font-heading text-xl font-semibold">{confirm === "accept" ? "Accept these placement terms?" : confirm === "decline" ? "Decline this invitation?" : "Withdraw this invitation?"}</h2><p className="mt-3 text-sm leading-6 text-muted">{confirm === "accept" ? "Accepting creates your confirmed booking at the dates and pay shown. You do not need to apply separately." : confirm === "decline" ? "The school will see your response. This does not close your conversation or reject an existing application." : "The teacher will no longer be able to accept this invitation. Withdrawal does not change the job’s visibility."}</p>{error ? <InvitationErrorNotice error={error} /> : null}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn variant="secondary" disabled={Boolean(retryAfter) || busy} onClick={() => setConfirm(null)}>Back</Btn><Btn loading={busy} disabled={Boolean(retryAfter) || busy || !pending || Boolean(query.error) || query.isFetching || (confirm === "accept" && !canAccept)} onClick={() => { if (confirm) void decide(confirm); }}>{confirm === "accept" ? "Accept and confirm booking" : confirm === "decline" ? "Confirm decline" : "Confirm withdrawal"}</Btn></div></div></Modal>
  </div>;
}

function StatusTag({ status }: { status: InvitationStatus }) { return <Tag tone={status === "ACCEPTED" ? "green" : status === "PENDING" ? "amber" : "ghost"}>{labels[status]}</Tag>; }
function StateMessage({ title, text }: { title: string; text: string }) { return <div className="card p-8 text-center" role="status"><Icon className="mx-auto mb-3 text-brand" name="mail" size={26} /><h2 className="font-heading text-xl">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{text}</p></div>; }
function Fact({ label, children }: { label: string; children: React.ReactNode }) { return <div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-ink">{children}</dd></div>; }
function DateText({ value }: { value?: string | null }) { const mounted = useMounted(); return <span>{value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short", ...(!mounted ? { timeZone: "UTC" } : {}) }).format(new Date(value)) : "Not specified"}</span>; }
function pay(invitation: Invitation) {
  if (invitation.job.payAmount == null) return "Not specified";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(invitation.job.payAmount) + (invitation.job.payType === "daily" ? " / day" : invitation.job.payType === "hourly" ? " / hour" : invitation.job.payType === "fixed" ? " fixed" : "");
}
function countryName(code?: string) {
  if (!code?.trim()) return "Not specified";
  try { return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code.trim().toUpperCase()) || code; }
  catch { return code; }
}
