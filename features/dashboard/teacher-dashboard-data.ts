import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import type { Booking } from "@/features/bookings/types";
import type { Invitation } from "@/features/invitations/types";
import type { SettingsProfileSnapshot } from "@/features/settings/types";

/** Teaching dates belong to the UK school, independently of the browser timezone. */
export const DASHBOARD_TIME_ZONE = "Europe/London";
export type DashboardBookingPeriod = "week" | "month" | "all";
export const DASHBOARD_APPLICATION_STATUSES: JobApplicationStatus[] = ["APPLIED", "VIEWED", "SHORTLISTED", "HIRED", "REJECTED"];

const calendarFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
});

function calendarParts(value: string | number | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = calendarFormatter.formatToParts(date);
  const part = (name: string) => Number(parts.find((item) => item.type === name)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
}

function calendarDay(value: string | number | Date) {
  const parts = calendarParts(value);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null;
}

/** An explicit instant avoids the backend interpreting a London date as UTC midnight. */
export function dashboardDayStart(now: string | number | Date = Date.now()) {
  const day = calendarDay(now);
  if (day === null) throw new Error("A valid date is required.");
  // London is UTC or UTC+1, and its daylight-saving changes happen after midnight.
  const offsetHours = calendarParts(day)?.hour ?? 0;
  return new Date(day - offsetHours * 60 * 60 * 1000).toISOString();
}

export function formatDashboardDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...options, timeZone: DASHBOARD_TIME_ZONE }).format(new Date(value));
}

export function getUpcomingBookings(bookings: Booking[], now: number = Date.now()) {
  const today = calendarDay(now);
  if (today === null) return [];
  return bookings.filter((booking) => {
    const start = booking.startDate ? calendarDay(booking.startDate) : null;
    const end = booking.endDate ? calendarDay(booking.endDate) : start;
    return booking.status === "CONFIRMED" && start !== null && end !== null && end >= today;
  }).sort((left, right) => Date.parse(left.startDate!) - Date.parse(right.startDate!) || left.id.localeCompare(right.id));
}

/** Includes ongoing multi-day bookings, and the whole of the final school day. */
export function isDashboardBookingOngoing(booking: Booking, now: number = Date.now()) {
  const today = calendarDay(now);
  const start = booking.startDate ? calendarDay(booking.startDate) : null;
  const end = booking.endDate ? calendarDay(booking.endDate) : start;
  return booking.status === "CONFIRMED" && today !== null && start !== null && end !== null && start <= today && end >= today;
}

/** Week and month mean the current calendar week/month, including work already underway. */
export function filterDashboardBookings(bookings: Booking[], period: DashboardBookingPeriod, now: number = Date.now()) {
  const upcoming = getUpcomingBookings(bookings, now);
  if (period === "all") return upcoming;
  const today = calendarDay(now);
  if (today === null) return [];
  const date = new Date(today);
  const until = period === "week"
    ? today + (7 - ((date.getUTCDay() + 6) % 7)) * 86400000
    : Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return upcoming.filter((booking) => calendarDay(booking.startDate!)! < until);
}

export type DashboardApplicationSummary = {
  active: number;
  counts: Record<JobApplicationStatus, number>;
  total: number;
};

export function summarizeDashboardApplications(applications: JobApplication[]): DashboardApplicationSummary {
  const counts: Record<JobApplicationStatus, number> = { APPLIED: 0, VIEWED: 0, SHORTLISTED: 0, HIRED: 0, REJECTED: 0 };
  for (const application of applications) counts[application.status] += 1;
  return { active: counts.APPLIED + counts.VIEWED + counts.SHORTLISTED, counts, total: applications.length };
}

export function getPendingDashboardInvitations(invitations: Invitation[], now: number = Date.now()) {
  return invitations.filter((invitation) => invitation.status === "PENDING" && Date.parse(invitation.expiresAt) > now)
    .sort((left, right) => Date.parse(left.expiresAt) - Date.parse(right.expiresAt) || left.id.localeCompare(right.id));
}

export type DashboardProfileTask = { id: string; label: string; complete: boolean };

/** Optional profile improvements; these are not a verification score or an approval gate. */
export function getDashboardProfileTasks(profile: SettingsProfileSnapshot): DashboardProfileTask[] {
  const teacher = profile.instructor;
  return [
    { id: "photo", label: "Add a profile photo", complete: Boolean(teacher?.imageUrl.trim()) },
    { id: "bio", label: "Introduce yourself to schools", complete: Boolean(teacher?.bio.trim()) },
    { id: "subjects", label: "Add subjects and key stages", complete: Boolean(teacher?.subjects.length && teacher.keyStages.length) },
    { id: "rates", label: "Set your teaching rate", complete: Number(teacher?.dailyRate) > 0 || Number(teacher?.hourlyRate) > 0 },
    { id: "location", label: "Add your location and travel distance", complete: Boolean(teacher?.postalCode.trim()) && Boolean(teacher?.maxTravelDistance.trim()) && Number(teacher?.maxTravelDistance) >= 0 },
  ];
}

export type DashboardPage<T> = {
  items: T[];
  pagination: { hasNextPage: boolean; page: number; total: number; totalPages: number };
};

/** Never turn a truncated, repeated or changing page into an apparently complete count. */
export async function loadDashboardPages<T extends { id: string }>(
  loadPage: (query: { page: number; limit: number }) => Promise<DashboardPage<T>>,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + 30_000;
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 100; page += 1) {
    if (Date.now() >= deadline) throw new Error("Your dashboard took too long to load. Please try again.");
    const result = await loadPage({ page, limit: 100 });
    const pagination = result.pagination;
    if (!pagination || !Number.isSafeInteger(pagination.total) || pagination.total < 0 || pagination.page !== page) {
      throw new Error("Your complete dashboard could not be loaded. Please try again.");
    }
    expectedTotal ??= pagination.total;
    if (expectedTotal !== pagination.total) throw new Error("Your records changed while loading. Please refresh your dashboard.");
    for (const item of result.items) {
      if (!item.id || seen.has(item.id)) throw new Error("Your complete dashboard could not be loaded. Please try again.");
      seen.add(item.id);
      items.push(item);
    }
    if (!pagination.hasNextPage) {
      if (items.length !== expectedTotal) throw new Error("Your complete dashboard could not be loaded. Please try again.");
      return items;
    }
    if (result.items.length === 0 || items.length >= expectedTotal) throw new Error("Your complete dashboard could not be loaded. Please try again.");
  }
  throw new Error("Your dashboard has too many records to summarise. Open the full list to continue.");
}
