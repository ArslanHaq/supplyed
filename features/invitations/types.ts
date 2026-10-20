import type { JobCreateInput } from "@/features/jobs/types";

export const invitationStatuses = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED"] as const;
export type InvitationStatus = typeof invitationStatuses[number];
export type InvitationInput = { requestId: string; instructorId: string; message?: string; expiresAt?: string } & (
  { jobId: string; newJob?: never } | { newJob: JobCreateInput; jobId?: never }
);
export type Invitation = {
  id: string;
  status: InvitationStatus;
  /** Frozen offered terms; listing visibility fields remain on the managed job. */
  job: Omit<JobCreateInput, "status" | "liveFrom" | "expiresAt" | "otherSubjects" | "otherSkills"> & { id: string; subject?: string };
  jobStatus: string;
  instructor: { id: string; fullName: string; imageUrl: string | null };
  institution: { id: string; name: string; imageUrl: string | null };
  message: string | null;
  publishOnDecline: boolean;
  expiresAt: string;
  decidedAt: string | null;
  bookingId: string | null;
  invitationPath: string;
  invitationUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
export type InvitationListQuery = { page?: number; limit?: number; status?: InvitationStatus };
export type InvitationsPage = { invitations: Invitation[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean } };
export type InvitationDecision = "accept" | "decline" | "cancel";
