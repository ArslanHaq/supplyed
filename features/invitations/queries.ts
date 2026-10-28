import "server-only";
import { normalizeRole } from "@/features/auth/backend";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { api, ApiError } from "@/lib/server/api-client";
import { normalizeInvitation, normalizeInvitationsPage } from "./schemas";
import type { Invitation, InvitationListQuery, InvitationsPage } from "./types";

async function requireParticipantRole() {
  const auth = await getServerAuthContext();
  if (!auth) throw new ApiError("Sign in to view invitations.", 401);
  if (!["institution", "teacher"].includes(normalizeRole(auth.role) ?? "")) throw new ApiError("Invitations are available to schools and teachers only.", 403);
}
export async function listInvitations(query: InvitationListQuery) {
  await requireParticipantRole();
  return normalizeInvitationsPage(await api.get<InvitationsPage>("/job-invitations/me", { cache: "no-store", query }));
}
export async function getInvitation(id: string) {
  await requireParticipantRole();
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) throw new ApiError("Invitation not found.", 404);
  return normalizeInvitation(await api.get<Invitation>(`/job-invitations/${id}`, { cache: "no-store" }));
}
