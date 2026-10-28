import { AgreedTerms } from "../molecules/AgreedTerms";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";
import { useState } from "react";

import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useApplication, useApplicationHistory, useMyApplications } from "@/features/applications/use-applications";
import { effectiveInvitationStatus } from "@/features/invitations/schemas";
import type { Invitation, InvitationStatus } from "@/features/invitations/types";
import { useInvitations } from "@/features/invitations/use-invitations";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { FormattedJobDescription, PageHead, SectionLoader } from "../molecules";
import { ProposalContent } from "../molecules/ProposalContent";
import { ListPagination } from "../molecules/ListPagination";
import { WorkspaceEmptyState } from "./WorkspacePanels";

type StatusFilter = "ALL" | "INVITED" | JobApplicationStatus;


export function TeacherApplicationsPage({ go, ctx, initialFilter = "APPLIED" }: Pick<RouteProps, "go" | "ctx"> & { initialFilter?: StatusFilter }) {
  return ctx.applicationId ? <TeacherApplicationDetail id={ctx.applicationId} go={go} /> : <TeacherApplicationList go={go} initialFilter={initialFilter} />;
}

function TeacherApplicationList({ go, initialFilter = "APPLIED" }: Pick<RouteProps, "go"> & { initialFilter?: StatusFilter }) {
  const choices = useDropdown("applicationStatus");
  const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [{ label: "All", value: "ALL" }, { label: "Invited", value: "INVITED" }, ...(choices.data?.options ?? []).map(option => ({ label: option.label, value: option.value as JobApplicationStatus }))];
  const [status, setStatus] = useState<StatusFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const invited = status === "INVITED";
  const applicationsQuery = useMyApplications({ limit, page, status: status === "ALL" || invited ? undefined : status }, !invited);
  const invitationsQuery = useInvitations({ page, limit }, invited);
  const applications = applicationsQuery.data?.applications ?? [];
  const invitationPage = invitationsQuery.data?.invitations ?? [];
  const pagination = invited ? invitationsQuery.data?.pagination : applicationsQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const activeQuery = invited ? invitationsQuery : applicationsQuery;

  return (
    <div className="app-page teacher-applications-page">
      <PageHead
        title="My applications"
        subtitle={invited ? `${total} direct ${total === 1 ? "invitation" : "invitations"} received from schools` : `${total} ${total === 1 ? "application" : "applications"} tracked across your job searches`}
        actions={<Btn icon="search" onClick={() => go("find-jobs")}>Find jobs</Btn>}
      />

      <div className="workspace-toolbar card card-pad mb-6 flex flex-wrap items-center gap-2">
        <DropdownStatus name="applicationStatus" />
        {STATUS_FILTERS.map((item) => (
          <Btn
            key={item.value}
            aria-pressed={status === item.value}
            size="sm"
            variant={status === item.value ? "secondary" : "ghost"}
            onClick={() => {
              setStatus(item.value);
              setPage(1);
            }}
          >
            {item.label}
          </Btn>
        ))}
      </div>

      {activeQuery.isLoading ? <SectionLoader rows={4} /> : null}
      {activeQuery.isError ? (
        <div className="card card-pad-lg text-center" role="alert">
          <div className="font-heading text-[24px]">{invited ? "Invitations" : "Applications"} could not be loaded</div>
          <p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">{activeQuery.error.message}</p>
          <Btn className="mt-5" variant="secondary" onClick={() => void activeQuery.refetch()}>Try again</Btn>
        </div>
      ) : null}

      {!activeQuery.isLoading && !activeQuery.isError && (invited ? invitationPage.length === 0 : applications.length === 0) ? (
        <WorkspaceEmptyState icon={invited ? "mail" : "file"} title={invited ? "No invitations yet" : "No applications yet"} message={invited ? "Direct invitations from schools will appear here as soon as they are sent." : "Apply for a role and your application status will appear here."} action={invited ? <Btn icon="mail" onClick={() => go("job-invitations")}>Open invitations</Btn> : <Btn icon="search" onClick={() => go("find-jobs")}>Find jobs</Btn>} />
      ) : null}

      <div className="space-y-4">
        {invited ? invitationPage.map((invitation) => <TeacherInvitationCard go={go} invitation={invitation} key={invitation.id} />) : applications.map((application) => <TeacherApplicationCard application={application} go={go} key={application.id} />)}
      </div>

      {pagination ? <ListPagination {...pagination} busy={activeQuery.isFetching} onPage={setPage} onLimit={value => { setLimit(value); setPage(1); }} /> : null}
    </div>
  );
}

