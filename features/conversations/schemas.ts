import { normalizeWorkUnits } from "@/features/jobs/work-units";
import type { ChatMessage, Conversation, ConversationParticipant, MessageAttachment, MessagesPage } from "./types";

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
];

function readDateIso(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeAttachment(attachment: Partial<MessageAttachment>): MessageAttachment {
  return {
    contentType: attachment.contentType ?? "application/octet-stream",
    fileName: attachment.fileName ?? "file",
    id: attachment.id ?? "",
    sizeBytes: Number(attachment.sizeBytes ?? 0),
  };
}

export function normalizeMessage(message: Partial<ChatMessage>): ChatMessage {
  return {
    attachments: Array.isArray(message.attachments) ? message.attachments.map(normalizeAttachment) : [],
    body: message.body ?? "",
    conversationId: message.conversationId ?? "",
    createdAt: readDateIso(message.createdAt) ?? new Date(0).toISOString(),
    id: message.id ?? "",
    senderSide: message.senderSide === "instructor" || message.senderSide === "poster" ? message.senderSide : null,
  };
}

export function normalizeConversation(conversation: Partial<Conversation>): Conversation {
  return {
    applicationId: conversation.applicationId || null,
    booking: conversation.booking?.id ? conversation.booking : null,
    applicationStatus: conversation.applicationStatus || null,
    counterpart: normalizeParticipant(conversation.counterpart),
    participants: {
      instructor: normalizeParticipant(conversation.participants?.instructor),
      poster: normalizeParticipant(conversation.participants?.poster),
    },
    counterpartLastReadAt: readDateIso(conversation.counterpartLastReadAt),
    createdAt: readDateIso(conversation.createdAt),
    id: conversation.id ?? "",
    job: conversation.job?.id ? { ...normalizeWorkUnits(conversation.job), id: conversation.job.id, title: conversation.job.title || "Job" } : null,
    lastMessage: conversation.lastMessage
      ? {
          body: conversation.lastMessage.body ?? "",
          createdAt: readDateIso(conversation.lastMessage.createdAt) ?? new Date(0).toISOString(),
          fromMe: Boolean(conversation.lastMessage.fromMe),
          hasAttachments: Boolean(conversation.lastMessage.hasAttachments),
        }
      : null,
    lastMessageAt: readDateIso(conversation.lastMessageAt),
    me: conversation.me === "poster" || conversation.me === "instructor" ? conversation.me : null,
    readOnly: conversation.me == null || Boolean(conversation.readOnly),
    unreadCount: Number(conversation.unreadCount ?? 0),
  };
}

function normalizeParticipant(person: Partial<ConversationParticipant> | null | undefined): ConversationParticipant | null {
  if (!person) return null;
  return { id: person.id ?? null, userId: person.userId ?? null, imageUrl: person.imageUrl ?? null, name: person.name || "Account unavailable", role: person.role === "teacher" ? "teacher" : "school" };
}

export function normalizeMessagesPage(page: Partial<MessagesPage>): MessagesPage {
  return {
    hasMore: Boolean(page.hasMore),
    messages: Array.isArray(page.messages) ? page.messages.map(normalizeMessage) : [],
  };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
