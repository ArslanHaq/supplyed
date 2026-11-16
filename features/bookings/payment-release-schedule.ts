import type { Booking } from "./types";
import { scheduleIntervals } from "../jobs/job-schedule";

const DAY = 86_400_000;
const addDays = (date: string, count: number) => new Date(Date.parse(`${date}T12:00:00Z`) + count * DAY).toISOString().slice(0, 10);
function addMonths(date: string, count: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + count, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export type ReleasePeriod = { key: string; label: string; dates: string[]; releaseDate: string; releaseTime: string; shifts: number };

/** Calendar forecast only. No attendance mutations, invoice creation or collection requests. */
export function paymentReleaseSchedule(booking: Pick<Booking, "schedule" | "startDate" | "endDate" | "paymentFrequency" | "payType" | "periodAnchor">): ReleasePeriod[] {
  if (!booking.schedule || !booking.startDate || !booking.endDate || booking.paymentFrequency === "milestone") return [];
  const start = booking.startDate.slice(0, 10);
  const frequency = booking.payType === "fixed" ? "completion" : booking.paymentFrequency || "daily";
  const groups = new Map<string, ReleasePeriod>();
  for (const shift of scheduleIntervals(booking.schedule, booking.startDate, booking.endDate)) {
    let key = shift.date, label = "Daily payment", releaseDate = addDays(shift.date, 1), releaseTime = "00:00";
    const endDate = shift.end <= shift.start ? addDays(shift.date, 1) : shift.date;
    if (frequency === "hourly") {
      // Retain an accurate read-only forecast for historical hourly-frequency bookings.
      key = `${shift.date}-${shift.start}`; label = "Shift payment"; releaseDate = endDate; releaseTime = shift.end;
    } else if (frequency === "weekly") {
      const weekStart = booking.periodAnchor === "CALENDAR"
        ? addDays(shift.date, -((new Date(`${shift.date}T12:00:00Z`).getUTCDay() + 6) % 7))
        : addDays(start, Math.floor((Date.parse(`${shift.date}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / DAY / 7) * 7);
      key = `week:${weekStart}`; label = "Weekly payment"; releaseDate = addDays(weekStart, 7);
    } else if (frequency === "monthly") {
      let monthStart = `${shift.date.slice(0, 7)}-01`;
      if (booking.periodAnchor !== "CALENDAR") {
        let index = 0;
        while (shift.date >= addMonths(start, index + 1)) index++;
        monthStart = addMonths(start, index);
        releaseDate = addMonths(start, index + 1);
      } else releaseDate = addMonths(monthStart, 1);
      key = `month:${monthStart}`; label = "Monthly payment";
    } else if (frequency === "completion") {
      key = "completion"; label = "After completion"; releaseDate = endDate; releaseTime = shift.end;
    }
    const existing = groups.get(key);
    if (existing) {
      if (!existing.dates.includes(shift.date)) existing.dates.push(shift.date);
      existing.shifts++;
      if (frequency === "completion" && `${releaseDate}T${releaseTime}` > `${existing.releaseDate}T${existing.releaseTime}`) {
        existing.releaseDate = releaseDate; existing.releaseTime = releaseTime;
      }
    } else groups.set(key, { key, label, dates: [shift.date], releaseDate, releaseTime, shifts: 1 });
  }
  return [...groups.values()].sort((a, b) => `${a.releaseDate}T${a.releaseTime}`.localeCompare(`${b.releaseDate}T${b.releaseTime}`));
}
