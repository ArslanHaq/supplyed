"use client";

import { useId, useState } from "react";
import type { Booking } from "@/features/bookings/types";
import { paymentReleaseSchedule } from "@/features/bookings/payment-release-schedule";
import { Btn, Icon, Tag } from "../atoms";
import { Modal } from "../molecules";

function calendarLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function PaymentReleaseSchedule({ booking }: { booking: Booking }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const periods = open ? paymentReleaseSchedule(booking) : [];
  return <>
    <section aria-labelledby={titleId} className="mx-5 my-5 rounded-xl border border-brand/20 bg-brand-tint/40 p-5 sm:mx-7 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/15 bg-surface text-brand shadow-sm">
            <Icon name="calendar" size={24} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Payment planning</p>
            <h3 id={titleId} className="font-heading text-lg font-semibold text-ink">Payment release schedule</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">See estimated payment dates and the working days covered, assuming all scheduled shifts are present.</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Icon name="clock" size={13} />Preview only · No payment will be released</p>
          </div>
        </div>
        <Btn className="w-full shrink-0 sm:w-auto" variant="primary" aria-label="View payment release schedule" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          View schedule <Icon name="arrowRight" size={17} />
        </Btn>
      </div>
    </section>
    <Modal label="Estimated payment release schedule" open={open} onClose={() => setOpen(false)}>
      <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl">Estimated payment release schedule</h2>
          <Btn size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Btn>
        </div>
        <p className="mt-2 font-semibold">{booking.job.title}</p>
        <div className="mt-3"><Tag tone="purple">All scheduled shifts assumed present</Tag></div>
        <p className="mt-3 text-sm leading-6 text-muted">Display only. These are estimated collection eligibility dates in {booking.timeZone || "Europe/London"}, not guaranteed bank payout dates. Actual payment depends on confirmed attendance, completion, payment settings and Stripe processing.</p>
        <p className="mt-2 text-xs leading-5 text-muted">Weekly and monthly dates follow the agreed {booking.periodAnchor === "CALENDAR" ? "calendar" : "assignment-start"} boundaries. Marking a booking completed can make its final period eligible earlier. After-completion payments require the booking to be marked completed.</p>
        {booking.status === "CANCELLED" || booking.status === "NO_SHOW" ? <p className="mt-3 text-sm text-warning">This booking is {booking.status === "CANCELLED" ? "cancelled" : "marked no-show"}. The schedule below is hypothetical and does not mean a payment is owed.</p> : null}
        {periods.length ? <ol className="mt-5 space-y-3">{periods.map((period, index) => <li key={period.key} className="rounded-xl border border-border bg-chalk/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{index + 1}. {period.label}</h3><span className="text-xs text-muted">{period.dates.length} working {period.dates.length === 1 ? "day" : "days"} · {period.shifts} {period.shifts === 1 ? "shift" : "shifts"}</span></div>
          <p className="mt-2 font-semibold text-brand">{calendarLabel(period.releaseDate)} at {period.releaseTime}</p>
          <p className="mt-1 text-xs text-muted">Estimated eligibility{period.key === "completion" ? " after the final planned shift, subject to completion" : " when this payment period closes"}</p>
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted">Working dates covered</summary><ul className="mt-2 space-y-1">{period.dates.map(date => <li key={date}>{calendarLabel(date)}</li>)}</ul></details>
        </li>)}</ol> : <p className="mt-5 rounded-xl border border-border p-4 text-sm text-muted">{booking.paymentFrequency === "milestone" ? "Release dates require an agreed milestone schedule." : !booking.schedule || !booking.startDate || !booking.endDate ? "Exact schedule details were not recorded for this booking, so release dates cannot be estimated." : "No scheduled payments to display."}</p>}
      </div>
    </Modal>
  </>;
}
