import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeConversation, normalizeMessagesPage } from "./schemas";
import type { Conversation, MessagesPage } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function listMyConversations(): Promise<Conversation[]> {
  if (!backendEnabled()) return [];

  const conversations = await api.get<Conversation[]>("/conversations", { cache: "no-store" });
  return (conversations ?? []).map(normalizeConversation);
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
