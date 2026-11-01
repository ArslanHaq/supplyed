import { normalizeWorkUnits } from "@/features/jobs/work-units";
import { jobSubjects } from "@/features/teaching-catalogue/selection";
import { invitationStatuses, type Invitation, type InvitationStatus, type InvitationsPage } from "./types";

export function normalizeInvitation(value: Invitation): Invitation {
  if (!value?.id || !invitationStatuses.includes(value.status) || !value.job?.id || !value.instructor?.id || !value.institution?.id || !value.jobStatus || !["INSTANT", "BRIEF"].includes(value.jobType) || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error("The invitation response was incomplete. Please refresh or retry the same request.");
  return { ...value, isExclusive: value.isExclusive === true, invitationPath: `/job-invitations/${encodeURIComponent(value.id)}`, invitationUrl: value.invitationUrl ?? null, message: value.message ?? null, bookingId: value.bookingId ?? null, decidedAt: value.decidedAt ?? null,
    job: { ...value.job, ...normalizeWorkUnits(value.job), subjects: jobSubjects(value.job), subject: jobSubjects(value.job).join(", "), keyStages: value.job.keyStages ?? [], requiredSkills: value.job.requiredSkills ?? [], payAmount: value.job.payAmount == null ? null : Number(value.job.payAmount) },
  };
}
export function normalizeInvitationsPage(value: InvitationsPage): InvitationsPage {
  return { ...value, invitations: (value.invitations ?? []).map(normalizeInvitation) };
}
export function effectiveInvitationStatus(invitation: Pick<Invitation, "status" | "expiresAt">, now = Date.now()): InvitationStatus {
  return invitation.status === "PENDING" && Date.parse(invitation.expiresAt) <= now ? "EXPIRED" : invitation.status;
}
export function invitationCanAccept(invitation: Invitation, now = Date.now()) {
  const available = invitation.isExclusive
    ? invitation.jobStatus === "RESERVED"
    : invitation.jobType === "INSTANT" && invitation.jobStatus === "ACTIVE";
  return effectiveInvitationStatus(invitation, now) === "PENDING" && available && Boolean(invitation.job.startDate) && Date.parse(invitation.job.startDate!) > now;
}
