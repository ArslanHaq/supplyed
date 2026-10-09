"use client";

import { useRouter } from "next/navigation";

import type { AppNotification, NotificationType } from "@/features/notifications/types";
import { useMarkNotificationRead, useRecentNotifications } from "@/features/notifications/use-notifications";

import { Btn, Icon } from "../atoms";
import { SectionLoader } from "../molecules";

const ICON_BY_TYPE: Record<NotificationType, string> = {
  APPLICATION_RECEIVED: "users",
  APPLICATION_STATUS: "file",
  BOOKING_CANCELLED: "x",
  BOOKING_COMPLETED: "check",
  BOOKING_CONFIRMED: "checkCircle",
  INVOICE_PAID: "pound",
  JOB_MATCH: "zap",
  PROFILE_STATUS: "shield",
  REVIEW_RECEIVED: "star",
};

/** The four newest real notifications, shared by teacher and institution dashboards. */
export function RecentNotifications() {
  const router = useRouter();
  const notificationsQuery = useRecentNotifications(true, 4);
  const markRead = useMarkNotificationRead();
  const notifications = notificationsQuery.data?.notifications ?? [];

  function select(notification: AppNotification) {
    if (!notification.readAt) markRead.mutate(notification);
    if (notification.link) router.push(notification.link);
  }

  return (
    <section aria-labelledby="recent-activity-heading" className="dashboard-activity card">
      <header className="hiring-panel-heading"><div><h2 id="recent-activity-heading">Recent activity</h2><p>Your latest hiring and booking updates.</p></div><span aria-hidden="true" className="hiring-panel-icon"><Icon name="bell" size={18} /></span></header>
      <div className="dashboard-activity-list">
        {notificationsQuery.isLoading ? <div className="card-pad"><SectionLoader rows={4} /></div> : null}
        {notificationsQuery.isError ? (
          <div className="card-pad text-center" role="alert">
            <div className="font-semibold">Recent activity could not be loaded</div>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <Btn className="mt-3" size="sm" variant="secondary" onClick={() => void notificationsQuery.refetch()}>Try again</Btn>
          </div>
        ) : null}
        {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 ? (
          <div className="card-pad text-center">
            <div className="font-semibold">No recent activity</div>
            <p className="mt-1 text-sm text-muted">Your latest job, application, booking, payment and profile updates will appear here.</p>
          </div>
        ) : null}
        {notifications.map((notification) => (
          <button
            key={notification.id}
            className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-chalk ${notification.readAt ? "" : "bg-brand-tint/40"}`}
            onClick={() => select(notification)}
            type="button"
          >
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${notification.readAt ? "bg-chalk text-muted" : "bg-brand-tint text-brand"}`}>
              <Icon name={ICON_BY_TYPE[notification.type] ?? "bell"} size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${notification.readAt ? "font-medium" : "font-semibold"}`}>{notification.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">{notification.body}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 pt-1 text-xs text-muted">
              {formatActivityTime(notification.createdAt)}
              {notification.readAt ? null : <span aria-label="Unread" className="h-2 w-2 rounded-full bg-brand" />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatActivityTime(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
}
