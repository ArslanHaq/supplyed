import type { JobPayType, JobSchedule, PaymentFrequency } from "@/types/supplyed";

const DAY_MS = 86_400_000;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const WHOLE_HOUR_TIME = /^(?:[01]\d|2[0-3]):00$/;

export type SchedulePreview = {
  assignmentDuration: "SHORT_TERM" | "EXTENDED";
  workingDays: number;
  totalMinutes: number;
  totalAmountPence: number;
  periods: Array<{ label: string; amountPence: number | null; minutes: number; workingDays: number }>;
};

export function validateStructuredSchedule(schedule: JobSchedule | undefined, startDate?: string, endDate?: string) {
  if (!schedule) return "Add the working weekdays and hours.";
  if (!schedule.weekdays.length) return "Choose at least one working weekday.";
  const days = new Set<number>();
  for (const weekday of schedule.weekdays) {
    if (!Number.isInteger(weekday.day) || weekday.day < 0 || weekday.day > 6 || days.has(weekday.day)) return "Each weekday can appear once.";
    days.add(weekday.day);
    const error = slotsError(weekday.slots);
    if (error) return error;
  }
  const exceptionDates = new Set<string>();
  for (const exception of schedule.exceptions ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.date) || exceptionDates.has(exception.date)) return "Each date exception must use one unique date.";
    exceptionDates.add(exception.date);
    if (exception.kind !== "exclude") {
      const error = slotsError(exception.slots ?? []);
      if (error) return error;
    }
  }
  if (startDate && endDate && !scheduleIntervals(schedule, startDate, endDate).length) return "The selected dates and weekdays do not produce any work shifts.";
  return undefined;
}

/** Convert older draft schedules to the whole-hour contract used by the posting form. */
export function normalizeScheduleToWholeHours(schedule: JobSchedule): JobSchedule {
  const normalizeSlots = (slots: Array<{ start: string; end: string }>) => slots.map((slot) => ({
    start: wholeHour(slot.start, "start"),
    end: wholeHour(slot.end, "end"),
  }));
  return {
    weekdays: schedule.weekdays.map((weekday) => ({ ...weekday, slots: normalizeSlots(weekday.slots) })),
    exceptions: (schedule.exceptions ?? []).map((exception) => exception.kind === "exclude"
      ? { ...exception }
      : { ...exception, slots: normalizeSlots(exception.slots ?? []) }),
  };
}

