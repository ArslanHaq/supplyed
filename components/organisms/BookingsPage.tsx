"use client";
import { scheduleIntervals } from "@/features/jobs/job-schedule";
import { formatPlannedUnits } from "@/features/jobs/work-units";

import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";

import { DynamicSelect } from "@/components/molecules/DynamicDropdown";


import { WorkspaceEmptyState } from "./WorkspacePanels";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Booking, BookingInvoiceFilter, BookingListQuery, BookingStatus } from "@/features/bookings/types";
import { bookingDays, invoiceUnitsLimit } from "@/features/bookings/schemas";
import { useBooking, useBookings, useCreateBookingReview, useSyncBookingPayment, useUpdateBookingStatus } from "@/features/bookings/use-bookings";
import { automaticPaymentPhase, canPayBookingManually, requiresCardAuthentication } from "@/features/payments/payment-status";
import { formatPence } from "@/features/payments/schemas";
import { useCreateBookingTipCheckout, useInvoice, useSchoolBillingSettings, useSyncBookingTip } from "@/features/payments/use-payments";
import type { AppRole, RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Field, Icon, Tag } from "../atoms";
import { Modal, PageHead, SectionLoader } from "../molecules";
import { PaymentReleaseSchedule } from "./PaymentReleaseSchedule";
import { BookingManualPayment } from "./BookingManualPayment";
import { InvoiceDetailsModal } from "./InvoiceDetailsModal";
import { BookingAttendancePanel } from "./BookingAttendancePanel";

type Tab = "active" | "all" | "cancelled" | "completed" | "no-show";

const tabStatus: Record<Tab, BookingStatus | undefined> = {
  active: "CONFIRMED",
  all: undefined,
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  "no-show": "NO_SHOW",
};


type BookingFilters = Pick<BookingListQuery, "from" | "invoice" | "search" | "to">;

const emptyFilters: BookingFilters = { from: "", invoice: undefined, search: "", to: "" };

