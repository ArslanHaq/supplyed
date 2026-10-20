import { zonedDateTimeToIso } from "@/lib/zoned-date-time";
import { MAX_PLANNED_UNITS, plannedUnitsInput, validateWorkUnits } from "./work-units";

type Schedule = { startDate: string; endDate: string; payType: string; hours: string; days: string };
const dayMs = 86_400_000;

function localInput(instant: number, timeZone: string) {
  if (!Number.isFinite(instant) || !Number.isFinite(new Date(instant).getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  if (Number(parts.year) > 9999) return "";
  const value = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  // An ambiguous DST wall time cannot safely round-trip through this editor.
  return zonedDateTimeToIso(value, timeZone) ? value : "";
}

function endFromUnits(form: Schedule, units: number, timeZone: string): string {
  const start = zonedDateTimeToIso(form.startDate, timeZone);
  if (!start) return "";
  if (form.payType === "hourly") return localInput(Date.parse(start) + units * 3_600_000, timeZone);
  const day = Date.parse(`${form.startDate.slice(0, 10)}T00:00:00Z`) + (units - 1) * dayMs;
  if (!Number.isFinite(new Date(day).getTime())) return "";
  const calendar = new Date(day).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendar)) return "";
  const time = units === 1 && form.endDate.slice(11) < form.startDate.slice(11) ? form.startDate.slice(11) : form.endDate.slice(11) || form.startDate.slice(11);
  const end = `${calendar}T${time}`;
  return zonedDateTimeToIso(end, timeZone) ? end : "";
}

/** Only user edits synchronize values; loading saved agreed units never guesses them. */
export function syncWorkSchedule<T extends Schedule>(current: T, field: keyof T, value: T[keyof T], timeZone = "Europe/London"): T {
  const next = { ...current, [field]: value };
  if (!["startDate", "endDate", "payType", "hours", "days"].includes(String(field))) return next;
  if (next.payType !== "hourly") next.hours = "";
  if (next.payType !== "daily") next.days = "";
  if (next.payType !== "hourly" && next.payType !== "daily") return next;
  const unit = next.payType === "hourly" ? "hours" : "days";
  if (field === unit || (field === "startDate" && !next.endDate && next[unit])) {
    const count = Number(next[unit]);
    if (next[unit].trim() && Number.isInteger(count) && count > 0 && count <= MAX_PLANNED_UNITS) {
      const end = endFromUnits(next, count, timeZone);
      if (end) next.endDate = end;
    }
    return next;
  }
  const start = zonedDateTimeToIso(next.startDate, timeZone);
  const end = zonedDateTimeToIso(next.endDate, timeZone);
  if (!start || !end || Date.parse(end) < Date.parse(start)) {
    next[unit] = "";
    return next;
  }
  const count = unit === "hours"
    ? (Date.parse(end) - Date.parse(start)) / 3_600_000
    : (Date.parse(`${next.endDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${next.startDate.slice(0, 10)}T00:00:00Z`)) / dayMs + 1;
  // Equal instants remain valid: optional hourly units are blank, never zero.
  next[unit] = count > 0 ? String(count) : "";
  return next;
}

export function validateScheduleUnits(form: Schedule, timeZone = "Europe/London") {
  const errors = validateWorkUnits({ payType: form.payType, ...plannedUnitsInput(form.payType, form.hours, form.days) });
  const unit = form.payType === "hourly" ? "hours" : form.payType === "daily" ? "days" : null;
  if (unit && form[unit].trim() && !errors[unit] && zonedDateTimeToIso(form.startDate, timeZone) && !endFromUnits(form, Number(form[unit]), timeZone)) errors[unit] = "This total produces an invalid or ambiguous end date. Adjust the start time or total.";
  return errors;
}
