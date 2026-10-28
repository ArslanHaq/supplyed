import type { Job } from "./types";

export const LISTING_TIME_ZONE = "Europe/London";
export function shiftCalendarDay(value: string, days: number): string {
  const instant = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(instant) ? new Date(instant + days * 86400000).toISOString().slice(0, 10) : "";
}
export type JobVisibilityLabel = "reserved" | "closed" | "draft" | "expired" | "filled" | "live" | "scheduled" | "suspended";

export function getJobVisibilityLabel(job: Pick<Job, "expiresAt" | "liveFrom" | "status">, now = Date.now()): JobVisibilityLabel {
  if (job.status === "SUSPENDED") return "suspended";
  if (job.status === "RESERVED") return "reserved";
  if (job.status === "FILLED") return "filled";
  if (job.status === "CLOSED") return "closed";
  if (job.status === "DRAFT" || !job.status) return "draft";
  if (job.status === "EXPIRED") return "expired";
  if (job.expiresAt && Date.parse(job.expiresAt) <= now) return "expired";
  if (job.liveFrom && Date.parse(job.liveFrom) > now) return "scheduled";
  return "live";
}

export function formatJobVisibilityLabel(value: JobVisibilityLabel) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function isJobOpenForApplications(job: Pick<Job, "status" | "liveFrom" | "expiresAt" | "startDate">, now = Date.now()) {
  return job.status === "ACTIVE" && getJobVisibilityLabel(job, now) === "live"
    && Boolean(job.startDate) && Date.parse(job.startDate!) > now;
}

export function ukCalendarDate(value: string | null | undefined, inclusiveLastDay = false): string {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISTING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(parsed - (inclusiveLastDay ? 1 : 0)));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function ukDateTimeInput(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISTING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatUkListingInstant(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LISTING_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

/** Date-only listing fields use UK midnight; expiry includes the selected day. */
export function listingCalendarInstant(value: string, boundary: "open" | "close"): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(value);
  const midnight = Date.parse(`${value}T00:00:00Z`) + (boundary === "close" ? 86400000 : 0);
  const offsetLabel = new Intl.DateTimeFormat("en-GB", { timeZone: LISTING_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(midnight)).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offsetLabel);
  const offsetMinutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1) : 0;
  return midnight - offsetMinutes * 60_000;
}
