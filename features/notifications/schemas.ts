import type { AppNotification, NotificationPreferences, NotificationsPage } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** Only in-app paths are followed, so a notification can never send the user off-site. */
export function safeNotificationLink(link: unknown): string | null {
  return typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : null;
}

export function normalizeNotification(value: unknown): AppNotification {
  const item = isRecord(value) ? value : {};

  return {
    body: typeof item.body === "string" ? item.body : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
    data: isRecord(item.data) ? item.data : {},
    id: typeof item.id === "string" ? item.id : "",
    link: safeNotificationLink(item.link),
    readAt: typeof item.readAt === "string" ? item.readAt : null,
    title: typeof item.title === "string" ? item.title : "",
    type: (typeof item.type === "string" ? item.type : "APPLICATION_STATUS") as AppNotification["type"],
  };
}

export function normalizeNotificationsPage(value: unknown, page: number, limit: number): NotificationsPage {
  const result = isRecord(value) ? value : {};
  const pagination = isRecord(result.pagination) ? result.pagination : {};

  return {
    notifications: Array.isArray(result.notifications) ? result.notifications.map(normalizeNotification) : [],
    pagination: {
      hasNextPage: Boolean(pagination.hasNextPage),
      limit: typeof pagination.limit === "number" ? pagination.limit : limit,
      page: typeof pagination.page === "number" ? pagination.page : page,
      total: typeof pagination.total === "number" ? pagination.total : 0,
      totalPages: typeof pagination.totalPages === "number" ? pagination.totalPages : 0,
    },
    unreadCount: typeof result.unreadCount === "number" ? result.unreadCount : 0,
  };
}

export function normalizePreferences(value: unknown): NotificationPreferences {
  const prefs = isRecord(value) ? value : {};

  return {
    emailJobMatches: prefs.emailJobMatches !== false,
    emailMessages: prefs.emailMessages !== false,
    emailUpdates: prefs.emailUpdates !== false,
  };
}
