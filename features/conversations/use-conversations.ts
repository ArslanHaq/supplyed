"use client";

import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { markConversationReadAction, openConversationForApplicationAction, sendMessageAction } from "./actions";
import type { ChatMessage, Conversation, ConversationStreamEvent, MessageAttachment, MessagesPage, SendMessageInput } from "./types";

type MessagesData = InfiniteData<MessagesPage, string | undefined>;

export function useConversations(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<Conversation[]>("/api/conversations"),
    queryKey: queryKeys.conversations.list(),
  });
}

/** Total unread, for the navigation badge. Kept fresh live; the slow refetch only covers a dropped connection. */
export function useUnreadMessages(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<{ total: number }>("/api/conversations/unread-count"),
    queryKey: queryKeys.conversations.unread(),
    refetchInterval: 60_000,
  });
}

/** Opens the conversation about an application (starting it on first use). */
export function useConversationForApplication(applicationId: string | undefined) {
  return useQuery({
    enabled: Boolean(applicationId),
    queryFn: async () => {
      const result = await openConversationForApplicationAction(applicationId as string);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: queryKeys.conversations.forApplication(applicationId ?? ""),
  });
}

/** A thread's messages: the newest page first, with older pages loaded on demand. */
export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery({
    enabled: Boolean(conversationId),
    getNextPageParam: (page: MessagesPage) => (page.hasMore ? page.messages[0]?.id : undefined),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchJson<MessagesPage>(`/api/conversations/${conversationId}/messages`, { query: { before: pageParam } }),
    queryKey: queryKeys.conversations.messages(conversationId ?? ""),
  });
}

/** All loaded messages of a thread, oldest first. */
export function flattenMessages(data: InfiniteData<MessagesPage, unknown> | undefined): ChatMessage[] {
  return (data?.pages ?? []).slice().reverse().flatMap((page) => page.messages);
}

function appendMessage(queryClient: ReturnType<typeof useQueryClient>, message: ChatMessage) {
  queryClient.setQueryData<MessagesData>(queryKeys.conversations.messages(message.conversationId), (current) => {
    if (!current?.pages.length) return current;
    if (current.pages.some((page) => page.messages.some((item) => item.id === message.id))) return current;

    const [newest, ...older] = current.pages;
    return { ...current, pages: [{ ...newest, messages: [...newest.messages, message] }, ...older] };
  });
}

export function useSendMessage(options: { onError?: (message: string) => void } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const result = await sendMessageAction(input);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onError: (error) => options.onError?.(error.message),
    onSuccess: async (message) => {
      appendMessage(queryClient, message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => markConversationReadAction(conversationId),
    onSuccess: async (result, conversationId) => {
      if (!result.ok) return;
      queryClient.setQueryData<Conversation[]>(queryKeys.conversations.list(), (list) =>
        list?.map((item) => (item.id === conversationId ? { ...item, unreadCount: 0 } : item)),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.unread() });
    },
  });
}

/** Uploads a file for the conversation; it can then be sent in a message. */
export async function uploadAttachment(conversationId: string, file: File): Promise<MessageAttachment> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`/api/conversations/${conversationId}/attachments`, { body: form, method: "POST" });
  const payload = (await response.json().catch(() => null)) as (MessageAttachment & { message?: string }) | null;

  if (!response.ok || !payload?.id) throw new Error(payload?.message || `${file.name} could not be uploaded. Please try again.`);

  return payload;
}

/**
 * One live connection per signed-in user. New messages and read receipts are
 * written straight into the cached thread, list and badge, so every screen
 * updates as they arrive. EventSource reconnects by itself after a drop.
 */
export function useConversationStream(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    const source = new EventSource("/api/conversations/stream");

    const onMessage = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as Extract<ConversationStreamEvent, { type: "message" }>;
      appendMessage(queryClient, payload.message);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.unread() });
    };

    const onRead = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as Extract<ConversationStreamEvent, { type: "read" }>;
      queryClient.setQueryData<Conversation[]>(queryKeys.conversations.list(), (list) =>
        list?.map((item) =>
          item.id === payload.conversationId && item.me !== payload.side ? { ...item, counterpartLastReadAt: payload.readAt } : item,
        ),
      );
    };

    source.addEventListener("message", onMessage as EventListener);
    source.addEventListener("read", onRead as EventListener);

    return () => source.close();
  }, [enabled, queryClient]);
}
