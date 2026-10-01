"use client";

import { useMemo, useState } from "react";

import type { Booking, BookingStatus } from "@/features/bookings/types";
import { useBookings, useCreateBookingReview, useUpdateBookingStatus } from "@/features/bookings/use-bookings";
import type { AppRole, RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { Modal, PageHead, SectionLoader } from "../molecules";

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

export function BookingsPage({ role, toast }: Pick<RouteProps, "role" | "toast">) {
  const [tab, setTab] = useState<Tab>("all");
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const bookingsQuery = useBookings({ limit: 100 });
  const allBookings = bookingsQuery.data?.bookings ?? [];
  const bookings = tabStatus[tab] ? allBookings.filter((booking) => booking.status === tabStatus[tab]) : allBookings;
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

  const subtitle = role === "teacher"
    ? "Your active and completed placements with schools."
    : "Your school bookings, confirmations, and completed placements.";

  return (
    <>
      <div className="app-page">
        <PageHead
          title="Bookings"
          subtitle={subtitle}
          actions={<Tag tone="ghost">{bookings.length} shown</Tag>}
        />

        <div className="card card-pad mb-6 flex flex-wrap items-center gap-3">
          {tabs.map((item) => (
            <Btn
              key={item.value}
              size="sm"
              variant={tab === item.value ? "secondary" : "ghost"}
              onClick={() => setTab(item.value)}
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
                onNoShow={(id) => updateBooking.mutate({ action: "no-show", id })}
                onReview={setReviewTarget}
                pending={updateBooking.isPending}
                role={role}
              />
            ))}
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
  onNoShow,
  onReview,
  pending,
  role,
}: {
  booking: Booking;
  cancelling: boolean;
  onCancel: (booking: Booking) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
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
            <h2 className="font-serif text-2xl leading-tight">{booking.job.title}</h2>
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
        <h2 className="mt-4 font-serif text-2xl">Cancel this booking?</h2>
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
        <h2 className="mt-4 font-serif text-2xl">Review {reviewee}</h2>
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
  return <div className="card card-pad-lg text-center"><div className="font-serif text-[24px]">{title}</div><p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">{message}</p></div>;
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
