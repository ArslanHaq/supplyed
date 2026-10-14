"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AppNotification, NotificationType } from "@/features/notifications/types";
import {
  desktopAlertPermission,
  flattenNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationStream,
  useUnreadNotifications,
} from "@/features/notifications/use-notifications";
import { useMounted } from "@/lib/use-mounted";

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

/**
 * The bell in the top bar: the unread count, and a panel listing
 * notifications newest first. New ones arrive live over the socket (teachers
 * and schools); opening one marks it read and goes to its page.
 */
export function NotificationBell({ live, onSettings }: { live: boolean; onSettings: () => void }) {
  const router = useRouter();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const panelRef = useRef<HTMLDivElement>(null);
  const unreadQuery = useUnreadNotifications(true);
  const listQuery = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const openLink = useCallback((link: string) => router.push(link), [router]);
  useNotificationStream(live, openLink);

  const unread = mounted ? unreadQuery.data?.total ?? 0 : 0;
  const notifications = flattenNotifications(listQuery.data);

  // Close on a click outside the panel or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setPermission(desktopAlertPermission());
    setOpen((value) => !value);
  }

  function select(notification: AppNotification) {
    if (!notification.readAt) markRead.mutate(notification);
    setOpen(false);
    if (notification.link) router.push(notification.link);
  }

  async function enableDesktopAlerts() {
    if (desktopAlertPermission() === "unsupported") return;
    setPermission(await Notification.requestPermission());
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="notif-btn"
        onClick={toggle}
        type="button"
      >
        <Icon name="bell" size={16} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          aria-label="Notifications"
          className="notification-panel absolute right-0 top-12 z-50 flex max-h-[70vh] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-panel"
          role="dialog"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div><div className="font-semibold">Notifications</div><p className="mt-0.5 text-xs text-muted">Your latest workspace updates</p></div>
            <div className="flex items-center gap-1">
              {unread > 0 ? (
                <Btn disabled={markAllRead.isPending} size="sm" variant="ghost" onClick={() => markAllRead.mutate()}>
                  Mark all as read
                </Btn>
              ) : null}
              <Btn size="sm" variant="ghost" onClick={() => { setOpen(false); onSettings(); }}>
                Email settings
              </Btn>
            </div>
          </div>

          {permission === "default" && live ? (
            <button className="border-b border-border bg-brand-tint px-4 py-2 text-left text-xs text-brand" onClick={() => void enableDesktopAlerts()} type="button">
              Get desktop alerts when SupplyEd is in the background. Turn on
            </button>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listQuery.isLoading ? <div className="p-4"><SectionLoader rows={3} /></div> : null}
            {listQuery.error ? <p className="p-4 text-sm text-danger" role="alert">{listQuery.error.message}</p> : null}
            {!listQuery.isLoading && !listQuery.error && notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-chalk text-brand-dark"><Icon name="bell" size={21} /></span>
                <div className="font-semibold">You&apos;re all caught up</div>
                <p className="mt-1 text-sm text-muted">Job matches, application updates and bookings will show here.</p>
              </div>
            ) : null}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                className={`flex w-full gap-3 border-b border-border px-5 py-4 text-left transition hover:bg-chalk ${notification.readAt ? "" : "bg-brand-tint/40"}`}
                onClick={() => select(notification)}
                type="button"
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${notification.readAt ? "bg-chalk text-muted" : "bg-brand-tint text-brand"}`}>
                  <Icon name={ICON_BY_TYPE[notification.type] ?? "bell"} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${notification.readAt ? "font-medium" : "font-semibold"}`}>{notification.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">{notification.body}</span>
                  <span className="mt-1 block text-[11px] text-muted">{timeAgo(notification.createdAt)}</span>
                </span>
                {notification.readAt ? null : <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </button>
            ))}
            {listQuery.hasNextPage ? (
              <div className="p-3">
                <Btn className="w-full" loading={listQuery.isFetchingNextPage} loadingLabel="Loading" size="sm" variant="ghost" onClick={() => void listQuery.fetchNextPage()}>
                  Show older
                </Btn>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function timeAgo(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
}
