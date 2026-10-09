import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeConversation, normalizeMessagesPage } from "./schemas";
import type { Conversation, ConversationsPage, ConversationsPagination, MessagesPage } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

/** One page of the signed-in user's threads, most recent activity first. */
export async function listMyConversations(page = 1, limit = 20): Promise<ConversationsPage> {
  const empty = { hasNextPage: false, limit, page, total: 0, totalPages: 0 };
  if (!backendEnabled()) return { conversations: [], pagination: empty };

  const result = await api.get<{ conversations?: Conversation[]; pagination?: Partial<ConversationsPagination> }>("/conversations", {
    cache: "no-store",
    query: { limit, page },
  });

  return {
    conversations: (result?.conversations ?? []).map(normalizeConversation),
    pagination: { ...empty, ...result?.pagination },
  };
}

export async function getUnreadMessageCount(): Promise<{ total: number }> {
  if (!backendEnabled()) return { total: 0 };

  const result = await api.get<{ total: number }>("/conversations/unread-count", { cache: "no-store" });
  return { total: Number(result?.total ?? 0) };
}

export async function getConversation(id: string): Promise<Conversation> {
  return normalizeConversation(await api.get<Conversation>(`/conversations/${id}`, { cache: "no-store" }));
}

export async function listMessages(id: string, before?: string): Promise<MessagesPage> {
  if (!backendEnabled()) return { hasMore: false, messages: [] };

  const page = await api.get<MessagesPage>(`/conversations/${id}/messages`, {
    cache: "no-store",
    query: { before, limit: 30 },
  });
  return normalizeMessagesPage(page);
}