export function BookingsPage({ go, role, toast, ctx }: Pick<RouteProps, "go" | "role" | "toast"> & { ctx?: RouteProps["ctx"] }) {
  const choices = useDropdown("bookingStatus");
  const tabs: Array<{ label: string; value: Tab }> = [{ label: "All", value: "all" }, ...(choices.data?.options ?? []).flatMap(option => { const value = (Object.keys(tabStatus) as Tab[]).find(key => tabStatus[key] === option.value); return value ? [{ label: option.label, value }] : []; })];
  const [tab, setTab] = useState<Tab>(ctx?.jobId ? "all" : "active");
  const [page, setPage] = useState(1);
  const [filterDraft, setFilterDraft] = useState<BookingFilters>(emptyFilters);
  const [filters, setFilters] = useState<BookingFilters>(emptyFilters);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [invoiceDetailsId, setInvoiceDetailsId] = useState<string | null>(null);
  const [tipTarget, setTipTarget] = useState<Booking | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const listQuery = useBookings({ jobId: ctx?.jobId, limit: 20, page, status: tabStatus[tab], ...filters }, !ctx?.bookingId);
  const detailQuery = useBooking(ctx?.bookingId);
  const bookingsQuery = ctx?.bookingId ? { ...detailQuery, data: detailQuery.data ? { bookings: [detailQuery.data], pagination: { total: 1, totalPages: 1, page: 1, hasNextPage: false, limit: 1 } } : undefined } : listQuery;
  const bookings = bookingsQuery.data?.bookings ?? [];
  const updateBooking = useUpdateBookingStatus({
    onSuccess: (result) => {
      toast({
        title: result.ok ? "Booking updated" : "Could not update booking",
        msg: result.message ?? "The booking was updated.",
        tone: result.ok ? "success" : "danger",
      });
      if (result.ok) {
        setCancelTarget(null);
        setTab("all");
        setPage(1);
      }
    },
  });
  const createReview = useCreateBookingReview({
    onSuccess: (result) => {
      toast({
        title: result.ok ? "Review submitted" : "Could not submit review",
        msg: result.message ?? "Your review was saved.",
        tone: result.ok ? "success" : "danger",
      });
      if (result.ok) setReviewTarget(null);
    },
  });

  const createTip = useCreateBookingTipCheckout({
    onError: () => setTipError("The tip checkout could not be opened. Please try again."),
    onSuccess: (result) => {
      if (!result.ok) {
        setTipError(result.message);
        return;
      }
      window.location.assign(result.data.url);
    },
  });
  useBookingTipReturn(toast);

  const subtitle = role === "teacher"
    ? "Your active and completed placements with schools."
    : "Your school bookings, confirmations, and completed placements.";

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filterDraft.from && filterDraft.to && filterDraft.from > filterDraft.to) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }

    setFilterError(null);
    setFilters({
      from: filterDraft.from || undefined,
      invoice: filterDraft.invoice,
      search: filterDraft.search?.trim() || undefined,
      to: filterDraft.to || undefined,
    });
    setPage(1);
  }

  function clearFilters() {
    setFilterDraft(emptyFilters);
    setFilters(emptyFilters);
    setFilterError(null);
    setPage(1);
  }

  return (
    <>
      <div className="app-page bookings-page">
        <PageHead
          title={ctx?.bookingId ? "Booking details" : "Bookings"}
          subtitle={subtitle}
          actions={<><Tag tone="ghost">{bookingsQuery.data?.pagination.total ?? 0} bookings</Tag><Btn loading={bookingsQuery.isFetching} loadingLabel="Refreshing" size="sm" variant="ghost" onClick={() => { void bookingsQuery.refetch(); }}>Refresh</Btn></>}
        />

        {ctx?.bookingId ? <div className="mb-5"><Btn icon="arrowLeft" variant="secondary" onClick={() => go("bookings")}>All bookings</Btn></div> : <><div className="workspace-toolbar card card-pad mb-6 flex flex-wrap items-center gap-3">
          {ctx?.jobId ? <><Tag tone="ghost">Bookings for this job</Tag><Btn size="sm" variant="ghost" onClick={() => go("bookings")}>Show all jobs</Btn></> : null}
          <DropdownStatus name="bookingStatus" />
          {tabs.map((item) => (
            <Btn
              key={item.value}
              aria-pressed={tab === item.value}
              size="sm"
              variant={tab === item.value ? "secondary" : "ghost"}
              onClick={() => { setTab(item.value); setPage(1); }}
            >
              {item.label}
            </Btn>
          ))}
        </div>

        <form className="workspace-filter-panel card card-pad mb-6" onSubmit={applyFilters}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block text-xs font-semibold text-graphite">
              Search
              <input
                className="input mt-2"
                maxLength={100}
                placeholder="Job, teacher, or school"
                type="search"
                value={filterDraft.search ?? ""}
                onChange={(event) => setFilterDraft((current) => ({ ...current, search: event.target.value }))}
              />
            </label>
            <label className="block text-xs font-semibold text-graphite">
              From
              <input className="input mt-2" type="date" value={filterDraft.from ?? ""} onChange={(event) => setFilterDraft((current) => ({ ...current, from: event.target.value }))} />
            </label>
            <label className="block text-xs font-semibold text-graphite">
              To
              <input className="input mt-2" min={filterDraft.from || undefined} type="date" value={filterDraft.to ?? ""} onChange={(event) => setFilterDraft((current) => ({ ...current, to: event.target.value }))} />
            </label>
            <div className="text-xs font-semibold text-graphite">
              <label htmlFor="booking-invoice-filter">Invoice</label>
              <DynamicSelect aria-label="Invoice" className="mt-2" id="booking-invoice-filter" collection="bookingInvoiceState" emptyLabel="Any invoice state" placeholder="Any invoice state" value={filterDraft.invoice ?? ""} onChange={(value) => setFilterDraft((current) => ({ ...current, invoice: (value || undefined) as BookingInvoiceFilter | undefined }))} />
            </div>
          </div>
          {filterError ? <p className="mt-3 text-sm font-medium text-danger" role="alert">{filterError}</p> : null}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Btn size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Btn>
            <Btn size="sm" type="submit">Apply filters</Btn>
          </div>
        </form></>}

        {bookingsQuery.isLoading ? <SectionLoader rows={4} /> : null}
        {bookingsQuery.error && !bookingsQuery.isLoading ? (
          <EmptyState title="Bookings unavailable" message={bookingsQuery.error.message || "Refresh the page and try again."} />
        ) : null}
        {!bookingsQuery.isLoading && !bookingsQuery.error && bookings.length === 0 ? (
          <EmptyState title="No bookings here yet" message={emptyMessage(tab, role)} />
        ) : null}

        {!bookingsQuery.isLoading && !bookingsQuery.error && bookings.length > 0 ? (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                attendanceDate={ctx?.attendanceDate}
                cancelling={updateBooking.isPending && cancelTarget?.id === booking.id}
                onCancel={setCancelTarget}
                onComplete={(id) => updateBooking.mutate({ action: "complete", id })}
                onInvoiceDetails={setInvoiceDetailsId}
                onMessage={(selectedBooking) => go("messaging", { bookingId: selectedBooking.id })}
                onOpenAttendance={(selectedBooking) => go("bookings", { bookingId: selectedBooking.id })}
                onOpenJob={(selectedBooking) => go("job-detail", { bookingId: selectedBooking.id, jobId: selectedBooking.job.id })}
                onOpenProfile={(selectedBooking) => role === "teacher"
                  ? go("institution-profile", { institutionId: selectedBooking.institution.id })
                  : go("teacher-profile", { teacherId: selectedBooking.instructor.id })}
                onTip={(selectedBooking) => { setTipError(null); setTipTarget(selectedBooking); }}
                onNoShow={(id) => updateBooking.mutate({ action: "no-show", id })}
                onReview={setReviewTarget}
                pending={updateBooking.isPending}
                role={role}
                showAttendance={Boolean(ctx?.bookingId)}
                toast={toast}
              />
            ))}
          </div>
        ) : null}
        {bookingsQuery.data && bookingsQuery.data.pagination.totalPages > 1 ? (
          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <Btn disabled={page <= 1 || bookingsQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage(page - 1)}>Previous</Btn>
            <span className="text-muted">Page {page} of {bookingsQuery.data.pagination.totalPages}</span>
            <Btn disabled={!bookingsQuery.data.pagination.hasNextPage || bookingsQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage(page + 1)}>Next</Btn>
          </div>
        ) : null}
      </div>

      <CancelBookingModal
        booking={cancelTarget}
        loading={updateBooking.isPending}
        onClose={() => {
          if (!updateBooking.isPending) setCancelTarget(null);
        }}
        onSubmit={(reason) => {
          if (cancelTarget) updateBooking.mutate({ action: "cancel", id: cancelTarget.id, reason });
        }}
      />

      <InvoiceDetailsModal
        id={invoiceDetailsId}
        onClose={() => setInvoiceDetailsId(null)}
        role={role}
      />

      <TipBookingModal
        key={`tip-${tipTarget?.id ?? "none"}`}
        booking={tipTarget}
        error={tipError}
        loading={createTip.isPending}
        onClose={() => { if (!createTip.isPending) setTipTarget(null); }}
        onSubmit={(amountPence) => { if (tipTarget) createTip.mutate({ bookingId: tipTarget.id, amountPence }); }}
      />

      <ReviewBookingModal
        booking={reviewTarget}
        loading={createReview.isPending}
        onClose={() => {
          if (!createReview.isPending) setReviewTarget(null);
        }}
        onSubmit={(rating, comment) => {
          if (reviewTarget) createReview.mutate({ bookingId: reviewTarget.id, comment, rating });
        }}
        role={role}
      />
    </>
  );
}

