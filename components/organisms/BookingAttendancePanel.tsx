"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useActivateAttendance,
  useCorrectAttendance,
  useRespondAttendance,
  useReviewAttendanceCorrection,
} from "@/features/bookings/use-bookings";
import type {
  AttendanceCorrectionRequest,
  AttendancePayroll,
  AttendanceShift,
  AttendanceStatus,
  Booking,
} from "@/features/bookings/types";
import type { AppRole, ToastFn } from "@/types/supplyed";
import { Btn, Tag } from "../atoms";

type ReasonAction =
  | { kind: "correct"; shiftId: string; status: "PRESENT" | "ABSENT" }
  | { kind: "review"; requestId: string; decision: "APPROVED" | "REJECTED" }
  | null;

export function BookingAttendancePanel({ booking, initialDate, role, toast }: {
  booking: Booking;
  initialDate?: string;
  role: AppRole;
  toast: ToastFn;
}) {
  const shifts = useMemo(() => booking.attendanceShifts ?? [], [booking.attendanceShifts]);
  const byDate = useMemo(() => groupAttendance(shifts), [shifts]);
  const dates = [...byDate.keys()].sort();
  const preferredDate = initialDate && byDate.has(initialDate)
    ? initialDate
    : dates.find((date) => (byDate.get(date) ?? []).some((shift) => shift.notifiedAt)) ?? dates[0];
  const [selectedDate, setSelectedDate] = useState<string>();
  const activeDate = selectedDate && byDate.has(selectedDate) ? selectedDate : preferredDate;
  const selected = activeDate ? byDate.get(activeDate) ?? [] : [];
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null);
  const [reason, setReason] = useState("");
  const [now, setNow] = useState<number>();

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const success = (title: string) => (result: { ok: boolean; message?: string }) => {
    toast({
      title: result.ok ? title : "Attendance was not updated",
      msg: result.message ?? (result.ok ? "The attendance and payment estimate were updated." : "Please try again."),
      tone: result.ok ? "success" : "danger",
    });
    if (result.ok) {
      setReasonAction(null);
      setReason("");
    }
  };
  const activate = useActivateAttendance({ onSuccess: success("Attendance tracking started") });
  const respond = useRespondAttendance({ onSuccess: success("Attendance saved") });
  const correct = useCorrectAttendance({ onSuccess: success("Attendance corrected") });
  const review = useReviewAttendanceCorrection({ onSuccess: success("Correction reviewed") });
  const busy = activate.isPending || respond.isPending || correct.isPending || review.isPending;
  const canManage = role === "institution" || role === "admin";

  if (!shifts.length) {
    return (
      <section className="mt-4 rounded-xl border border-border bg-surface p-4" aria-label="Attendance and payment impact">
        <AttendanceHeader booking={booking} role={role} tracked={false} />
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-border bg-chalk/40 p-5">
            <h4 className="font-semibold text-ink">Attendance records are not active yet</h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {booking.schedule
                ? "This booking was confirmed before per-shift attendance was enabled. Starting now creates records only for unfinished shifts; earlier work and historical payments stay unchanged."
                : "This booking has no structured shift schedule, so per-shift attendance cannot be created."}
            </p>
            {canManage && booking.schedule && (booking.status === "CONFIRMED" || booking.status === "COMPLETED") ? (
              <div className="mt-4">
                <Btn icon="calendar" loading={activate.isPending} loadingLabel="Starting attendance" onClick={() => activate.mutate({ bookingId: booking.id })}>
                  Start attendance tracking
                </Btn>
                <p className="mt-2 text-xs text-muted">Safe for existing bookings: completed historical shifts are not generated.</p>
              </div>
            ) : null}
            {role === "teacher" ? (
              <div className="mt-4 rounded-lg border border-brand/20 bg-brand-tint p-3 text-sm">
                <strong>Teacher view is read-only.</strong>
                <p className="mt-1 text-xs leading-5 text-muted">The school records attendance. You will see the saved result and its payment effect here.</p>
              </div>
            ) : null}
          </div>
          <PaymentImpactSidebar booking={booking} payroll={booking.attendancePayroll ?? null} />
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-4" aria-labelledby={`attendance-${booking.id}`}>
      <AttendanceHeader booking={booking} role={role} tracked />
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {role === "teacher" ? (
            <div className="mb-3 rounded-lg border border-brand/20 bg-brand-tint p-3 text-sm">
              <strong>Read-only attendance</strong>
              <p className="mt-1 text-xs leading-5 text-muted">Your school records attendance. Every saved change and its effect on your expected pay appears here automatically.</p>
            </div>
          ) : (
            <div className="mb-3 rounded-lg border border-brand/20 bg-brand-tint p-3 text-xs leading-5 text-muted">
              <strong className="text-ink">School attendance controls:</strong> Present and Absent buttons unlock after each shift ends. Saving a decision immediately refreshes the payment sidebar.
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Attendance dates">
            {dates.map((date) => {
              const daily = dailySummary(byDate.get(date) ?? []);
              return (
                <button
                  aria-selected={activeDate === date}
                  className={`min-w-36 rounded-lg border p-3 text-left ${activeDate === date ? "border-brand bg-brand-tint ring-2 ring-brand/15" : "border-border bg-chalk/40"}`}
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  role="tab"
                  type="button"
                >
                  <strong className="block text-sm">{dateLabel(date)}</strong>
                  <span className="mt-1 block text-[11px] text-muted">{daily}</span>
                </button>
              );
            })}
          </div>

          {activeDate ? (
            <div className="mt-3 rounded-xl border border-border bg-chalk/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>{dateLabel(activeDate)}</strong>
                  <p className="mt-1 text-xs text-muted">{selected.length} required {selected.length === 1 ? "shift" : "shifts"}</p>
                </div>
                <Tag tone="ghost">{dailySummary(selected)}</Tag>
              </div>
              <div className="mt-3 space-y-3">
                {selected.map((shift, index) => (
                  <AttendanceShiftCard
                    busy={busy}
                    canManage={canManage}
                    index={index}
                    key={shift.id}
                    now={now}
                    shift={shift}
                    onCorrect={(status) => {
                      setReasonAction({ kind: "correct", shiftId: shift.id, status });
                      setReason("");
                    }}
                    onRecord={(status) => respond.mutate({ bookingId: booking.id, shiftId: shift.id, status })}
                    onReview={(correction, decision) => {
                      setReasonAction({ kind: "review", requestId: correction.id, decision });
                      setReason("");
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {reasonAction ? (
            <form className="mt-3 rounded-lg border border-brand/25 bg-brand-tint/40 p-3" onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length < 3) return;
              if (reasonAction.kind === "correct") {
                correct.mutate({ bookingId: booking.id, shiftId: reasonAction.shiftId, status: reasonAction.status, reason });
              } else {
                review.mutate({ bookingId: booking.id, requestId: reasonAction.requestId, decision: reasonAction.decision, reason });
              }
            }}>
              <label className="text-xs font-semibold" htmlFor={`attendance-reason-${booking.id}`}>Required correction reason</label>
              <textarea
                className="input mt-2 min-h-24"
                id={`attendance-reason-${booking.id}`}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Record the evidence and reason for changing this attendance"
                value={reason}
              />
              <div className="mt-2 flex justify-end gap-2">
                <Btn disabled={busy} size="sm" variant="ghost" onClick={() => { setReasonAction(null); setReason(""); }} type="button">Cancel</Btn>
                <Btn disabled={reason.trim().length < 3} loading={busy} loadingLabel="Saving" size="sm" type="submit">Save correction</Btn>
              </div>
            </form>
          ) : null}
        </div>
        <PaymentImpactSidebar booking={booking} payroll={booking.attendancePayroll ?? null} />
      </div>

      {(booking.attendanceAdjustments ?? []).length ? (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning-tint p-3 text-sm">
          <strong>Post-payment attendance adjustments</strong>
          <p className="mt-1 text-xs text-muted">Paid invoices were not changed. These amounts require separate review or supplemental settlement.</p>
          <ul className="mt-2 space-y-1 text-xs">
            {booking.attendanceAdjustments.map((adjustment) => (
              <li key={adjustment.id}>{money(adjustment.amountPence, booking.currency)} · {adjustment.reason} · {adjustment.status === "SETTLED" ? "Settled" : "Pending review"}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function AttendanceHeader({ booking, role, tracked }: { booking: Booking; role: AppRole; tracked: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-heading text-lg" id={`attendance-${booking.id}`}>Attendance &amp; live payment impact</h3>
        <p className="mt-1 text-xs leading-5 text-muted">Every dated shift feeds the payable, held, and excluded amounts shown alongside it.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Tag tone={tracked ? "green" : "amber"}>{tracked ? "Tracking active" : "Setup required"}</Tag>
        <Tag tone="ghost">{role === "teacher" ? "Teacher · read-only" : "School managed"}</Tag>
      </div>
    </div>
  );
}

function AttendanceShiftCard({ busy, canManage, index, now, onCorrect, onRecord, onReview, shift }: {
  busy: boolean;
  canManage: boolean;
  index: number;
  now?: number;
  onCorrect: (status: "PRESENT" | "ABSENT") => void;
  onRecord: (status: "PRESENT" | "ABSENT") => void;
  onReview: (request: AttendanceCorrectionRequest, decision: "APPROVED" | "REJECTED") => void;
  shift: AttendanceShift;
}) {
  const ended = now !== undefined && Date.parse(shift.scheduledEnd) <= now;
  const awaiting = shift.status === "AWAITING_CONFIRMATION";
  const pendingRequest = shift.correctionRequests.find((item) => item.status === "PENDING");
  const action = (status: "PRESENT" | "ABSENT") => awaiting ? onRecord(status) : onCorrect(status);

  return (
    <article className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><strong className="text-sm">Shift {index + 1}</strong><div className="mt-1 text-sm font-semibold text-brand">{timeRange(shift.scheduledStart, shift.scheduledEnd, shift.timeZone)}</div></div>
        <AttendanceTag status={shift.status} source={shift.decisionSource} />
      </div>
      <div className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
        <span>School reminder: {shift.notifiedAt ? dateTime(shift.notifiedAt, shift.timeZone) : ended ? "Being prepared" : "After the final shift that day"}</span>
        <span>Response deadline: {shift.responseDeadline ? dateTime(shift.responseDeadline, shift.timeZone) : "Not open yet"}</span>
      </div>
      {shift.reason ? <p className="mt-2 rounded bg-chalk p-2 text-xs"><strong>Recorded reason:</strong> {shift.reason}</p> : null}

      {canManage ? (
        <div className="mt-3 rounded-lg border border-border bg-chalk/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold">School attendance</span>
            {!ended ? <span className="text-[11px] text-muted">Available after this shift ends</span> : !awaiting ? <span className="text-[11px] text-muted">Changing a saved result requires a reason</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn disabled={busy || !ended || shift.status === "PRESENT"} size="sm" onClick={() => action("PRESENT")}>{awaiting ? "Mark present" : "Change to present"}</Btn>
            <Btn disabled={busy || !ended || shift.status === "ABSENT"} size="sm" variant="danger" onClick={() => action("ABSENT")}>{awaiting ? "Mark absent" : "Change to absent"}</Btn>
          </div>
        </div>
      ) : null}

      {canManage && pendingRequest ? (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning-tint p-3 text-xs">
          <strong>Existing teacher correction request: {statusLabel(pendingRequest.requestedStatus)}</strong>
          <p className="mt-1">{pendingRequest.reason}</p>
          <div className="mt-2 flex gap-2">
            <Btn disabled={busy} size="sm" onClick={() => onReview(pendingRequest, "APPROVED")}>Approve</Btn>
            <Btn disabled={busy} size="sm" variant="danger" onClick={() => onReview(pendingRequest, "REJECTED")}>Reject</Btn>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PaymentImpactSidebar({ booking, payroll }: { booking: Booking; payroll: AttendancePayroll | null }) {
  const currency = payroll?.currency ?? booking.currency ?? "GBP";
  const estimated = payroll?.estimatedAmountPence ?? estimatedBookingPence(booking);
  const payable = payroll?.payableAmountPence ?? 0;
  const pending = payroll?.pendingAmountPence ?? estimated;
  const excluded = payroll?.excludedAmountPence ?? 0;
  const cycle = paymentFrequencyLabel(booking.paymentFrequency);

  return (
    <aside className="self-start rounded-xl border border-brand/25 bg-brand-tint/30 p-4 xl:sticky xl:top-4" aria-label="Live payment impact">
      <div className="flex items-start justify-between gap-2">
        <div><h4 className="font-heading text-base">Live payment impact</h4><p className="mt-1 text-xs text-muted">Release cycle: <strong className="text-ink">{cycle}</strong></p></div>
        <Tag tone="green">Live</Tag>
      </div>
      <p className="mt-3 rounded-lg border border-brand/15 bg-surface p-3 text-xs leading-5 text-muted">{pricingRule(booking.payType)} Saved attendance recalculates these figures immediately; pending work remains held, not lost.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <PayrollMetric label="Scheduled value" value={money(estimated, currency)} />
        <PayrollMetric label="Payable now" value={money(payable, currency)} tone="payable" />
        <PayrollMetric label="Pending / held" value={money(pending, currency)} tone="pending" />
        <PayrollMetric label="Excluded" value={money(excluded, currency)} tone="excluded" />
      </div>
      <div className="mt-3 rounded-lg border border-border bg-surface p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Current calculation</div>
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
          <strong>{money(estimated, currency)}</strong><span className="text-muted">scheduled −</span><strong className="text-danger">{money(excluded, currency)}</strong><span className="text-muted">excluded −</span><strong className="text-warning">{money(pending, currency)}</strong><span className="text-muted">held =</span><strong className="text-brand">{money(payable, currency)}</strong>
        </div>
      </div>
      <div className="mt-4">
        <h5 className="text-sm font-semibold">How {cycle.toLowerCase()} release works</h5>
        <ol className="mt-2 space-y-2 text-xs leading-5 text-muted">
          <li><strong className="text-ink">1.</strong> {cycleRule(booking.paymentFrequency)}</li>
          <li><strong className="text-ink">2.</strong> Present work becomes payable; unanswered work stays pending.</li>
          <li><strong className="text-ink">3.</strong> Absent work is excluded only from its own shift/day calculation.</li>
        </ol>
      </div>

      {payroll?.periods.length ? (
        <div className="mt-4 border-t border-brand/15 pt-3">
          <h5 className="text-sm font-semibold">Payment periods</h5>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {payroll.periods.map((period) => (
              <div className="rounded-lg border border-border bg-surface p-3" key={period.key}>
                <div className="flex items-start justify-between gap-2"><strong className="text-xs">{period.label}</strong><PeriodState period={period} /></div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                  <PeriodAmount label="Payable" value={money(period.payableAmountPence, currency)} />
                  <PeriodAmount label="Held" value={money(period.pendingAmountPence, currency)} />
                  <PeriodAmount label="Excluded" value={money(period.excludedAmountPence, currency)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs leading-5 text-muted">Start attendance tracking to see the actual {cycle.toLowerCase()} periods and how each saved shift changes them.</p>}

      {payroll?.exclusions.length ? (
        <div className="mt-4 border-t border-danger/20 pt-3 text-xs">
          <strong>Why money is excluded or held</strong>
          <ul className="mt-2 space-y-2">
            {payroll.exclusions.map((item, index) => <li className="rounded bg-danger-tint p-2" key={`${item.shiftId ?? item.date}-${index}`}>{dateLabel(item.date)} · {money(item.amountPence, currency)}<br /><span className="text-muted">{item.reason}</span></li>)}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function PayrollMetric({ label, tone, value }: { label: string; tone?: "payable" | "pending" | "excluded"; value: string }) {
  const colour = tone === "payable" ? "text-brand" : tone === "pending" ? "text-warning" : tone === "excluded" ? "text-danger" : "text-ink";
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="text-[11px] text-muted">{label}</div><strong className={`mt-1 block ${colour}`}>{value}</strong></div>;
}

function PeriodAmount({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-muted">{label}</span><strong className="mt-0.5 block text-ink">{value}</strong></div>;
}

function PeriodState({ period }: { period: AttendancePayroll["periods"][number] }) {
  if (period.reviewAmountPence) return <Tag tone="amber">Review</Tag>;
  if (period.pendingAmountPence) return <Tag tone="amber">Pending</Tag>;
  if (period.payableAmountPence) return <Tag tone="green">Ready</Tag>;
  return <Tag tone="red">Excluded</Tag>;
}

function AttendanceTag({ source, status }: { source?: string | null; status: AttendanceStatus }) {
  const noResponse = source === "SYSTEM_NO_RESPONSE";
  return <Tag tone={status === "PRESENT" ? "green" : status === "ABSENT" ? "red" : "amber"}>{noResponse ? "Absent — no response" : statusLabel(status)}</Tag>;
}

function groupAttendance(shifts: AttendanceShift[]) {
  const groups = new Map<string, AttendanceShift[]>();
  for (const shift of shifts) {
    const date = shift.workDate.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), shift]);
  }
  return groups;
}

function dailySummary(shifts: AttendanceShift[]) {
  const present = shifts.filter((shift) => shift.status === "PRESENT").length;
  const absent = shifts.filter((shift) => shift.status === "ABSENT").length;
  const pending = shifts.length - present - absent;
  return `${present} present · ${absent} absent · ${pending} awaiting`;
}

function estimatedBookingPence(booking: Booking) {
  const rate = Math.round(Number(booking.payAmount ?? 0) * 100);
  if (booking.payType === "fixed") return rate;
  if (booking.payType === "daily") return rate * Math.max(0, booking.days ?? 0);
  return Math.round((rate * Math.max(0, booking.scheduledMinutes ?? 0)) / 60);
}

function pricingRule(payType?: string | null) {
  if (payType === "daily") return "A full daily rate is payable when all required shifts for that day are present; mixed days are held for review.";
  if (payType === "fixed") return "All-absent attendance has no payment due. Mixed attendance needs review before the fixed contract amount is collected. Completed work with no attendance decisions uses the agreed total.";
  return "Hourly pay is calculated from the exact minutes of shifts marked present.";
}

function cycleRule(value?: string | null) {
  if (value === "daily") return "Each workday is its own release period after that day's shifts are decided.";
  if (value === "weekly") return "Work is grouped into weekly periods using the booking's agreed period anchor.";
  if (value === "monthly") return "Work is grouped by the agreed monthly period; unresolved shifts remain held inside that month.";
  if (value === "hourly") return "Each finalized shift contributes its present minutes to the next payment calculation.";
  if (value === "milestone") return "The fixed amount follows the agreed milestone process and is not reduced automatically.";
  return "The agreed amount becomes releasable when the completed booking and attendance are finalized.";
}

function statusLabel(status: AttendanceStatus) {
  return status === "AWAITING_CONFIRMATION" ? "Awaiting attendance" : status[0] + status.slice(1).toLowerCase();
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function dateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function timeRange(start: string, end: string, timeZone: string) {
  const format = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone });
  return `${format.format(new Date(start))}–${format.format(new Date(end))}`;
}

function paymentFrequencyLabel(value?: string | null) {
  if (value === "completion") return "On completion";
  if (value === "milestone") return "Milestone";
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "Agreed booking cycle";
}

function money(pence: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(pence / 100);
}
