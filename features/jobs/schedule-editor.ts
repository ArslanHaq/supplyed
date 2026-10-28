import { zonedDateTimeToIso } from "@/lib/zoned-date-time";
import { MAX_PLANNED_UNITS, plannedUnitsInput, validateWorkUnits } from "./work-units";

type Schedule = { startDate: string; endDate: string; payType: string; hours: string; days: string };
const dayMs = 86_400_000;

function calendarDays(startDate: string, endDate: string) {
  return (Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)) / dayMs + 1;
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.slice(11).split(":").map(Number);
  return hours * 60 + minutes;
}

/** The selected clock times apply on every calendar day, excluding the time between shifts. */
export function hourlyWorkSummary(startDate: string, endDate: string, timeZone = "Europe/London") {
  if (!zonedDateTimeToIso(startDate, timeZone) || !zonedDateTimeToIso(endDate, timeZone)) return null;
  const days = calendarDays(startDate, endDate);
  if (days < 1) return null;
  const minutesPerDay = clockMinutes(endDate) - clockMinutes(startDate);
  return { days, hoursPerDay: minutesPerDay / 60, hours: minutesPerDay * days / 60 };
}

function endFromUnits(form: Schedule, units: number, timeZone: string): string {
  const start = zonedDateTimeToIso(form.startDate, timeZone);
  if (!start) return "";
  if (form.payType === "hourly") {
    // Keep the selected working dates; distribute the total evenly across them.
    const endDay = form.endDate.slice(0, 10) || form.startDate.slice(0, 10);
    const days = calendarDays(form.startDate, endDay);
    const minutesPerDay = units * 60 / days;
    const endMinutes = clockMinutes(form.startDate) + minutesPerDay;
    if (days < 1 || !Number.isInteger(minutesPerDay) || endMinutes >= 1440) return "";
    const time = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    const end = `${endDay}T${time}`;
    return zonedDateTimeToIso(end, timeZone) ? end : "";
  }
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
    ? hourlyWorkSummary(next.startDate, next.endDate, timeZone)?.hours ?? 0
    : calendarDays(next.startDate, next.endDate);
  // Equal instants remain valid: optional hourly units are blank, never zero.
  next[unit] = count > 0 ? String(count) : "";
  return next;
}

export function validateScheduleUnits(form: Schedule, timeZone = "Europe/London") {
  const errors = validateWorkUnits({ payType: form.payType, ...plannedUnitsInput(form.payType, form.hours, form.days) });
  if (form.payType === "hourly") {
    const summary = hourlyWorkSummary(form.startDate, form.endDate, timeZone);
    if (summary && summary.hoursPerDay < 0) errors.endDate = "Daily end time must be on or after daily start time.";
  }
  const unit = form.payType === "hourly" ? "hours" : form.payType === "daily" ? "days" : null;
  if (unit && form[unit].trim() && !errors[unit] && zonedDateTimeToIso(form.startDate, timeZone) && !endFromUnits(form, Number(form[unit]), timeZone)) errors[unit] = unit === "hours"
    ? "Choose a total that fits the selected days with a daily end time before midnight, in whole minutes. Adjust the dates, start time or total."
    : "This total produces an invalid or ambiguous end date. Adjust the start time or total.";
  return errors;
}