function TeacherApplicationCard({ application, go }: { application: JobApplication; go: RouteProps["go"] }) {
  const job = application.agreedTerms;
  return <article className="card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="min-w-0 flex-1 basis-60">
        <div className="mb-3 flex flex-wrap items-center gap-3"><ApplicationStatusTag status={application.status} />{application.createdAt ? <span className="text-xs text-muted">Submitted {formatSubmittedAt(application.createdAt)}</span> : null}</div>
        <h2 className="font-heading text-xl font-semibold"><button className="text-left hover:text-brand hover:underline" onClick={() => go("applications", { applicationId: application.id })}>{application.jobName || "Application"}</button></h2>
        {application.school ? <button className="mt-2 flex items-center gap-2 text-sm text-brand hover:underline" onClick={() => go("institution-profile", { institutionId: application.school!.id })}><Icon name="building" size={15} />{application.school.name}<Icon name="arrowRight" size={13} /></button> : null}
        {!job ? <p className="mt-3 text-sm text-muted">Original agreed terms are unavailable.</p> : null}{job ? <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">{job.startDate ? <span className="flex items-center gap-1.5"><Icon name="calendar" size={14} />{formatDateRange(job.startDate, job.endDate)}</span> : null}{[job.city, job.county, job.postalCode].filter(Boolean).length ? <span className="flex items-center gap-1.5"><Icon name="pin" size={14} />{[job.city, job.county, job.postalCode].filter(Boolean).join(", ")}</span> : null}{job.payAmount != null ? <span>{formatApplicationPay(job.payAmount, job.payType)}</span> : null}</div> : null}
      </div>
      <Btn iconRight="arrowRight" variant="secondary" onClick={() => go("applications", { applicationId: application.id })}>View application</Btn>
    </div>
  </article>;
}

function TeacherApplicationDetail({ id, go }: { id: string; go: RouteProps["go"] }) {
  const query = useApplication(id);
  const application = query.data;
  const job = application?.agreedTerms;
  return <div className="app-page">
    <PageHead title="Your application" subtitle="Your submitted application and its current outcome." actions={<Btn icon="arrowLeft" variant="secondary" onClick={() => go("applications")}>All applications</Btn>} />
    {query.isLoading ? <SectionLoader rows={3} /> : query.error ? <div className="card p-6" role="alert"><h2 className="font-heading text-xl">Application unavailable</h2><p className="my-3 text-sm text-muted">{query.error.message}</p><Btn variant="secondary" onClick={() => void query.refetch()}>Try again</Btn></div> : application ? <>
      <section className="card mb-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Submitted application</p><h2 className="font-heading text-2xl font-semibold">{application.jobName || "Application"}</h2>{application.school ? <p className="mt-2 text-sm text-muted">{application.school.name}</p> : null}</div><ApplicationStatusTag status={application.status} /></div>
        <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-5 text-sm">
          {application.createdAt ? <div><dt className="text-xs text-muted">Submitted</dt><dd className="mt-1 font-medium">{formatSubmittedAt(application.createdAt)}</dd></div> : null}
          {application.updatedAt ? <div><dt className="text-xs text-muted">Last updated</dt><dd className="mt-1 font-medium">{formatSubmittedAt(application.updatedAt)}</dd></div> : null}
        </dl>
        <p className="mt-5 rounded-lg bg-chalk px-4 py-3 text-sm leading-6 text-slate">{applicationOutcome(application.status)}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {application.conversationId ? <Btn icon="message" onClick={() => go("messaging", { conversationId: application.conversationId! })}>Application conversation</Btn> : null}
          {application.bookingId ? <Btn variant="secondary" onClick={() => go("bookings", { bookingId: application.bookingId! })}>View booking</Btn> : null}
        </div>
      </section>
      {application.school ? <section className="card mb-5 flex flex-wrap items-center gap-4 p-6"><Avatar name={application.school.name} src={application.school.imageUrl} size="lg" /><div className="min-w-0 flex-1"><p className="text-xs text-muted">Posted by</p><h2 className="mt-1 font-heading text-lg font-semibold">{application.school.name}</h2></div><Btn icon="building" variant="secondary" onClick={() => go("institution-profile", { institutionId: application.school!.id })}>View school profile</Btn></section> : null}
      {job ? <section className="card mb-5 p-6 sm:p-8"><h2 className="font-heading text-lg font-semibold">Placement details</h2><dl className="my-6 grid gap-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {job.subject ? <div><dt className="text-xs text-muted">Subject</dt><dd className="mt-1 font-medium">{job.subject}</dd></div> : null}
        {job.startDate ? <div><dt className="text-xs text-muted">Placement dates</dt><dd className="mt-1 font-medium">{formatDateRange(job.startDate, job.endDate)}</dd></div> : null}
        {job.payAmount != null ? <div><dt className="text-xs text-muted">Pay</dt><dd className="mt-1 font-medium">{formatApplicationPay(job.payAmount, job.payType)}</dd></div> : null}
        {[job.city, job.county, job.postalCode].filter(Boolean).length ? <div><dt className="text-xs text-muted">Location</dt><dd className="mt-1 font-medium">{[job.city, job.county, job.postalCode].filter(Boolean).join(", ")}</dd></div> : null}
      </dl>{job.description ? <div className="border-t border-border pt-5"><h3 className="mb-3 text-sm font-semibold">About the role</h3><FormattedJobDescription description={job.description} /></div> : null}</section> : null}
      <AgreedTerms terms={application.agreedTerms} /><ApplicationTimeline id={application.id} />
      <section className="card p-6 sm:p-8"><h2 className="mb-5 font-heading text-lg font-semibold">Your submitted proposal</h2>{application.coverLetter ? <ProposalContent value={application.coverLetter} /> : <p className="text-sm text-muted">No proposal was included with this application.</p>}</section>
    </> : null}
  </div>;
}

function ApplicationTimeline({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const query = useApplicationHistory(id, page, limit);
  return <section className="card mb-5 p-6 sm:p-8"><h2 className="mb-5 font-heading text-lg font-semibold">Application history</h2>
    {query.isLoading ? <SectionLoader rows={2} /> : query.error ? <div role="alert"><p className="mb-3 text-sm text-muted">The application history could not be loaded.</p><Btn size="sm" variant="secondary" onClick={() => void query.refetch()}>Try again</Btn></div> : query.data?.history.length ? <ol className="space-y-5">{query.data.history.map(entry => <li className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-brand-tint-2 pl-4" key={entry.id}><div><p className="text-sm font-semibold">{entry.toStatus === "HIRED" ? "Application accepted · Hired" : entry.toStatus === "REJECTED" ? "Application rejected" : entry.toStatus === "APPLIED" ? "Application submitted" : formatStatus(entry.toStatus)}</p><p className="mt-1 text-xs text-muted">{applicationOutcome(entry.toStatus)}</p></div><time className="text-xs text-muted" dateTime={entry.createdAt}>{formatSubmittedAt(entry.createdAt)}</time></li>)}</ol> : <p className="text-sm text-muted">No earlier status changes were recorded.</p>}
    {query.data && query.data.pagination.totalPages > 1 ? <ListPagination {...query.data.pagination} busy={query.isFetching} onPage={setPage} onLimit={value => { setPage(1); setLimit(value); }} /> : null}
  </section>;
}

function applicationOutcome(status: JobApplicationStatus) {
  return { APPLIED: "Your application has been submitted and is awaiting review.", VIEWED: "The school has viewed your application.", SHORTLISTED: "The school has shortlisted your application.", HIRED: "Your application was accepted and you were hired for this placement.", REJECTED: "The school did not select your application for this placement." }[status];
}

function formatApplicationPay(amount: number, type?: string | null) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount) + (type ? ` ${payUnit(type)}` : "");
}

function TeacherInvitationCard({ go, invitation }: { go: RouteProps["go"]; invitation: Invitation }) {
  const status = effectiveInvitationStatus(invitation);
  const location = [invitation.job.city, invitation.job.county, invitation.job.postalCode].filter(Boolean).join(", ") || "Location to confirm";
  return <div className="teacher-application-card card card-pad-lg">
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Tag tone="purple">Invited</Tag>
          <InvitationStatusTag status={status} />
          <span className="text-xs text-muted">Received {formatSubmittedAt(invitation.createdAt)}</span>
        </div>
        <h3 className="font-heading text-2xl">{invitation.job.title}</h3>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted">
          <span className="flex items-center gap-1"><Icon name="building" size={13} />{invitation.institution.name || "Hiring school"}</span>
          <span className="flex items-center gap-1"><Icon name="pin" size={13} />{location}</span>
          {invitation.job.startDate ? <span className="flex items-center gap-1"><Icon name="clock" size={13} />{formatDateRange(invitation.job.startDate, invitation.job.endDate)}</span> : null}
        </div>
        {invitation.message ? <p className="mt-3 line-clamp-2 border-l-2 border-brand-tint-2 pl-3 text-sm leading-6 text-muted">{invitation.message}</p> : null}
      </div>
      <div className="teacher-application-actions">
        {invitation.job.payAmount ? <div className="text-right"><div className="font-heading text-xl">GBP {invitation.job.payAmount}</div><div className="text-xs text-muted">{payUnit(invitation.job.payType)}</div></div> : null}
        <Btn size="sm" icon="mail" onClick={() => go("job-invitations", { invitationId: invitation.id })}>Review invitation</Btn>
        <Btn size="sm" icon="message" variant="secondary" onClick={() => go("messaging")}>Open messages</Btn>
      </div>
    </div>
  </div>;
}

function InvitationStatusTag({ status }: { status: InvitationStatus }) {
  const tone = status === "ACCEPTED" ? "green" : status === "PENDING" ? "amber" : status === "DECLINED" || status === "CANCELLED" || status === "EXPIRED" ? "ghost" : "purple";
  return <Tag tone={tone}>{formatStatus(status)}</Tag>;
}

function ApplicationStatusTag({ status }: { status: JobApplicationStatus }) {
  const tone = status === "HIRED" ? "green" : status === "SHORTLISTED" ? "purple" : status === "REJECTED" ? "red" : status === "VIEWED" ? "amber" : "ghost";
  return <Tag tone={tone}>{formatStatus(status)}</Tag>;
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

function formatSubmittedAt(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(parsed));
}

function formatDateRange(start: string, end?: string | null) {
  const format = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(value));
  const first = format(start);
  const last = end && Number.isFinite(Date.parse(end)) ? format(end) : first;
  return first === last ? first : `${first} – ${last}`;
}

function payUnit(type?: string | null) {
  if (type === "hourly") return "per hour";
  if (type === "fixed") return "fixed";
  return "per day";
}
