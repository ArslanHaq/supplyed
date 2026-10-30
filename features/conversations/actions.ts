"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { normalizeRole } from "@/features/auth/backend";

import { MAX_ATTACHMENTS, MAX_MESSAGE_LENGTH, normalizeConversation, normalizeMessage } from "./schemas";
import type { ChatMessage, Conversation, SendMessageInput, StartConversationInput } from "./types";

export async function startConversationAction(input: StartConversationInput) {
  const auth = await getServerAuthContext();
  if (normalizeRole(auth?.role) !== "institution") return actionError("Only schools can start a conversation.");
  const validId = (id: unknown) => typeof id === "string" && Boolean(id.trim());
  if (!input || (input.applicationId ? !validId(input.applicationId) || input.instructorId !== undefined || input.jobId !== undefined : !validId(input.instructorId) || (input.jobId !== undefined && !validId(input.jobId)))) return actionError("Choose a teacher or an application to message.");
  const payload = input.applicationId ? { applicationId: input.applicationId } : { instructorId: input.instructorId, ...(input.jobId ? { jobId: input.jobId } : {}) };
  try {
    return actionOk(normalizeConversation(await api.post<Conversation>("/conversations", payload)));
  } catch (error) {
    return actionError(readError(error, "The conversation could not be opened."), errorOptions(error));
  }
}

/** Reads an existing conversation. Page loads and query retries never create threads. */
export async function openConversationForApplicationAction(applicationId: string) {
  const id = typeof applicationId === "string" ? applicationId.trim() : "";
  if (!id) return actionError("Choose a valid application.", { code: "APPLICATION_ID_REQUIRED" });

  try {
    return actionOk(normalizeConversation(await api.get<Conversation>(`/conversations/application/${id}`, { cache: "no-store" })));
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return actionError("The school has not started this conversation yet. You can reply once they contact you.");
    return actionError(readError(error, "The conversation could not be opened."), { code: errorCode(error) });
  }
}

export async function openConversationForBookingAction(bookingId: string) {
  if (typeof bookingId !== "string" || !bookingId.trim()) return actionError("Choose a valid booking.");
  try {
    return actionOk(normalizeConversation(await api.get<Conversation>(`/conversations/booking/${bookingId.trim()}`, { cache: "no-store" })));
  } catch (error) {
    return actionError(readError(error, "The booking conversation could not be opened."), { code: errorCode(error) });
  }
}

export async function sendMessageAction(input: SendMessageInput) {
  if (!input || typeof input.conversationId !== "string" || !input.conversationId.trim() || (input.body !== undefined && typeof input.body !== "string") || (input.attachmentIds !== undefined && (!Array.isArray(input.attachmentIds) || input.attachmentIds.length > MAX_ATTACHMENTS || input.attachmentIds.some(id => typeof id !== "string" || !id.trim())))) return actionError("Check your message and attachments before sending.");
  const body = input.body?.trim() ?? "";
  const attachmentIds = input.attachmentIds ?? [];
  if (!body && !attachmentIds.length) return actionError("Write a message or attach a file.", { code: "MESSAGE_EMPTY" });
  if (body.length > MAX_MESSAGE_LENGTH) return actionError("Messages can be up to 2,000 characters.", { code: "MESSAGE_TOO_LONG" });

  try {
    const message = await api.post<ChatMessage>(`/conversations/${input.conversationId}/messages`, {
      attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      body: body || undefined,
    });
    return actionOk(normalizeMessage(message));
  } catch (error) {
    return actionError(readError(error, "The message could not be sent."), errorOptions(error));
  }
}

export async function markConversationReadAction(conversationId: string) {
  try {
    await api.post(`/conversations/${conversationId}/read`);
    return actionOk(true);
  } catch (error) {
    return actionError(readError(error, "Could not mark the conversation read."), { code: errorCode(error) });
  }
}

export async function attachmentDownloadUrlAction(conversationId: string, attachmentId: string) {
  try {
    const link = await api.get<{ url: string }>(`/conversations/${conversationId}/attachments/${attachmentId}/download-url`, {
      cache: "no-store",
    });
    return actionOk(link.url);
  } catch (error) {
    return actionError(readError(error, "The file could not be downloaded."), { code: errorCode(error) });
  }
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined;
}

function errorOptions(error: unknown) {
  return error instanceof ApiError ? {
    code: error.code,
    requestId: error.requestId,
    retryAfter: error.retryAfter,
    status: error.status,
  } : {};
}

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
