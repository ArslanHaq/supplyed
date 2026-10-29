import type { InstructorBookingDates } from "@/features/public-profiles/booking-dates";
import { Icon } from "../atoms";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
});

export function TeacherBookingDates({ bookings, compact = false }: { bookings: InstructorBookingDates[] | null | undefined; compact?: boolean }) {
  const visible = compact ? bookings?.slice(0, 2) : bookings;
  const remaining = compact ? bookings?.slice(2) : [];
  return (
    <section aria-label="Confirmed booking dates" className="mt-4 rounded-xl border border-border bg-chalk p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon name="calendar" size={16} />Confirmed bookings</h2>
      {bookings == null ? <p className="mt-2 text-xs text-muted">Booking dates are currently unavailable.</p>
        : bookings.length === 0 ? <p className="mt-2 text-xs text-muted">No current or upcoming confirmed bookings.</p>
          : <>
            <p className="mt-1 text-xs text-muted">Booked dates and times · UK time</p>
            <ul className="mt-2 space-y-2 text-xs leading-5 text-ink">{visible?.map(booking => <BookingRange booking={booking} key={booking.id} />)}</ul>
            {remaining?.length ? <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-semibold text-brand">Show {remaining.length} more {remaining.length === 1 ? "booking" : "bookings"}</summary>
              <ul className="mt-2 space-y-2 leading-5 text-ink">{remaining.map(booking => <BookingRange booking={booking} key={booking.id} />)}</ul>
            </details> : null}
          </>}
    </section>
  );
}

function BookingRange({ booking }: { booking: InstructorBookingDates }) {
  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const sameDay = dateFormat.format(start) === dateFormat.format(end);
  return <li className="break-words">
    <time dateTime={booking.startDate}>{dateFormat.format(start)}, {timeFormat.format(start)}</time>
    {" – "}
    <time dateTime={booking.endDate}>{sameDay ? "" : `${dateFormat.format(end)}, `}{timeFormat.format(end)}</time>
  </li>;
}
