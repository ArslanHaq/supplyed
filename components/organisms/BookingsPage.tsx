"use client";

import { useMemo, useState } from "react";

import type { Booking, BookingStatus } from "@/features/bookings/types";
import { bookingDays, invoiceUnitsLimit } from "@/features/bookings/schemas";
import { useBookings, useCreateBookingReview, useUpdateBookingStatus } from "@/features/bookings/use-bookings";
import { formatPence } from "@/features/payments/schemas";
import { useCreateInvoice, useInvoice } from "@/features/payments/use-payments";
import type { Invoice, PayableInvoice } from "@/features/payments/types";
import type { AppRole, RouteProps } from "@/types/supplyed";

import { Avatar, Btn, buttonClassName, Icon, Tag } from "../atoms";
import { Modal, PageHead, SectionLoader } from "../molecules";
import { InvoiceDetailsModal } from "./InvoiceDetailsModal";
import { PayInvoiceModal } from "./PayInvoiceModal";

type Tab = "active" | "all" | "cancelled" | "completed" | "no-show";

const tabStatus: Record<Tab, BookingStatus | undefined> = {
  active: "CONFIRMED",
  all: undefined,
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  "no-show": "NO_SHOW",
};

const tabs: Array<{ label: string; value: Tab }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No-show", value: "no-show" },
];

