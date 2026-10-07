"use client";

import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { markConversationReadAction, openConversationForApplicationAction, sendMessageAction } from "./actions";
import { acquireConversationSocket, liveMessagingAvailable, releaseConversationSocket } from "./socket";
import type {
  ChatMessage,
  Conversation,
  ConversationsPage,
  MessageAttachment,
  MessageEventPayload,
  MessagesPage,
  ReadEventPayload,
  SendMessageInput,
  TypingEventPayload,
  TypingState,
} from "./types";

/** How long "is typing" stays on screen after the last notice, in case the "stopped" one is lost. */
const TYPING_TIMEOUT_MS = 4000;

/** Without a live socket, threads and the list refresh on a timer instead. */
const FALLBACK_REFETCH_MS = 30_000;

/** The thread opened from an application is cached separately from the list; both must see the same updates. */
const applicationEntries = { queryKey: [...queryKeys.conversations.all, "application"] as const };

type MessagesData = InfiniteData<MessagesPage, string | undefined>;
type ConversationsData = InfiniteData<ConversationsPage, number>;

/** The thread list, a page at a time: the most recent threads first, older ones loaded on demand. */
export function useConversations(options: { enabled?: boolean; limit?: number } = {}) {
  const limit = options.limit ?? 100;
  return useInfiniteQuery({
    enabled: options.enabled ?? true,
    getNextPageParam: (page: ConversationsPage) => (page.pagination.hasNextPage ? page.pagination.page + 1 : undefined),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchJson<ConversationsPage>("/api/conversations", { query: { page: pageParam, limit } }),
    queryKey: limit === 100 ? queryKeys.conversations.list() : [...queryKeys.conversations.list(), { limit }],
    refetchInterval: liveMessagingAvailable() ? false : FALLBACK_REFETCH_MS,
  });
}

/**
 * All loaded threads in order. Threads move to the top as messages arrive,
 * so a later page can repeat one already shown; the first copy wins.
 */
export function flattenConversations(data: InfiniteData<ConversationsPage, unknown> | undefined): Conversation[] {
  const seen = new Set<string>();

  return (data?.pages ?? []).flatMap((page) => page.conversations).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
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
    refetchInterval: liveMessagingAvailable() ? false : FALLBACK_REFETCH_MS,
  });
}

/** All loaded messages of a thread, oldest first. */
export function flattenMessages(data: InfiniteData<MessagesPage, unknown> | undefined): ChatMessage[] {
  return (data?.pages ?? []).slice().reverse().flatMap((page) => page.messages);
}

/** Adds a message to its cached thread. False when the thread is not cached yet, so the caller can refetch instead. */
function appendMessage(queryClient: ReturnType<typeof useQueryClient>, message: ChatMessage): boolean {
  const key = queryKeys.conversations.messages(message.conversationId);
  const current = queryClient.getQueryData<MessagesData>(key);

  if (!current?.pages.length) return false;
  if (current.pages.some((page) => page.messages.some((item) => item.id === message.id))) return true;

  const [newest, ...older] = current.pages;
  queryClient.setQueryData<MessagesData>(key, { ...current, pages: [{ ...newest, messages: [...newest.messages, message] }, ...older] });
  return true;
}

function patchConversation(queryClient: ReturnType<typeof useQueryClient>, conversationId: string, patch: (item: Conversation) => Conversation) {
  const apply = (item: Conversation) => (item.id === conversationId ? patch(item) : item);
  queryClient.setQueriesData<ConversationsData>({ queryKey: queryKeys.conversations.list() }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, conversations: page.conversations.map(apply) })) } : data,
  );
  queryClient.setQueriesData<Conversation>(applicationEntries, (item) => (item ? apply(item) : item));
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
      if (!appendMessage(queryClient, message)) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(message.conversationId) });
      }
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
      patchConversation(queryClient, conversationId, (item) => ({ ...item, unreadCount: 0 }));
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
 * One live Socket.IO connection per signed-in user. New messages, read
 * receipts and typing notices are written straight into the cached thread,
 * list and badge, so every screen updates as they arrive. The socket
 * reconnects by itself after a drop, fetching a fresh ticket each time.
 */
export function useConversationStream(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const socket = acquireConversationSocket();
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let connections = 0;

    const onMessage = (payload: MessageEventPayload) => {
      // A thread still loading its first page is refetched instead, so the new message is not lost.
      if (!appendMessage(queryClient, payload.message)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(payload.conversationId) });
      }
      queryClient.setQueryData<TypingState | null>(queryKeys.conversations.typing(payload.conversationId), () => null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.unread() });
    };

    const onRead = (payload: ReadEventPayload) => {
      patchConversation(queryClient, payload.conversationId, (item) =>
        item.me !== payload.side ? { ...item, counterpartLastReadAt: payload.readAt } : item,
      );
    };

    const onTyping = (payload: TypingEventPayload) => {
      const key = queryKeys.conversations.typing(payload.conversationId);
      clearTimeout(typingTimers.get(payload.conversationId));
      const next: TypingState | null = payload.typing ? { side: payload.side, typing: true } : null;
      queryClient.setQueryData<TypingState | null>(key, () => next);

      if (payload.typing) {
        typingTimers.set(
          payload.conversationId,
          setTimeout(() => queryClient.setQueryData<TypingState | null>(key, () => null), TYPING_TIMEOUT_MS),
        );
      }
    };

    // "ready" means the server has joined us to our room; after a reconnect, anything missed is fetched again.
    const onReady = () => {
      connections += 1;
      if (connections > 1) void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    };

    socket?.on("message", onMessage);
    socket?.on("read", onRead);
    socket?.on("typing", onTyping);
    socket?.on("ready", onReady);

    return () => {
      typingTimers.forEach((timer) => clearTimeout(timer));
      socket?.off("message", onMessage);
      socket?.off("read", onRead);
      socket?.off("typing", onTyping);
      socket?.off("ready", onReady);
      releaseConversationSocket();
    };
  }, [enabled, queryClient]);
}

/** Whether the other person is typing in this thread right now. */
export function useTypingIndicator(conversationId: string | undefined) {
  return useQuery<TypingState | null>({
    enabled: false,
    queryFn: () => null,
    queryKey: queryKeys.conversations.typing(conversationId ?? ""),
    staleTime: Infinity,
  }).data ?? null;
}
