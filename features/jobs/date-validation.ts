import { listingCalendarInstant } from "./listing-window";

type JobDates = { startDate?: string | null; endDate?: string | null; liveFrom?: string | null; expiresAt?: string | null };

export function validJobDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateJobDateOrder(input: JobDates): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ["startDate", "endDate", "liveFrom", "expiresAt"] as const) {
    if (input[key] && !validJobDate(input[key])) errors[key] = "Enter a valid date, or a date and time with a timezone.";
  }
  const start = input.startDate && !errors.startDate ? Date.parse(input.startDate) : NaN;
  const end = input.endDate && !errors.endDate ? Date.parse(input.endDate) : NaN;
  const open = input.liveFrom && !errors.liveFrom ? listingCalendarInstant(input.liveFrom, "open") : NaN;
  const close = input.expiresAt && !errors.expiresAt ? listingCalendarInstant(input.expiresAt, "close") : NaN;
  if (end < start) errors.endDate = "Work end must be on or after work start.";
  if (open >= start) {
    errors.startDate = "Work must start after the listing opens.";
    errors.liveFrom = "Live from must be before work starts.";
  }
  if (close <= open) errors.expiresAt = "Listing expiry must be on or after the live-from day, with a closing time after opening.";
  if (close > start) errors.expiresAt = "The listing must close by work start. Choose a final listing day before the work starts.";
  return errors;
}
