"use server";

import { actionError } from "@/lib/server/action-response";
import { normalizeRole } from "@/features/auth/backend";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { validateInvitation } from "./validation";
import { normalizeInvitation } from "./schemas";
import { normalizeBooking } from "@/features/bookings/schemas";
import type { Booking } from "@/features/bookings/types";
import { normalizeConversation, normalizeMessage, normalizeMessagesPage } from "@/features/conversations/schemas";
import type { ChatMessage, Conversation, MessagesPage } from "@/features/conversations/types";
import type { Invitation, InvitationDecision, InvitationInput } from "./types";

export type InvitationResult<T> = { ok: true; data: T } | { ok: false; message: string; uncertain: boolean; code?: string; status?: number; fieldErrors?: Record<string, string>; requestId?: string };
export type CreateInvitationResult = InvitationResult<Invitation> & { conversationId?: string };

export async function createInvitationAction(input: InvitationInput): Promise<CreateInvitationResult> {
  let invitation: Invitation;
  try {
    const auth = await getServerAuthContext();
    if (!auth) return { ok: false, message: "Sign in again, then retry this saved invitation.", uncertain: true, status: 401 };
    if (normalizeRole(auth.role) !== "institution") return { ok: false, message: "Only schools can send an invitation.", uncertain: false, status: 403 };
    const fieldErrors = validateInvitation(input);
    if (Object.keys(fieldErrors).length) return { ok: false, message: "Check the hiring details before continuing.", fieldErrors, uncertain: false };
    // Time-dependent eligibility is checked by the backend after its idempotency lookup.
    invitation = normalizeInvitation(await api.post<Invitation>("/job-invitations", input));
  } catch (error) {
    return failure(error);
  }

  try {
    const conversation = normalizeConversation(await api.post<Conversation>("/conversations", {
      instructorId: invitation.instructor.id,
    }));
    if (!conversation.id) throw new Error("The conversation response was incomplete.");

    const body = invitationConversationMessage(invitation);
    const recent = normalizeMessagesPage(await api.get<MessagesPage>(`/conversations/${conversation.id}/messages`, {
      cache: "no-store",
      query: { limit: 100 },
    }));
    if (!recent.messages.some((item) => item.senderSide === "poster" && item.body === body)) {
      normalizeMessage(await api.post<ChatMessage>(`/conversations/${conversation.id}/messages`, { body }));
    }

    return { ok: true, data: invitation, conversationId: conversation.id };
  } catch (error) {
    return {
      ok: false,
      message: "The invitation was sent, but its conversation could not be started. Retry the same invitation to finish opening the chat.",
      uncertain: true,
      status: error instanceof ApiError ? error.status : undefined,
      requestId: error instanceof ApiError ? error.requestId : undefined,
    };
  }
}

function invitationConversationMessage(invitation: Pick<Invitation, "id" | "invitationPath" | "job">) {
  const path = invitation.invitationPath || `/job-invitations/${encodeURIComponent(invitation.id)}`;
  return `I've sent you a job invitation for “${invitation.job.title}”. Review and respond from Job invitations: ${path}`;
}

export async function decideInvitationAction(id: string, decision: InvitationDecision): Promise<InvitationResult<{ invitation?: Invitation; booking?: Booking }>> {
  try {
    const auth = await getServerAuthContext();
    const role = normalizeRole(auth?.role);
    if (!auth) return { ok: false, message: "Sign in to respond to this invitation.", uncertain: false, status: 401 };
    if (!["accept", "decline", "cancel"].includes(decision) || (decision === "cancel" ? role !== "institution" : role !== "teacher")) return { ok: false, message: "This action is not available for your account.", uncertain: false, status: 403 };
    if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) return { ok: false, message: "Choose a valid invitation.", uncertain: false, status: 400 };
    if (decision === "accept") {
      const booking = await api.post<Booking>(`/job-invitations/${id}/accept`);
      if (!booking?.id || !booking.applicationId || !booking.status) throw new Error("The acceptance result was incomplete. Retry acceptance to retrieve the booking.");
      return { ok: true, data: { booking: normalizeBooking(booking) } };
    }
    return { ok: true, data: { invitation: normalizeInvitation(await api.post<Invitation>(`/job-invitations/${id}/${decision}`)) } };
  } catch (error) { return failure(error); }
}

function failure(error: unknown): InvitationResult<never> {
  const mapped = actionError(error instanceof Error ? error.message : "The invitation result could not be confirmed. Please try again.", { code: error instanceof ApiError ? error.code : undefined, status: error instanceof ApiError ? error.status : undefined });
  return { ...mapped, fieldErrors: mapped.fieldErrors as Record<string, string> | undefined, ok: false, uncertain: !(error instanceof ApiError) || error.status >= 500 || [408, 401].includes(error.status), status: error instanceof ApiError ? error.status : undefined, requestId: error instanceof ApiError ? error.requestId : undefined };
}
