"use client";

import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { acquireConversationSocket, liveMessagingAvailable, releaseConversationSocket } from "@/features/conversations/socket";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { markAllNotificationsReadAction, markNotificationReadAction, updateNotificationPreferencesAction } from "./actions";
import { normalizeNotification, safeNotificationLink } from "./schemas";
import type {
  AppNotification,
  NotificationCountPayload,
  NotificationEventPayload,
  NotificationPreferences,
  NotificationsPage,
} from "./types";

type ListData = InfiniteData<NotificationsPage, number>;

const PAGE_SIZE = 15;

/** The inbox, a page at a time, newest first. Fetched when the bell opens. */
export function useNotifications(enabled: boolean) {
  return useInfiniteQuery({
    enabled,
    getNextPageParam: (page: NotificationsPage) => (page.pagination.hasNextPage ? page.pagination.page + 1 : undefined),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchJson<NotificationsPage>("/api/notifications", { query: { limit: PAGE_SIZE, page: pageParam } }),
    queryKey: queryKeys.notifications.list(),
  });
}

/** A small newest-first page used by dashboard activity previews. */
export function useRecentNotifications(enabled = true, limit = 4) {
  return useQuery({
    enabled,
    queryFn: () => fetchJson<NotificationsPage>("/api/notifications", { query: { limit, page: 1 } }),
    queryKey: queryKeys.notifications.recent(limit),
  });
}

/** All loaded notifications, in order, without repeats. */
export function flattenNotifications(data: InfiniteData<NotificationsPage, unknown> | undefined): AppNotification[] {
  const seen = new Set<string>();

  return (data?.pages ?? []).flatMap((page) => page.notifications).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** The bell badge. Live over the socket; the slow refetch covers accounts without one (admins) and dropped connections. */
export function useUnreadNotifications(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => fetchJson<{ total: number }>("/api/notifications/unread-count"),
    queryKey: queryKeys.notifications.unread(),
    refetchInterval: 60_000,
  });
}

function setUnread(queryClient: ReturnType<typeof useQueryClient>, total: number) {
  queryClient.setQueryData(queryKeys.notifications.unread(), { total: Math.max(0, total) });
}

function patchList(queryClient: ReturnType<typeof useQueryClient>, patch: (item: AppNotification) => AppNotification) {
  queryClient.setQueryData<ListData>(queryKeys.notifications.list(), (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, notifications: page.notifications.map(patch) })) } : data,
  );
}

function patchRecent(queryClient: ReturnType<typeof useQueryClient>, patch: (item: AppNotification) => AppNotification) {
  queryClient.setQueriesData<NotificationsPage>({ queryKey: queryKeys.notifications.recent() }, (data) =>
    data ? { ...data, notifications: data.notifications.map(patch) } : data,
  );
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: AppNotification) => {
      const result = await markNotificationReadAction(notification.id);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    // Shown as read straight away; the server's own count follows over the socket.
    onMutate: (notification) => {
      if (notification.readAt) return;
      const readAt = new Date().toISOString();
      patchList(queryClient, (item) => (item.id === notification.id ? { ...item, readAt } : item));
      patchRecent(queryClient, (item) => (item.id === notification.id ? { ...item, readAt } : item));
      const current = queryClient.getQueryData<{ total: number }>(queryKeys.notifications.unread());
      if (current) setUnread(queryClient, current.total - 1);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onMutate: () => {
      const readAt = new Date().toISOString();
      patchList(queryClient, (item) => (item.readAt ? item : { ...item, readAt }));
      patchRecent(queryClient, (item) => (item.readAt ? item : { ...item, readAt }));
      setUnread(queryClient, 0);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => fetchJson<NotificationPreferences>("/api/notifications/preferences"),
    queryKey: queryKeys.notifications.preferences(),
  });
}

export function useUpdateNotificationPreferences(options: { onDone?: (ok: boolean, message?: string) => void } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<NotificationPreferences>) => updateNotificationPreferencesAction(input),
    onSuccess: (result) => {
      if (result.ok) queryClient.setQueryData(queryKeys.notifications.preferences(), result.data);
      options.onDone?.(result.ok, result.message);
    },
    onError: () => options.onDone?.(false),
  });
}

/** Whether this browser can show desktop alerts, and what the user decided. */
export function desktopAlertPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

/**
 * New notifications arrive live on the shared socket: the bell's count and
 * list update in place, and while the tab is in the background (and the user
 * allowed it) the browser shows a desktop alert that opens the right page.
 */
export function useNotificationStream(enabled: boolean, onOpen: (link: string) => void) {
  const queryClient = useQueryClient();
  const openRef = useRef(onOpen);

  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (!enabled || !liveMessagingAvailable()) return;

    const socket = acquireConversationSocket();
    let connections = 0;

    const onNotification = (payload: NotificationEventPayload) => {
      const notification = normalizeNotification(payload.notification);
      setUnread(queryClient, payload.unreadCount);
      queryClient.setQueryData<ListData>(queryKeys.notifications.list(), (data) => {
        if (!data?.pages.length || data.pages.some((page) => page.notifications.some((item) => item.id === notification.id))) return data;
        const [first, ...rest] = data.pages;
        return { ...data, pages: [{ ...first, notifications: [notification, ...first.notifications] }, ...rest] };
      });
      queryClient.setQueriesData<NotificationsPage>({ queryKey: queryKeys.notifications.recent() }, (data) => {
        if (!data) return data;
        const notifications = [notification, ...data.notifications.filter((item) => item.id !== notification.id)]
          .slice(0, data.pagination.limit);
        return { ...data, notifications, unreadCount: payload.unreadCount };
      });
      if (notification.type === "APPLICATION_RECEIVED") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
      }
      showDesktopAlert(notification, (link) => openRef.current(link));
    };

    const onCount = (payload: NotificationCountPayload) => {
      setUnread(queryClient, payload.unreadCount);
      // Read in another tab: the list is refetched next time it is shown.
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(), refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.recent() });
    };

    // After a reconnect, anything missed while offline is fetched again.
    const onReady = () => {
      connections += 1;
      if (connections > 1) void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    };

    socket?.on("notification", onNotification);
    socket?.on("notification:count", onCount);
    socket?.on("ready", onReady);

    return () => {
      socket?.off("notification", onNotification);
      socket?.off("notification:count", onCount);
      socket?.off("ready", onReady);
      releaseConversationSocket();
    };
  }, [enabled, queryClient]);
}

function showDesktopAlert(notification: AppNotification, open: (link: string) => void) {
  if (desktopAlertPermission() !== "granted" || document.visibilityState === "visible") return;

  try {
    const alert = new Notification(notification.title, { body: notification.body, icon: "/favicon.svg", tag: notification.id });
    alert.onclick = () => {
      window.focus();
      const link = safeNotificationLink(notification.link);
      if (link) open(link);
      alert.close();
    };
  } catch {
    // Some browsers only allow alerts from a service worker; the bell still shows it.
  }
}