function BookingCard({
  booking,
  attendanceDate,
  cancelling,
  onCancel,
  onComplete,
  onInvoiceDetails,
  onMessage,
  onNoShow,
  onOpenAttendance,
  onOpenProfile,
  onOpenJob,
  onTip,
  onReview,
  pending,
  role,
  showAttendance,
  toast,
}: {
  booking: Booking;
  attendanceDate?: string;
  cancelling: boolean;
  onCancel: (booking: Booking) => void;
  onComplete: (id: string) => void;
  onInvoiceDetails: (id: string) => void;
  onMessage: (booking: Booking) => void;
  onNoShow: (id: string) => void;
  onOpenAttendance: (booking: Booking) => void;
  onOpenProfile: (booking: Booking) => void;
  onOpenJob: (booking: Booking) => void;
  onTip: (booking: Booking) => void;
  onReview: (booking: Booking) => void;
  pending: boolean;
  role: AppRole;
  showAttendance: boolean;
  toast: RouteProps["toast"];
}) {
  const otherParty = role === "teacher"
    ? { id: booking.institution.id, imageUrl: booking.institution.imageUrl, name: booking.institution.name ?? "School" }
    : { id: booking.instructor.id, imageUrl: booking.instructor.imageUrl, name: booking.instructor.fullName ?? "Teacher" };
  const ownReview = booking.reviews.find((review) => review.reviewerType === reviewerType(role));
  const reviewable = isReviewableBookingStatus(booking.status);
  const canReview = reviewable && !ownReview;
  const address = [booking.job.address, booking.job.city, booking.job.county, booking.job.postalCode]
    .map(part => part?.trim()).filter(Boolean).join(", ") || "Address not provided";

  return (
    <article className="booking-card booking-placement card">
      <header className="booking-placement-header">
        <div className="booking-placement-identity">
          <Avatar name={otherParty.name} src={otherParty.imageUrl} size="lg" />
          <div className="min-w-0">
            <button className="booking-placement-party" disabled={!otherParty.id} onClick={() => onOpenProfile(booking)} type="button">{otherParty.name}<Icon name="arrowRight" size={13} /></button>
            <h2>{booking.job.title}</h2>
          </div>
        </div>
        <div className="booking-placement-badges"><BookingStatusTag status={booking.status} />{booking.source === "DIRECT_HIRE" ? <span className="booking-placement-source">Direct hire</span> : null}</div>
      </header>

      <div className="booking-placement-overview">
        <Detail icon="calendar" label="Placement dates" value={formatDateRange(booking.startDate, booking.endDate)} />
        <Detail icon="pound" label="Agreed rate" value={formatPay(booking.payAmount, booking.payType)} />
        {booking.hours != null || booking.days != null ? <Detail icon="clock" label="Planned work" value={formatPlannedUnits(booking)} /> : null}
      </div>
      <BookingWorkSchedule booking={booking} />
      {showAttendance ? <BookingAttendancePanel booking={booking} initialDate={attendanceDate} role={role} toast={toast} /> : null}
      <div className="booking-placement-location"><Icon name="pin" size={17} /><div><span className="booking-placement-label">Location</span><p>{address}</p></div></div>
      {booking.job.parkingInfo ? <details className="booking-placement-arrival"><summary>Parking &amp; arrival instructions</summary><p>{booking.job.parkingInfo}</p></details> : null}

      {booking.cancelReason ? <p className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{booking.cancelReason}</p> : null}

      {booking.status === "COMPLETED" || booking.invoice || booking.automaticPayment ? <InvoiceStrip booking={booking} onInvoiceDetails={onInvoiceDetails} role={role} /> : (
        booking.status === "CONFIRMED" ? <p className="booking-placement-payment"><Icon name="pound" size={14} />Attendance-backed payment periods are invoiced as they close. Automatic collection is used when the school has enabled it.</p> : null
      )}
      <PaymentReleaseSchedule booking={booking} />
      {booking.status === "COMPLETED" ? <BookingTipPanel booking={booking} onTip={onTip} role={role} /> : null}

      <footer className="booking-placement-footer">
        <div className="text-xs text-muted">
          {reviewable
            ? ownReview
              ? `Reviewed with ${ownReview.rating}/5`
              : `${formatClosedStatus(booking.status)} booking — optional ${role === "teacher" ? "school" : "teacher"} review available`
            : booking.status === "CONFIRMED"
              ? "Confirmed placement"
              : "Booking closed"}
        </div>

        <div className="flex flex-wrap gap-2">
          {!showAttendance ? <Btn icon="calendar" size="sm" onClick={() => onOpenAttendance(booking)}>View schedule &amp; attendance</Btn> : null}
          <Btn icon="file" size="sm" variant="secondary" onClick={() => onOpenJob(booking)}>View job details</Btn>
          <Btn icon="message" size="sm" variant={canReview ? "secondary" : "primary"} onClick={() => onMessage(booking)}>
            Message {role === "teacher" ? "school" : "teacher"}
          </Btn>
          {booking.status === "CONFIRMED" && role === "institution" ? (
            <>
              <Btn disabled={pending} size="sm" variant="secondary" onClick={() => onComplete(booking.id)}>Complete</Btn>
              <Btn disabled={pending} size="sm" variant="danger" onClick={() => onNoShow(booking.id)}>No-show</Btn>
            </>
          ) : null}
          {booking.status === "CONFIRMED" ? (
            <Btn disabled={pending} loading={cancelling} loadingLabel="Cancelling" size="sm" variant="ghost" className="booking-placement-cancel" onClick={() => onCancel(booking)}>Cancel booking</Btn>
          ) : null}
          {canReview ? (
            <Btn icon="star" size="sm" onClick={() => onReview(booking)}>Review {role === "teacher" ? "school" : "teacher"}</Btn>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function BookingWorkSchedule({ booking }: { booking: Booking }) {
  if (!booking.schedule) {
    return (
      <div className="mt-4 rounded-xl border border-warning/40 bg-warning-tint p-4 text-sm leading-6">
        <div className="flex items-center gap-2 font-semibold text-ink"><Icon name="clock" size={17} />Booked work schedule</div>
        <p className="mt-1 text-muted">Exact shift times were not recorded for this legacy booking. Confirm the working hours in the job details or with the other party.</p>
      </div>
    );
  }

  const weekdays = [...booking.schedule.weekdays].sort((left, right) => ((left.day + 6) % 7) - ((right.day + 6) % 7));
  const intervals = booking.startDate && booking.endDate
    ? scheduleIntervals(booking.schedule, booking.startDate, booking.endDate)
    : [];
  const agenda = groupBookingShifts(intervals);
  const exceptions = booking.schedule.exceptions ?? [];
  const totalMinutes = booking.scheduledMinutes ?? intervals.reduce((sum, shift) => sum + shift.minutes, 0);
  const progress = bookingScheduleProgress(agenda, booking.startDate, booking.endDate, booking.timeZone || "Europe/London");

  return (
    <section className="mt-4 rounded-xl border border-brand/20 bg-brand-tint/40 p-4" aria-label="Booked work schedule">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-ink"><Icon name="clock" size={17} />Booked work schedule</div>
          <p className="mt-1 text-xs leading-5 text-muted">These times were saved when the booking was confirmed and do not change if the job is edited later.</p>
        </div>
        <span className="rounded-full border border-brand/30 bg-surface px-2.5 py-1 text-xs font-semibold text-brand">{booking.timeZone || "Europe/London"}</span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {weekdays.map((weekday) => (
          <div className="rounded-lg border border-border bg-surface p-3" key={weekday.day}>
            <strong className="text-sm">{WEEKDAY_NAMES[weekday.day]}</strong>
            <div className="mt-2 space-y-1.5">
              {weekday.slots.map((slot, index) => (
                <div className="flex items-center justify-between gap-3 text-xs" key={`${slot.start}-${slot.end}-${index}`}>
                  <span className="font-semibold text-muted">Shift {index + 1}</span>
                  <span className="font-semibold text-ink">{bookingShiftLabel(slot.start, slot.end)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {exceptions.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Date-specific changes</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {exceptions.map((exception) => (
              <div className="rounded-lg border border-border bg-surface p-3 text-xs" key={exception.date}>
                <div className="flex items-center justify-between gap-3"><strong>{bookingDateLabel(exception.date)}</strong><Tag tone={exception.kind === "exclude" ? "amber" : "purple"}>{exception.kind === "exclude" ? "No work" : exception.kind === "replace" ? "Changed shifts" : "Extra shifts"}</Tag></div>
                {exception.kind !== "exclude" ? <div className="mt-2 space-y-1">{(exception.slots ?? []).map((slot, index) => <div className="flex justify-between gap-3" key={`${slot.start}-${slot.end}-${index}`}><span className="text-muted">Shift {index + 1}</span><strong>{bookingShiftLabel(slot.start, slot.end)}</strong></div>)}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-brand/15 pt-3 lg:grid-cols-4">
        <BookingScheduleMetric label="Total placement span" value={`${progress.totalCalendarDays} calendar days`} />
        <BookingScheduleMetric label="Scheduled work" value={`${agenda.size} working days`} />
        <BookingScheduleMetric label="Remaining from today" value={`${progress.remainingWorkingDays} working days`} />
        <BookingScheduleMetric label="Time remaining" value={progress.timeRemainingLabel} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted"><span><strong className="text-ink">{bookingHoursLabel(totalMinutes)}</strong> total booked time</span><span><strong className="text-ink">{weekdays.reduce((sum, weekday) => sum + weekday.slots.length, 0)}</strong> recurring {weekdays.reduce((sum, weekday) => sum + weekday.slots.length, 0) === 1 ? "shift" : "shifts"} per week</span><span>Calculated for today in {booking.timeZone || "Europe/London"}</span></div>

      {agenda.size ? (
        <details className="mt-3 rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">View complete dated shift agenda</summary>
          <div className="max-h-80 space-y-2 overflow-y-auto border-t border-border p-3">
            {[...agenda.entries()].map(([date, shifts]) => (
              <div className="flex flex-col gap-2 rounded-lg bg-chalk/60 p-3 text-xs sm:flex-row sm:items-start sm:justify-between" key={date}>
                <strong>{bookingDateLabel(date)}</strong>
                <div className="space-y-1 text-right">{shifts.map((shift, index) => <div key={`${shift.start}-${shift.end}-${index}`}><span className="mr-2 text-muted">Shift {index + 1}</span><b>{bookingShiftLabel(shift.start, shift.end)}</b></div>)}</div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function groupBookingShifts(shifts: Array<{ date: string; start: string; end: string; minutes: number }>) {
  const grouped = new Map<string, typeof shifts>();
  for (const shift of shifts) grouped.set(shift.date, [...(grouped.get(shift.date) ?? []), shift]);
  return grouped;
}

function BookingScheduleMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="text-[11px] leading-4 text-muted">{label}</div><strong className="mt-1 block text-sm text-ink">{value}</strong></div>;
}

function bookingScheduleProgress(
  agenda: Map<string, Array<{ date: string; start: string; end: string; minutes: number }>>,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  timeZone: string,
) {
  const start = startDate ? bookingLocalDate(startDate, timeZone) : null;
  const end = endDate ? bookingLocalDate(endDate, timeZone) : null;
  const today = bookingLocalDate(new Date().toISOString(), timeZone);
  const totalCalendarDays = start && end ? calendarDayDifference(start, end) + 1 : 0;
  const remainingWorkingDays = [...agenda.keys()].filter((date) => date >= today).length;
  const timeRemainingLabel = !start || !end
    ? "Dates unavailable"
    : today < start
      ? `Starts in ${calendarDayDifference(today, start)} days`
      : today > end
        ? "Placement ended"
        : `${calendarDayDifference(today, end)} days until end`;
  return { remainingWorkingDays, timeRemainingLabel, totalCalendarDays };
}

function bookingLocalDate(value: string, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", timeZone, year: "numeric" }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function calendarDayDifference(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000));
}

function bookingShiftLabel(start: string, end: string) {
  return `${bookingClockLabel(start)}–${bookingClockLabel(end)}${end <= start ? " next day" : ""}`;
}

function bookingClockLabel(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

function bookingDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function bookingHoursLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours ? `${hours}h ` : ""}${remainder}m` : `${hours}h`;
}

/** Latest payment state for a booking: recurring automatic periods or a manual invoice. */
function InvoiceStrip({ booking, onInvoiceDetails, role }: { booking: Booking; onInvoiceDetails: (id: string) => void; role: AppRole }) {
  const billingSettings = useSchoolBillingSettings({ enabled: role === "institution" });
  const bookingInvoice = booking.invoice;
  const invoiceDetail = useInvoice(bookingInvoice?.status === "PENDING" ? null : bookingInvoice?.id ?? null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const paymentSync = useSyncBookingPayment({
    onError: () => setPaymentError("Payment status could not be checked. Please try again."),
    onSuccess: (result) => setPaymentError(result.ok ? null : result.message),
  });
  const latestInvoice = invoiceDetail.data;
  const invoice = bookingInvoice && latestInvoice?.id === bookingInvoice.id
    ? {
        ...bookingInvoice,
        dueAt: latestInvoice.dueAt,
        hostedInvoiceUrl: latestInvoice.hostedInvoiceUrl,
        paidAt: latestInvoice.paidAt,
        status: latestInvoice.status,
        totalAmountPence: latestInvoice.totalAmountPence,
      }
    : bookingInvoice;
  const automatic = (latestInvoice?.collectionMethod ?? bookingInvoice?.collectionMethod) === "charge_automatically";
  const failure = invoice?.status === "OPEN" ? (latestInvoice?.lastPaymentFailureMessage ?? bookingInvoice?.lastPaymentFailureMessage) : null;
  const cardApprovalRequired = invoice?.status === "OPEN" && requiresCardAuthentication(latestInvoice?.lastPaymentFailureCode ?? bookingInvoice?.lastPaymentFailureCode);
  const period = latestInvoice?.billingPeriodLabel ?? bookingInvoice?.billingPeriodLabel;
  const nextAttempt = latestInvoice?.nextPaymentAttemptAt ?? bookingInvoice?.nextPaymentAttemptAt;
  const paymentPhase = automatic && invoice
    ? automaticPaymentPhase({
        failureMessage: failure,
        nextAttemptAt: nextAttempt,
        paymentAttemptCount: latestInvoice?.paymentAttemptCount ?? bookingInvoice?.paymentAttemptCount ?? 0,
        status: invoice.status,
      })
    : null;
  let label: string;
  let tag: { text: string; tone: "amber" | "green" | "red" | "ghost" } | null = null;

  if (!invoice) {
    const payment = booking.automaticPayment;
    label = payment?.state === "REVIEW_REQUIRED"
      ? "Automatic payment is not scheduled for this booking."
      : payment?.message ?? "Checking automatic payment status.";
    tag = payment ? bookingAutomaticPaymentTag(payment.state) : { text: "Checking payment", tone: "amber" };
    if (payment?.state === "DISABLED" && billingSettings.data?.automaticPaymentsEnabled) {
      tag = { text: "Automatic payments unavailable", tone: "amber" };
      label = "Your automatic-payment preference is on, but collection is currently unavailable. Refresh payment status to check again.";
    }
  } else if (invoice.status === "PENDING") {
    label = booking.automaticPayment?.message ?? `${formatPence(invoice.totalAmountPence)} automatic invoice is being prepared. This page will update when it is submitted to Stripe.`;
    tag = booking.automaticPayment ? bookingAutomaticPaymentTag(booking.automaticPayment.state) : { text: "Preparing payment", tone: "amber" };
  } else if (invoice.status === "PAID") {
    label = `${period ? `${period}: ` : ""}${formatPence(invoice.totalAmountPence)} paid${invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""}.`;
    tag = { text: "Paid", tone: "green" };
  } else if (automatic && cardApprovalRequired) {
    label = "The card's bank needs a security check. The school can approve this payment in Billing.";
    tag = { text: "Card approval required", tone: "amber" };
  } else if (automatic && failure) {
    label = `${failure}${nextAttempt ? ` Stripe will retry on ${formatDateTime(nextAttempt)}.` : ""}`;
    tag = { text: "Payment needs attention", tone: "red" };
  } else if (automatic && paymentPhase === "scheduled") {
    label = `${period ? `${period}: ` : ""}${formatPence(invoice.totalAmountPence)} will be collected automatically${nextAttempt ? ` on ${formatDateTime(nextAttempt)}` : ""}. No action is required.`;
    tag = { text: "Payment scheduled", tone: "amber" };
  } else if (automatic && invoice.status === "OPEN") {
    label = `${period ? `${period}: ` : ""}${formatPence(invoice.totalAmountPence)} payment is processing. Stripe will confirm the result automatically.`;
    tag = { text: "Automatic payment processing", tone: "amber" };
  } else {
    const overdue = isPastDue(invoice.dueAt);
    label = `${formatPence(invoice.totalAmountPence)} invoiced${invoice.dueAt ? `, due ${formatDate(invoice.dueAt)}` : ""}.`;
    tag = invoice.status === "UNCOLLECTIBLE" ? { text: "Written off", tone: "red" } : { text: overdue ? "Overdue" : "Awaiting payment", tone: overdue ? "red" : "amber" };
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-chalk px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="pound" size={14} />
        {tag ? <Tag tone={tag.tone}>{tag.text}</Tag> : null}
        {automatic || booking.automaticPayment && booking.automaticPayment.state !== "DISABLED" ? <Tag tone="purple">Automatic</Tag> : null}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
      {canPayBookingManually({
        role, bookingStatus: booking.status, automaticState: booking.automaticPayment?.state,
        schoolAutomaticPaymentsEnabled: billingSettings.data?.automaticPaymentsEnabled,
        invoice: invoice ? { status: invoice.status, automatic, failed: Boolean(failure) || Boolean(cardApprovalRequired) } : null,
        payroll: booking.attendancePayroll,
      }) ? <BookingManualPayment booking={booking} invoice={invoice ? { id: invoice.id, totalAmountPence: invoice.totalAmountPence, jobTitle: booking.job.title } : null} /> : null}
      {invoice && invoice.status !== "PENDING" ? <Btn size="sm" variant="ghost" onClick={() => onInvoiceDetails(invoice.id)}>Invoice details</Btn> : null}
      <Btn loading={paymentSync.isPending} loadingLabel="Checking payment" size="sm" variant="ghost" onClick={() => { setPaymentError(null); paymentSync.mutate(booking.id); }}>
        Refresh payment
      </Btn>
      </div>
      {invoice?.status === "PAID" && booking.automaticPayment && booking.automaticPayment.state !== "PAID" ? <p className="w-full text-sm leading-5"><Tag tone={bookingAutomaticPaymentTag(booking.automaticPayment.state).tone}>{bookingAutomaticPaymentTag(booking.automaticPayment.state).text}</Tag><span className="ml-2">{booking.automaticPayment.message}</span></p> : null}
      {booking.attendancePayroll?.covered && (booking.attendancePayroll.excludedAmountPence > 0 || booking.attendancePayroll.pendingAmountPence > 0 || booking.attendancePayroll.reviewAmountPence > 0) ? <p className="w-full text-xs leading-5 text-muted">Attendance totals: {formatPence(booking.attendancePayroll.payableAmountPence)} payable{booking.attendancePayroll.excludedAmountPence > 0 ? ` · ${formatPence(booking.attendancePayroll.excludedAmountPence)} excluded for absence` : ""}{booking.attendancePayroll.pendingAmountPence > 0 ? ` · ${formatPence(booking.attendancePayroll.pendingAmountPence)} awaiting attendance` : ""}{booking.attendancePayroll.reviewAmountPence > 0 ? ` · ${formatPence(booking.attendancePayroll.reviewAmountPence)} under review` : ""}.</p> : null}
      {paymentError ? <p className="w-full text-sm text-danger" role="alert">{paymentError}</p> : null}
    </div>
  );
}

function bookingAutomaticPaymentTag(state: NonNullable<Booking["automaticPayment"]>["state"]): { text: string; tone: "amber" | "green" | "red" | "ghost" } {
  if (state === "PAID") return { text: "Paid", tone: "green" };
  if (state === "FAILED") return { text: "Payment needs attention", tone: "red" };
  if (state === "BLOCKED") return { text: "Payment setup needed", tone: "amber" };
  if (state === "REVIEW_REQUIRED") return { text: "Payment not scheduled", tone: "amber" };
  if (state === "WAITING_ATTENDANCE") return { text: "Waiting for attendance", tone: "amber" };
  if (state === "NOT_DUE") return { text: "Payment not due yet", tone: "ghost" };
  if (state === "NO_PAYMENT_DUE") return { text: "No payment due", tone: "ghost" };
  if (state === "DISABLED") return { text: "Automatic payments off", tone: "ghost" };
  if (state === "SCHEDULED") return { text: "Payment scheduled", tone: "amber" };
  if (state === "PROCESSING") return { text: "Automatic payment processing", tone: "amber" };
  return { text: "Preparing payment", tone: "amber" };
}

function BookingTipPanel({ booking, onTip, role }: { booking: Booking; onTip: (booking: Booking) => void; role: AppRole }) {
  const tip = booking.tip;
  if (!tip && role !== "institution") return null;

  let copy = role === "institution"
    ? "A tip is optional and separate from the booking invoice. The teacher receives the amount you choose; Stripe shows the SupplyED processing fee before you confirm."
    : "No tip has been added to this booking.";
  if (tip?.status === "PAID") copy = `${formatPence(tip.tipAmountPence)} tip ${role === "teacher" ? "received in your Stripe balance" : "paid to the teacher's Stripe account"}. Bank payout timing is shown in Payouts.`;
  if (tip?.status === "PROCESSING") copy = `${formatPence(tip.tipAmountPence)} tip is processing. Stripe will confirm the payment result automatically.`;
  if (tip?.status === "PENDING") copy = `${formatPence(tip.tipAmountPence)} tip checkout has not been completed.`;
  if (tip?.status === "FAILED") copy = tip.paymentFailureMessage ?? "The tip payment failed. The school can try again.";
  if (tip?.status === "CANCELLED") copy = "The previous tip checkout expired or was cancelled. No tip was collected.";
  if (tip?.status === "REFUNDED") copy = `${formatPence(tip.amountRefundedPence)} of the tip payment was refunded.`;

  const retryable = !tip || tip.status === "PENDING" || tip.status === "FAILED" || tip.status === "CANCELLED";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/20 bg-brand-tint/30 px-4 py-3 text-sm">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Icon name="star" size={15} />
        <div>
          <div className="flex flex-wrap items-center gap-2"><strong>Optional teacher tip</strong>{tip ? <Tag tone={tip.status === "PAID" ? "green" : tip.status === "FAILED" ? "red" : "amber"}>{tip.status.toLowerCase().replaceAll("_", " ")}</Tag> : null}</div>
          <p className="mt-1 leading-5 text-muted">{copy}</p>
        </div>
      </div>
      {role === "institution" && retryable ? <Btn icon="star" size="sm" onClick={() => onTip(booking)}>{tip?.status === "PENDING" ? "Continue tip" : tip ? "Try tip again" : "Leave a tip"}</Btn> : null}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function TipBookingModal({
  booking,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  booking: Booking | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (amountPence: number) => void;
}) {
  const [amount, setAmount] = useState(() => booking?.tip?.tipAmountPence ? (booking.tip.tipAmountPence / 100).toFixed(2) : "10.00");
  const [inputError, setInputError] = useState<string>();

  return (
    <Modal label="Optional teacher tip" open={Boolean(booking)} onClose={onClose}>
      <form
        className="p-6 sm:p-7"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!booking || loading) return;
          const normalized = amount.trim();
          if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
            setInputError("Enter a valid amount with up to two decimal places.");
            return;
          }
          const amountPence = Math.round(Number(normalized) * 100);
          if (!Number.isSafeInteger(amountPence) || amountPence < 30 || amountPence > 99_999_999) {
            setInputError("Enter a tip of at least £0.30.");
            return;
          }
          setInputError(undefined);
          onSubmit(amountPence);
        }}
      >
        <Tag tone="purple">Optional tip</Tag>
        <h2 className="mt-4 font-heading text-2xl">Thank {booking?.instructor.fullName ?? "this teacher"}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">The amount you enter goes to the teacher. SupplyED&apos;s existing configured processing fee is added on top and shown clearly in Stripe Checkout. This is a separate one-time payment and does not change the booking invoice.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[5, 10, 20, 50].map((value) => <Btn key={value} size="sm" type="button" variant={amount === value.toFixed(2) ? "secondary" : "ghost"} onClick={() => { setAmount(value.toFixed(2)); setInputError(undefined); }}>£{value}</Btn>)}
        </div>
        <div className="mt-4"><Field error={inputError} label="Tip for the teacher" required>
          <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">£</span><input className="input w-full pl-7" inputMode="decimal" min="0.30" onChange={(event) => { setAmount(event.target.value); if (inputError) setInputError(undefined); }} step="0.01" value={amount} /></div>
        </Field></div>
        {error ? <p className="mt-4 rounded-lg border border-danger bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <p className="mt-4 text-xs leading-5 text-muted">Stripe securely collects your card payment. The teacher receives the tip in their Stripe balance after payment succeeds; bank payout timing depends on Stripe availability and the teacher&apos;s payout schedule.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} type="button" variant="ghost" onClick={onClose}>Not now</Btn>
          <Btn icon="star" loading={loading} loadingLabel="Opening Stripe" type="submit">Continue to Stripe</Btn>
        </div>
      </form>
    </Modal>
  );
}

function CreateInvoiceModal({
  booking,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  booking: Booking | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (unitsWorked: number | undefined, poNumber: string | undefined) => void;
}) {
  const payType = booking?.payType;
  const fixed = payType === "fixed";
  const unit = payType === "hourly" ? "hours" : "days";
  const [units, setUnits] = useState(() => (booking && payType === "daily" ? String(bookingDays(booking) ?? "") : ""));
  const [poNumber, setPoNumber] = useState("");
  const [inputError, setInputError] = useState<string>();
  const [poError, setPoError] = useState<string>();
  const unitsValue = Number(units);
  const maxUnits = booking ? invoiceUnitsLimit(booking) : 9999.99;
  const validPay = ["daily", "hourly", "fixed"].includes(payType ?? "") && typeof booking?.payAmount === "number" && booking.payAmount > 0;
  const unitsValid = validPay && (fixed || (units.trim() !== "" && Number.isFinite(unitsValue) && unitsValue >= 0.01 && unitsValue <= maxUnits && /^\d+(\.\d{1,2})?$/.test(units.trim())));
  const rate = booking?.payAmount ?? 0;
  const teacherPay = fixed ? rate : unitsValid ? rate * unitsValue : 0;

  return (
    <Modal open={Boolean(booking)} onClose={onClose}>
      <form
        className="p-6 sm:p-7"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (loading) return;
          if (!unitsValid) { setInputError(`Enter valid ${unit} between 0.01 and ${maxUnits}, with up to two decimal places.`); return; }
          setInputError(undefined);
          if (poNumber.trim().length > 100) { setPoError("Use 100 characters or fewer for the PO number."); return; }
          setPoError(undefined);
          onSubmit(fixed ? undefined : unitsValue, poNumber.trim() || undefined);
        }}
      >
        <Tag tone="green">Invoice</Tag>
        <h2 className="mt-4 font-heading text-2xl">Invoice {booking?.instructor.fullName ?? "this booking"}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Stripe sends the school an invoice with a secure payment link. The invoice includes the agreed teacher pay and
          SupplyEd&apos;s processing fee. The teacher must finish setting up Stripe payouts before an invoice can be sent.
        </p>

        {fixed ? (
          <p className="mt-4 rounded-lg bg-chalk px-3 py-2 text-sm">Fixed price: {formatPence(Math.round(rate * 100))}</p>
        ) : (
          <label className="mt-4 block text-sm font-semibold">
            {payType === "hourly" ? "Hours worked" : "Days worked"}
            <input
              aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? "invoice-units-error" : undefined}
              className="input mt-2 w-full"
              inputMode="decimal"
              type="number"
              min="0.01"
              max={maxUnits}
              step="0.01"
              required
              onChange={(event) => setUnits(event.target.value)}
              placeholder={payType === "hourly" ? "e.g. 7.5" : "e.g. 5 or 4.5"}
              value={units}
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              At {formatPence(Math.round(rate * 100))} per {unit === "hours" ? "hour" : "day"}. Enter 0.01–{maxUnits} {unit}, with up to two decimal places.
            </span>
            {inputError ? <span className="mt-1 block text-sm font-normal text-danger" id="invoice-units-error" role="alert">{inputError}</span> : null}
          </label>
        )}

        <label className="mt-4 block text-sm font-semibold">
          PO number <span className="font-normal text-muted">(optional)</span>
          <input aria-invalid={Boolean(poError)} aria-describedby={poError ? "invoice-po-error" : undefined} className="input mt-2 w-full" maxLength={100} onChange={(event) => setPoNumber(event.target.value)} value={poNumber} />
          {poError ? <span className="mt-1 block text-sm font-normal text-danger" id="invoice-po-error" role="alert">{poError}</span> : null}
        </label>

        {unitsValid ? (
          <p className="mt-4 text-sm">
            Estimated teacher pay: <strong>{formatPence(Math.round(teacherPay * 100))}</strong> <span className="text-muted">+ SupplyEd processing fee. The issued invoice confirms the total.</span>
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={loading} loadingLabel="Sending" type="submit">Send invoice</Btn>
        </div>
      </form>
    </Modal>
  );
}

function isPastDue(dueAt?: string | null) {
  return Boolean(dueAt) && new Date(dueAt as string).getTime() < Date.now();
}

function CancelBookingModal({
  booking,
  loading,
  onClose,
  onSubmit,
}: {
  booking: Booking | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();

  return (
    <Modal open={Boolean(booking)} onClose={onClose}>
      <form
        className="p-6 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (loading || !booking) return;
          const problem = validateCancellationReason(reason);
          setReasonError(problem);
          if (problem) return;
          onSubmit(reason.trim());
        }}
      >
        <Tag tone="red">Cancel booking</Tag>
        <h2 className="mt-4 font-heading text-2xl">Cancel this booking?</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Add a short reason so both sides have a clear record.</p>
        <div className="mt-4"><Field error={reasonError} label="Reason for cancellation" required>
          <textarea
            className="textarea min-h-28 w-full"
            maxLength={1000}
            onChange={(event) => { setReason(event.target.value); if (reasonError) setReasonError(validateCancellationReason(event.target.value)); }}
            placeholder="Reason for cancellation"
            value={reason}
          />
        </Field></div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} variant="ghost" onClick={onClose}>Keep booking</Btn>
          <Btn loading={loading} loadingLabel="Cancelling" type="submit" variant="danger">Cancel booking</Btn>
        </div>
      </form>
    </Modal>
  );
}

function ReviewBookingModal({
  booking,
  loading,
  onClose,
  onSubmit,
  role,
}: {
  booking: Booking | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  role: AppRole;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string>();
  const reviewee = useMemo(() => {
    if (!booking) return role === "teacher" ? "school" : "teacher";
    return role === "teacher" ? booking.institution.name ?? "school" : booking.instructor.fullName ?? "teacher";
  }, [booking, role]);

  return (
    <Modal open={Boolean(booking)} onClose={onClose}>
      <form
        className="p-6 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (loading || !booking) return;
          const problem = validateBookingReview(rating, comment);
          setReviewError(problem);
          if (problem) return;
          onSubmit(rating, comment.trim());
        }}
      >
        <Tag tone="green">Booking review</Tag>
        <h2 className="mt-4 font-heading text-2xl">Review {reviewee}</h2>
        <div aria-label="Rating" className="mt-5 flex flex-wrap gap-2" role="group">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
              aria-pressed={rating === value}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${rating >= value ? "border-brand bg-brand-tint text-brand" : "border-border text-muted"}`}
              onClick={() => setRating(value)}
              type="button"
            >
              <Icon className={rating >= value ? "fill-current" : "fill-none"} name="star" size={16} />
            </button>
          ))}
        </div>
        <div className="mt-4"><Field error={reviewError} label="Review note (optional)">
          <textarea
            className="textarea min-h-28 w-full"
            maxLength={2000}
            onChange={(event) => { setComment(event.target.value); if (reviewError) setReviewError(validateBookingReview(rating, event.target.value)); }}
            placeholder="Optional review note"
            value={comment}
          />
        </Field></div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={loading} loadingLabel="Submitting" type="submit">Submit review</Btn>
        </div>
      </form>
    </Modal>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="booking-placement-fact"><div className="booking-placement-label"><Icon name={icon} size={15} />{label}</div><p>{value}</p></div>;
}

function validateCancellationReason(reason: string) {
  if (!reason.trim()) return "Enter a reason for cancelling this booking.";
  if (reason.trim().length > 1000) return "Use 1,000 characters or fewer.";
}

function validateBookingReview(rating: number, comment: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Choose a rating between 1 and 5.";
  if (comment.trim().length > 2000) return "Use 2,000 characters or fewer for your review.";
}

function useBookingTipReturn(toast: RouteProps["toast"]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);
  const sync = useSyncBookingTip({
    onError: () => toast({ title: "Tip status unavailable", msg: "Refresh Bookings to check the payment.", tone: "danger" }),
    onSuccess: (result) => toast({
      title: result.ok ? (result.data.status === "PAID" ? "Tip paid" : "Tip processing") : "Tip status unavailable",
      msg: result.message ?? (result.ok ? "The booking tip status was refreshed." : "Refresh Bookings to check the payment."),
      tone: result.ok ? "success" : "danger",
    }),
  });
  const mutate = sync.mutate;
  const returnStatus = searchParams.get("tip");
  const tipId = searchParams.get("tip_id");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (handled.current || !returnStatus) return;
    handled.current = true;
    router.replace(pathname, { scroll: false });
    if (returnStatus === "cancelled") {
      toast({ title: "Tip not submitted", msg: "No tip was collected. You can continue the checkout later." });
      return;
    }
    if (returnStatus === "success" && tipId && sessionId) mutate({ tipId, sessionId });
    else toast({ title: "Tip status unavailable", msg: "The Stripe return reference is incomplete. Refresh Bookings to check it.", tone: "danger" });
  }, [mutate, pathname, returnStatus, router, sessionId, tipId, toast]);
}

function BookingStatusTag({ status }: { status: BookingStatus }) {
  const tone = status === "CANCELLED" || status === "NO_SHOW" ? "red" : "green";
  return <Tag tone={tone}>{status === "NO_SHOW" ? "No-show" : status.charAt(0) + status.slice(1).toLowerCase()}</Tag>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <WorkspaceEmptyState icon="calendar" message={message} title={title} />;
}

function emptyMessage(tab: Tab, role: AppRole) {
  if (tab === "all") return role === "teacher" ? "Your bookings will stay here after they are completed or cancelled." : "Your bookings will stay here after they are completed, cancelled, or marked no-show.";
  if (tab === "active") return role === "teacher" ? "New school bookings will appear here when a school hires you." : "New bookings appear here when you hire a teacher from Applications.";
  if (tab === "completed") return "Completed bookings will appear here after the school confirms the work was done.";
  return "No bookings match this filter yet.";
}

function isReviewableBookingStatus(status: BookingStatus) {
  return status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW";
}

function formatClosedStatus(status: BookingStatus) {
  if (status === "NO_SHOW") return "No-show";
  return status.toLowerCase();
}

function reviewerType(role: AppRole) {
  return role === "teacher" ? "INSTRUCTOR" : "INSTITUTION";
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Dates TBC";
  const startLabel = start ? formatDate(start) : "Start TBC";
  const endLabel = end ? formatDate(end) : startLabel;
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatPay(amount?: number | null, payType?: string | null) {
  if (!amount) return "Pay TBC";
  if (payType === "hourly") return `GBP ${amount}/hr`;
  if (payType === "fixed") return `GBP ${amount} fixed`;
  return `GBP ${amount}/day`;
}
