import { normalizeWorkUnits } from "@/features/jobs/work-units";
export type InstructorBookingDates = {
  id: string;
  hours?: number | null;
  days?: number | null;
  startDate: string;
  endDate: string;
};

/** Keep only the schedule fields used by school-facing teacher profiles. */
export function normalizeInstructorBookingDates(value: unknown): InstructorBookingDates[] | null {
  if (!Array.isArray(value)) return null;
  const bookings: InstructorBookingDates[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.trim()) return null;
    const start = typeof item.startDate === "string" ? Date.parse(item.startDate) : NaN;
    const end = typeof item.endDate === "string" ? Date.parse(item.endDate) : NaN;
    // Missing or malformed schedule data must not imply the teacher is free.
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    bookings.push({ ...normalizeWorkUnits(item), id: item.id, startDate: new Date(start).toISOString(), endDate: new Date(end).toISOString() });
  }
  return bookings.sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate) || a.id.localeCompare(b.id));
}