export function schedulePreview(input: {
  schedule: JobSchedule; startDate: string; endDate: string; payType: JobPayType;
  payAmount: number; paymentFrequency: PaymentFrequency;
  periodAnchor?: "ASSIGNMENT_START" | "CALENDAR";
}): SchedulePreview | null {
  const intervals = scheduleIntervals(input.schedule, input.startDate, input.endDate);
  if (!intervals.length) return null;
  const ratePence = Math.round(input.payAmount * 100);
  const dates = [...new Set(intervals.map((item) => item.date))];
  const totalMinutes = intervals.reduce((sum, item) => sum + item.minutes, 0);
  const amount = (items: typeof intervals) => input.payType === "fixed"
    ? ratePence
    : input.payType === "daily"
      ? new Set(items.map((item) => item.date)).size * ratePence
      : Math.round(items.reduce((sum, item) => sum + item.minutes, 0) * ratePence / 60);
  const groups = new Map<string, typeof intervals>();
  for (const item of intervals) {
    const day = Math.floor((Date.parse(`${item.date}T00:00:00Z`) - Date.parse(`${intervals[0].date}T00:00:00Z`)) / DAY_MS);
    const calendarWeek = addDays(item.date, -((new Date(`${item.date}T12:00:00Z`).getUTCDay() + 6) % 7));
    const key = input.paymentFrequency === "hourly" ? `${item.date}-${item.start}`
      : input.paymentFrequency === "daily" ? item.date
      : input.paymentFrequency === "weekly" ? input.periodAnchor === "CALENDAR" ? `Week of ${calendarWeek}` : `Week ${Math.floor(day / 7) + 1}`
      : input.paymentFrequency === "monthly" ? input.periodAnchor === "CALENDAR" ? item.date.slice(0, 7) : `Month ${monthIndex(intervals[0].date, item.date) + 1}`
      : input.paymentFrequency === "milestone" ? "Milestones" : "On completion";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const start = input.startDate.slice(0, 10);
  const exactMonth = addMonths(start, 1);
  return {
    assignmentDuration: input.endDate.slice(0, 10) >= exactMonth ? "EXTENDED" : "SHORT_TERM",
    workingDays: dates.length,
    totalMinutes,
    totalAmountPence: amount(intervals),
    periods: [...groups.entries()].map(([label, items]) => ({
      label, minutes: items.reduce((sum, item) => sum + item.minutes, 0),
      workingDays: new Set(items.map((item) => item.date)).size,
      amountPence: input.paymentFrequency === "milestone" ? null : amount(items),
    })),
  };
}

export function scheduleIntervals(schedule: JobSchedule, startDate: string, endDate: string) {
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return [];
  const weekdays = new Map(schedule.weekdays.map((item) => [item.day, item.slots]));
  const exceptions = new Map((schedule.exceptions ?? []).map((item) => [item.date, item]));
  const intervals: Array<{ date: string; start: string; end: string; minutes: number }> = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const exception = exceptions.get(date);
    const recurring = weekdays.get(new Date(`${date}T12:00:00Z`).getUTCDay()) ?? [];
    const slots = exception?.kind === "exclude" ? [] : exception?.kind === "replace" ? exception.slots ?? [] : [...recurring, ...(exception?.slots ?? [])];
    for (const slot of slots) {
      const startMinutes = minutes(slot.start);
      let endMinutes = minutes(slot.end);
      if (endMinutes <= startMinutes) endMinutes += 1440;
      intervals.push({ date, start: slot.start, end: slot.end, minutes: endMinutes - startMinutes });
    }
  }
  return intervals;
}

export function allowedPaymentFrequencies(payType: JobPayType): PaymentFrequency[] {
  return payType === "fixed" ? ["completion", "milestone"] : payType === "daily" ? ["daily", "weekly", "monthly"] : ["hourly", "daily", "weekly", "monthly"];
}

function slotsError(slots: Array<{ start: string; end: string }>) {
  if (!slots.length) return "Add at least one time slot for every selected day.";
  const ranges = slots.map((slot) => ({ ...slot, startMinute: minutes(slot.start), endMinute: minutes(slot.end) + (slot.end <= slot.start ? 1440 : 0) }));
  if (ranges.some((slot) => !TIME.test(slot.start) || !TIME.test(slot.end) || slot.start === slot.end)) return "Use valid, non-zero start and end times.";
  if (ranges.some((slot) => !WHOLE_HOUR_TIME.test(slot.start) || !WHOLE_HOUR_TIME.test(slot.end))) return "Shift minutes must be 00; choose whole-hour start and end times.";
  ranges.sort((a, b) => a.startMinute - b.startMinute);
  if (ranges.some((slot, index) => index > 0 && slot.startMinute < ranges[index - 1].endMinute)) return "Time slots cannot overlap.";
  return undefined;
}

function wholeHour(value: string, boundary: "start" | "end") {
  if (!TIME.test(value)) return value;
  const [hour, minute] = value.split(":").map(Number);
  if (minute === 0) return value;
  const normalizedHour = boundary === "end" ? (hour + 1) % 24 : hour;
  return `${String(normalizedHour).padStart(2, "0")}:00`;
}

function minutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function addDays(value: string, days: number) { return new Date(Date.parse(`${value}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10); }
function addMonths(value: string, count: number) {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + count, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
function monthIndex(start: string, date: string) { let index = 0; while (date >= addMonths(start, index + 1)) index += 1; return index; }
