"use client";

import type { NotificationPreferences } from "@/features/notifications/types";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/features/notifications/use-notifications";
import type { AppRole, ToastFn } from "@/types/supplyed";

import { Icon, Toggle } from "../atoms";
import { SectionLoader } from "../molecules";

type Row = { description: string; key: keyof NotificationPreferences; label: string };

/** Which optional emails the user gets. Everything still shows in the app's bell. */
export function NotificationSettings({ role, toast }: { role: AppRole; toast: ToastFn }) {
  const prefsQuery = useNotificationPreferences();
  const update = useUpdateNotificationPreferences({
    onDone: (ok, message) => {
      if (!ok) toast({ msg: message ?? "Please try again.", title: "Could not save", tone: "danger" });
    },
  });
  // Shows a switch's new position while it saves.
  const prefs = prefsQuery.data && update.isPending ? { ...prefsQuery.data, ...update.variables } : prefsQuery.data;
  const rows: Row[] = [
    ...(role === "teacher"
      ? [{ description: "New jobs that match your profile 80% or better (at most 3 emails a day).", key: "emailJobMatches", label: "Job matches" } as Row]
      : []),
    { description: "When a message has gone unread for about 15 minutes (at most one an hour per conversation).", key: "emailMessages", label: "Unread messages" },
    {
      description: role === "teacher" ? "Shortlists, interview requests, decisions and bookings." : "Bookings confirmed or cancelled.",
      key: "emailUpdates",
      label: role === "teacher" ? "Applications and bookings" : "Bookings",
    },
  ];

  return (
    <section aria-labelledby="notification-settings-heading" className="card card-pad-lg account-notifications" id="notification-settings">
      <div className="account-section-icon"><Icon name="bell" size={20} /></div>
      <h2 className="font-heading text-2xl leading-tight" id="notification-settings-heading">Email notifications</h2>
      <p className="mt-2 max-w-[660px] text-sm leading-6 text-muted">
        Everything appears in the bell at the top of the page. Choose what we also send by email. Payment and account emails always go
        out.
      </p>
      {prefsQuery.isLoading ? <div className="mt-5"><SectionLoader rows={2} /></div> : null}
      {prefsQuery.error ? <p className="mt-4 text-sm text-danger" role="alert">{prefsQuery.error.message}</p> : null}
      {prefs ? (
        <div className="notification-preference-list mt-5 divide-y divide-border">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-5 py-5">
              <div>
                <div className="text-sm font-semibold">{row.label}</div>
                <div className="text-xs leading-5 text-muted">{row.description}</div>
              </div>
              <Toggle label={row.label} on={prefs[row.key]} onChange={(on) => update.mutate({ [row.key]: on })} />
            </div>
          ))}
        </div>
      ) : null}
      <p className="settings-autosave-note" aria-live="polite"><Icon name={update.isPending ? "loader" : "checkCircle"} size={14} /> {update.isPending ? "Saving your preferences…" : "Notification preferences save automatically."}</p>
    </section>
  );
}
