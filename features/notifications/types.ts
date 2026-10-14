export type NotificationType =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_STATUS"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_CONFIRMED"
  | "INVOICE_PAID"
  | "JOB_MATCH"
  | "PROFILE_STATUS"
  | "REVIEW_RECEIVED";

export type AppNotification = {
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  /** App page to open, e.g. /job-detail?jobId=... */
  link: string | null;
  readAt: string | null;
  body: string;
  title: string;
  type: NotificationType;
};

export type NotificationsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type NotificationsPage = {
  notifications: AppNotification[];
  pagination: NotificationsPagination;
  unreadCount: number;
};

/** Which optional emails the user wants; in-app notifications are always on. */
export type NotificationPreferences = {
  emailJobMatches: boolean;
  emailMessages: boolean;
  emailUpdates: boolean;
};

/** Socket events. */
export type NotificationEventPayload = { notification: AppNotification; unreadCount: number };
export type NotificationCountPayload = { unreadCount: number };
