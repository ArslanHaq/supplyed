import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeNotificationsPage, normalizePreferences } from "./schemas";
import type { NotificationPreferences, NotificationsPage } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

/** One page of the signed-in user's notifications, newest first. */
export async function listNotifications(page = 1, limit = 15, unreadOnly = false): Promise<NotificationsPage> {
  if (!backendEnabled()) return normalizeNotificationsPage(null, page, limit);

  const result = await api.get<unknown>("/notifications", {
    cache: "no-store",
    query: { limit, page, ...(unreadOnly ? { unread: "true" } : {}) },
  });

  return normalizeNotificationsPage(result, page, limit);
}

export async function getUnreadNotificationCount(): Promise<{ total: number }> {
  if (!backendEnabled()) return { total: 0 };

  const result = await api.get<{ total?: number }>("/notifications/unread-count", { cache: "no-store" });
  return { total: Number(result?.total ?? 0) };
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return normalizePreferences(await api.get<unknown>("/notifications/preferences", { cache: "no-store" }));
}