export function BookingsPage({ go, role, toast }: Pick<RouteProps, "go" | "role" | "toast">) {
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Booking | null>(null);
  const [invoiceDetailsId, setInvoiceDetailsId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayableInvoice | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const bookingsQuery = useBookings({ limit: 20, page, status: tabStatus[tab] });
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

  const createInvoice = useCreateInvoice({
    onError: () => setInvoiceError("The invoice request could not be submitted. Please try again."),
    onSuccess: (result) => {
      toast({
        title: result.ok ? "Invoice sent" : "Could not create invoice",
        msg: !result.ok && result.requestId ? `${result.message} Support reference: ${result.requestId}` : result.message ?? "The school has been sent the invoice.",
        tone: result.ok ? "success" : "danger",
      });
      if (result.ok) {
        setInvoiceTarget(null);
        setInvoiceError(null);
        setInvoiceDetailsId(result.data.id);
      } else {
        setInvoiceError(result.requestId ? `${result.message} Support reference: ${result.requestId}` : result.message);
      }
    },
  });

  const subtitle = role === "teacher"
    ? "Your active and completed placements with schools."
    : "Your school bookings, confirmations, and completed placements.";

  return (
    <>
      <div className="app-page">
        <PageHead
          title="Bookings"
          subtitle={subtitle}
          actions={<><Tag tone="ghost">{bookingsQuery.data?.pagination.total ?? 0} bookings</Tag><Btn loading={bookingsQuery.isFetching} loadingLabel="Refreshing" size="sm" variant="ghost" onClick={() => { void bookingsQuery.refetch(); }}>Refresh</Btn></>}
        />

        <div className="card card-pad mb-6 flex flex-wrap items-center gap-3">
          {tabs.map((item) => (
            <Btn
              key={item.value}
              size="sm"
              variant={tab === item.value ? "secondary" : "ghost"}
              onClick={() => { setTab(item.value); setPage(1); }}
            >
              {item.label}
            </Btn>
          ))}
        </div>

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
                cancelling={updateBooking.isPending && cancelTarget?.id === booking.id}
                onCancel={setCancelTarget}
                onComplete={(id) => updateBooking.mutate({ action: "complete", id })}
                onInvoice={(booking) => { setInvoiceError(null); setInvoiceTarget(booking); }}
                onInvoiceDetails={setInvoiceDetailsId}
                onMessage={(selectedBooking) => go("messaging", { applicationId: selectedBooking.applicationId })}
                onPay={setPayTarget}
                onNoShow={(id) => updateBooking.mutate({ action: "no-show", id })}
                onReview={setReviewTarget}
                pending={updateBooking.isPending}
                role={role}
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

      <CreateInvoiceModal
        key={invoiceTarget?.id ?? "none"}
        booking={invoiceTarget}
        error={invoiceError}
        loading={createInvoice.isPending}
        onClose={() => {
          if (!createInvoice.isPending) setInvoiceTarget(null);
        }}
        onSubmit={(unitsWorked, poNumber) => {
          if (invoiceTarget) createInvoice.mutate({ bookingId: invoiceTarget.id, poNumber, unitsWorked });
        }}
      />

      <InvoiceDetailsModal
        id={invoiceDetailsId}
        onClose={() => setInvoiceDetailsId(null)}
        onPay={(invoice: Invoice) => {
          setInvoiceDetailsId(null);
          setPayTarget({ id: invoice.id, jobTitle: invoice.booking.jobTitle, totalAmountPence: invoice.totalAmountPence });
        }}
        role={role}
      />
      <PayInvoiceModal invoice={payTarget} onClose={() => setPayTarget(null)} toast={toast} />

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
  cancelling,
  onCancel,
  onComplete,
  onInvoice,
  onInvoiceDetails,
  onMessage,
  onNoShow,
  onPay,
  onReview,
  pending,
  role,
}: {
  booking: Booking;
  cancelling: boolean;
  onCancel: (booking: Booking) => void;
  onComplete: (id: string) => void;
  onInvoice: (booking: Booking) => void;
  onInvoiceDetails: (id: string) => void;
  onMessage: (booking: Booking) => void;
  onNoShow: (id: string) => void;
  onPay: (invoice: PayableInvoice) => void;
  onReview: (booking: Booking) => void;
  pending: boolean;
  role: AppRole;
}) {
  const otherParty = role === "teacher"
    ? { imageUrl: booking.institution.imageUrl, name: booking.institution.name ?? "School" }
    : { imageUrl: booking.instructor.imageUrl, name: booking.instructor.fullName ?? "Teacher" };
  const ownReview = booking.reviews.find((review) => review.reviewerType === reviewerType(role));
  const reviewable = isReviewableBookingStatus(booking.status);
  const canReview = reviewable && !ownReview;
  const location = [booking.job.city, booking.job.county, booking.job.postalCode].filter(Boolean).join(", ") || "Location TBC";

  return (
    <article className="card card-pad-lg">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={otherParty.name} src={otherParty.imageUrl} />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl leading-tight">{booking.job.title}</h2>
            <BookingStatusTag status={booking.status} />
          </div>
          <div className="mt-1 text-sm text-muted">{otherParty.name} - {location}</div>
        </div>
        <div className="text-left text-sm sm:text-right">
          <div className="font-semibold">{formatDateRange(booking.startDate, booking.endDate)}</div>
          <div className="text-muted">{formatPay(booking.payAmount, booking.payType)}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <Detail icon="calendar" label="Dates" value={formatDateRange(booking.startDate, booking.endDate)} />
        <Detail icon="pound" label="Pay" value={formatPay(booking.payAmount, booking.payType)} />
        <Detail icon="pin" label="Arrival" value={booking.job.parkingInfo || "Shared by the school"} />
      </div>

      {booking.cancelReason ? <p className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{booking.cancelReason}</p> : null}

      {booking.status === "COMPLETED" ? <InvoiceStrip booking={booking} onInvoice={onInvoice} onInvoiceDetails={onInvoiceDetails} onPay={onPay} role={role} /> : (
        booking.status === "CONFIRMED" ? <p className="mt-4 rounded-lg bg-chalk px-4 py-3 text-sm text-muted">Payment is handled through a Stripe invoice after this booking is completed.</p> : null
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-xs text-muted">
          {reviewable
            ? ownReview
              ? `Reviewed with ${ownReview.rating}/5`
              : `${formatClosedStatus(booking.status)} booking ready for review`
            : booking.status === "CONFIRMED"
              ? "Active booking contract"
              : "Booking closed"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn icon="message" size="sm" variant="secondary" onClick={() => onMessage(booking)}>
            Message {role === "teacher" ? "school" : "teacher"}
          </Btn>
          {booking.status === "CONFIRMED" && role === "institution" ? (
            <>
              <Btn disabled={pending} size="sm" variant="secondary" onClick={() => onComplete(booking.id)}>Complete</Btn>
              <Btn disabled={pending} size="sm" variant="danger" onClick={() => onNoShow(booking.id)}>No-show</Btn>
            </>
          ) : null}
          {booking.status === "CONFIRMED" ? (
            <Btn disabled={pending} loading={cancelling} loadingLabel="Cancelling" size="sm" variant="ghost" onClick={() => onCancel(booking)}>Cancel</Btn>
          ) : null}
          {canReview ? (
            <Btn icon="star" size="sm" onClick={() => onReview(booking)}>Review {role === "teacher" ? "school" : "teacher"}</Btn>
          ) : (
            <Btn disabled size="sm" variant="ghost">{ownReview ? "Review submitted" : "Review after close"}</Btn>
          )}
        </div>
      </div>
    </article>
  );
}

/** Payment state of a completed booking: invoice it (school), pay it, or see where it stands. */
function InvoiceStrip({ booking, onInvoice, onInvoiceDetails, onPay, role }: { booking: Booking; onInvoice: (booking: Booking) => void; onInvoiceDetails: (id: string) => void; onPay: (invoice: PayableInvoice) => void; role: AppRole }) {
  const bookingInvoice = booking.invoice;
  const invoiceDetail = useInvoice(bookingInvoice?.id ?? null);
  const latestInvoice = invoiceDetail.data;
  const invoice = bookingInvoice && latestInvoice?.id === bookingInvoice.id
    ? {
        ...bookingInvoice,
        dueAt: latestInvoice.dueAt,
        hostedInvoiceUrl: latestInvoice.hostedInvoiceUrl,
        paidAt: latestInvoice.paidAt,
        status: latestInvoice.status === "PAID" || latestInvoice.status === "UNCOLLECTIBLE" ? latestInvoice.status : "OPEN",
        totalAmountPence: latestInvoice.totalAmountPence,
      }
    : bookingInvoice;
  const canInvoice = ["daily", "hourly", "fixed"].includes(booking.payType ?? "") && typeof booking.payAmount === "number" && booking.payAmount > 0;
  let label: string;
  let tag: { text: string; tone: "amber" | "green" | "red" } | null = null;

  if (!invoice) {
    label = role === "teacher" ? "The school can invoice this booking once your Stripe payouts are ready." : canInvoice ? "Send an invoice to pay the teacher. Their Stripe payout setup must be complete." : "This booking needs an agreed rate and pay type before it can be invoiced.";
  } else if (invoice.status === "PAID") {
    label = `${formatPence(invoice.totalAmountPence)} paid${invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""}.`;
    tag = { text: "Paid", tone: "green" };
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
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
      {role === "institution" && !invoice && canInvoice ? (
        <Btn size="sm" onClick={() => onInvoice(booking)}>Create invoice</Btn>
      ) : null}
      {invoice ? <Btn size="sm" variant="ghost" onClick={() => onInvoiceDetails(invoice.id)}>Invoice details</Btn> : null}
      {invoice && invoice.status !== "PAID" ? (
        <Btn loading={invoiceDetail.isFetching} loadingLabel="Checking" size="sm" variant="ghost" onClick={() => { void invoiceDetail.refetch(); }}>
          Refresh payment
        </Btn>
      ) : null}
      {role === "institution" && invoice && (invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE") ? (
        <Btn size="sm" onClick={() => onPay({ id: invoice.id, jobTitle: booking.job.title, totalAmountPence: invoice.totalAmountPence })}>
          Pay invoice
        </Btn>
      ) : null}
      </div>
    </div>
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
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading && unitsValid) onSubmit(fixed ? undefined : unitsValue, poNumber.trim() || undefined);
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
          </label>
        )}

        <label className="mt-4 block text-sm font-semibold">
          PO number <span className="font-normal text-muted">(optional)</span>
          <input className="input mt-2 w-full" maxLength={100} onChange={(event) => setPoNumber(event.target.value)} value={poNumber} />
        </label>

        {unitsValid ? (
          <p className="mt-4 text-sm">
            Estimated teacher pay: <strong>{formatPence(Math.round(teacherPay * 100))}</strong> <span className="text-muted">+ SupplyEd processing fee. The issued invoice confirms the total.</span>
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!unitsValid} loading={loading} loadingLabel="Sending" type="submit">Send invoice</Btn>
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

  return (
    <Modal open={Boolean(booking)} onClose={onClose}>
      <form
        className="p-6 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(reason);
        }}
      >
        <Tag tone="red">Cancel booking</Tag>
        <h2 className="mt-4 font-heading text-2xl">Cancel this booking?</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Add a short reason so both sides have a clear record.</p>
        <textarea
          className="input mt-4 min-h-28 w-full"
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for cancellation"
          value={reason}
        />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} variant="ghost" onClick={onClose}>Keep booking</Btn>
          <Btn disabled={!reason.trim()} loading={loading} loadingLabel="Cancelling" type="submit" variant="danger">Cancel booking</Btn>
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
          onSubmit(rating, comment);
        }}
      >
        <Tag tone="green">Booking review</Tag>
        <h2 className="mt-4 font-heading text-2xl">Review {reviewee}</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${rating >= value ? "border-brand bg-brand-tint text-brand" : "border-border text-muted"}`}
              onClick={() => setRating(value)}
              type="button"
            >
              <Icon name="star" size={16} />
            </button>
          ))}
        </div>
        <textarea
          className="input mt-4 min-h-28 w-full"
          maxLength={2000}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional review note"
          value={comment}
        />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn loading={loading} loadingLabel="Submitting" type="submit">Submit review</Btn>
        </div>
      </form>
    </Modal>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="rounded-lg bg-chalk p-3"><div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted"><Icon name={icon} size={13} />{label}</div><div className="font-medium">{value}</div></div>;
}

function BookingStatusTag({ status }: { status: BookingStatus }) {
  const tone = status === "COMPLETED" ? "green" : status === "CANCELLED" || status === "NO_SHOW" ? "red" : "purple";
  return <Tag tone={tone}>{status.toLowerCase().replace(/_/g, " ")}</Tag>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="card card-pad-lg text-center"><div className="font-heading text-[24px]">{title}</div><p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">{message}</p></div>;
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
