"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { MAX_MESSAGE_LENGTH, normalizeConversation, normalizeMessage } from "./schemas";
import type { ChatMessage, Conversation, SendMessageInput } from "./types";

/** Opens (or starts) the conversation about an application. */
export async function openConversationForApplicationAction(applicationId: string) {
  const id = applicationId.trim();
  if (!id) return actionError("Choose a valid application.", { code: "APPLICATION_ID_REQUIRED" });

  try {
    return actionOk(normalizeConversation(await api.get<Conversation>(`/conversations/application/${id}`, { cache: "no-store" })));
  } catch (error) {
    return actionError(readError(error, "The conversation could not be opened."), { code: errorCode(error) });
  }
}

export async function sendMessageAction(input: SendMessageInput) {
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
    return actionError(readError(error, "The message could not be sent."), { code: errorCode(error) });
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

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
