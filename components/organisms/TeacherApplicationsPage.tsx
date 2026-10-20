import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";
import { useState } from "react";

import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import { useMyApplications } from "@/features/applications/use-applications";
import { effectiveInvitationStatus } from "@/features/invitations/schemas";
import type { Invitation, InvitationStatus } from "@/features/invitations/types";
import { useAllInvitations } from "@/features/invitations/use-invitations";
import { useJob } from "@/features/jobs/use-jobs";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { ProposalPreview } from "../molecules/ProposalPreviewModal";
import { WorkspaceEmptyState } from "./WorkspacePanels";

type StatusFilter = "ALL" | "INVITED" | JobApplicationStatus;


export function TeacherApplicationsPage({ go, initialFilter = "ALL" }: Pick<RouteProps, "go"> & { initialFilter?: StatusFilter }) {
  const choices = useDropdown("applicationStatus");
  const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [{ label: "All", value: "ALL" }, { label: "Invited", value: "INVITED" }, ...(choices.data?.options ?? []).map(option => ({ label: option.label, value: option.value as JobApplicationStatus }))];
  const [status, setStatus] = useState<StatusFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const invited = status === "INVITED";
  const applicationsQuery = useMyApplications({ limit: 20, page, status: status === "ALL" || invited ? undefined : status }, !invited);
  const invitationsQuery = useAllInvitations();
  const applications = applicationsQuery.data?.applications ?? [];
  const invitations = [...(invitationsQuery.data ?? [])].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const invitationCounts = new Map<string, number>();
  for (const invitation of invitations) invitationCounts.set(invitation.job.id, (invitationCounts.get(invitation.job.id) ?? 0) + 1);
  const invitationPage = invitations.slice((page - 1) * 20, page * 20);
  const pagination = invited ? { page, total: invitations.length, totalPages: Math.ceil(invitations.length / 20), hasNextPage: page * 20 < invitations.length } : applicationsQuery.data?.pagination;
  const total = pagination?.total ?? (invited ? invitations.length : applications.length);
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
            {item.value === "INVITED" && invitationsQuery.data ? `${item.label} (${invitations.length})` : item.label}
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
        {invited ? invitationPage.map((invitation) => <TeacherInvitationCard go={go} invitation={invitation} key={invitation.id} />) : applications.map((application) => <TeacherApplicationCard application={application} go={go} invitationCount={invitationCounts.get(application.jobId) ?? 0} key={application.id} />)}
      </div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between">
          <Btn disabled={page <= 1} variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
          <span className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</span>
          <Btn disabled={!pagination.hasNextPage} variant="secondary" onClick={() => setPage((value) => value + 1)}>Next</Btn>
        </div>
      ) : null}
    </div>
  );
}

function TeacherApplicationCard({ application, go, invitationCount }: { application: JobApplication; go: RouteProps["go"]; invitationCount: number }) {
  const jobQuery = useJob(application.jobId);
  const job = jobQuery.data;
  const jobTitle = application.jobName?.trim() || job?.title;
  const location = job ? [job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC" : "Job details unavailable";

  return (
    <div className="teacher-application-card card card-pad-lg">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ApplicationStatusTag status={application.status} />
            {invitationCount ? <Tag tone="purple">Invited{invitationCount > 1 ? ` · ${invitationCount}` : ""}</Tag> : null}
            {job?.status ? <Tag tone="ghost">Job {job.status.toLowerCase()}</Tag> : null}
            {application.createdAt ? <span className="text-xs text-muted">Applied {formatSubmittedAt(application.createdAt)}</span> : null}
          </div>
          <h3 className="font-heading text-2xl">
            {job ? <button className="cursor-pointer text-left hover:text-brand" onClick={() => go("job-detail", { jobId: application.jobId })} type="button">{jobTitle}</button>
              : jobTitle || (jobQuery.isLoading ? "Loading job..." : "Job no longer public")}
          </h3>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted">
            <span className="flex items-center gap-1"><Icon name="building" size={13} />{job?.school ?? "Hiring account"}</span>
            <span className="flex items-center gap-1"><Icon name="pin" size={13} />{location}</span>
            {job?.date ? <span className="flex items-center gap-1"><Icon name="clock" size={13} />{job.date}</span> : null}
          </div>
          {application.coverLetter ? <ProposalPreview applicantImage={application.instructor?.imageUrl} applicantName={application.instructor?.fullName ?? "You"} jobTitle={jobTitle} schoolName={job?.school} submittedAt={application.createdAt} title="Your proposal" value={application.coverLetter} /> : null}
        </div>
        <div className="teacher-application-actions">
          {job?.rate ? <div className="text-right"><div className="font-heading text-xl">GBP {job.rate}</div><div className="text-xs text-muted">per day</div></div> : null}
          <Btn size="sm" icon="message" onClick={() => go("messaging", { applicationId: application.id })}>Message school</Btn>
          {job || jobQuery.isLoading ? <Btn disabled={!job} size="sm" variant="secondary" onClick={() => go("job-detail", { jobId: application.jobId })}>View job</Btn>
            : <span className="text-xs text-muted">Listing unavailable</span>}
        </div>
      </div>
    </div>
  );
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
  return status.toLowerCase().replace(/_/g, " ");
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
