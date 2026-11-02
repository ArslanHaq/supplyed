import { useMemo, useState } from "react";
import type { ScheduleConflict } from "@/features/availability/types";
import { scheduleIntervals } from "@/features/jobs/job-schedule";
import type { Job } from "@/types/supplyed";
import { Btn, Icon } from "../atoms";

type ScheduledShift = { date: string; start: string; end: string; minutes: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function JobScheduleCalendar({ job, conflicts = [] }: { job: Job; conflicts?: ScheduleConflict[] }) {
  const shifts = useMemo(() => scheduledShifts(job), [job]);
  const shiftsByDate = useMemo(() => groupShifts(shifts), [shifts]);
  const scheduledDates = [...shiftsByDate.keys()].sort();
  const firstDate = scheduledDates[0] ?? job.startDate?.slice(0, 10) ?? today();
  const lastDate = scheduledDates.at(-1) ?? job.endDate?.slice(0, 10) ?? firstDate;
  const firstMonth = firstDate.slice(0, 7);
  const lastMonth = lastDate.slice(0, 7);
  const [month, setMonth] = useState(firstMonth);
  const [selectedDate, setSelectedDate] = useState(firstDate);
  const visibleDays = monthGrid(month);
  const selectedShifts = shiftsByDate.get(selectedDate) ?? [];
  const timeZone = job.timeZone ?? "Europe/London";
  const conflictsByDate = useMemo(() => groupConflicts(conflicts, timeZone), [conflicts, timeZone]);
  const selectedConflicts = conflictsByDate.get(selectedDate) ?? [];
  const exceptions = new Map((job.schedule?.exceptions ?? []).map((exception) => [exception.date, exception]));
  const totalMinutes = shifts.reduce((sum, shift) => sum + shift.minutes, 0);
  const workingDays = shiftsByDate.size;

  return (
    <section className="card card-pad-lg mb-5 overflow-hidden" aria-labelledby="job-schedule-title">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand"><Icon name="calendar" size={15} />Your schedule if selected</div>
          <h2 className="mt-2 font-heading text-2xl" id="job-schedule-title">When this job will occupy your calendar</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Every highlighted day is required by this job. Select a day to see its exact hours, including split shifts and changed-date hours.</p>
        </div>
        <span className="rounded-full border border-brand/30 bg-brand-tint px-3 py-1.5 text-xs font-semibold text-brand">{job.timeZone ?? "Europe/London"}</span>
      </div>

      <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Assignment type" value={job.assignmentDuration === "EXTENDED" ? "Extended Assignment" : "Short-Term Assignment"} />
        <Summary label="Working days" value={workingDays ? workingDays.toLocaleString("en-GB") : "Not specified"} />
        <Summary label="Scheduled hours" value={totalMinutes ? hoursLabel(totalMinutes) : "Not specified"} />
        <Summary label="Estimated total" value={job.scheduleSummary ? money(job.scheduleSummary.totalAmountPence, job.currency) : job.payType === "fixed" ? money(Math.round(job.rate * 100), job.currency) : "Not available"} />
      </div>

      {!job.schedule ? (
        <div>
          <div className="rounded-xl border border-warning bg-warning-tint p-4 text-sm leading-6">
            <strong>Legacy date-only schedule.</strong> This job records {formatDateRange(firstDate, lastDate)}, but exact recurring working days and hours were not saved. The calendar below shows the assignment window, not confirmed occupied shifts. Confirm the hours with the school before accepting.
          </div>
          <div className="mt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Recorded assignment window</div><h3 className="mt-1 font-heading text-xl">{monthLabel(month)}</h3></div>
              <div className="flex gap-2"><Btn disabled={month <= firstMonth} size="sm" variant="secondary" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</Btn><Btn disabled={month >= lastMonth} size="sm" variant="secondary" onClick={() => setMonth(shiftMonth(month, 1))}>Next</Btn></div>
            </div>
            <div className="grid grid-cols-7 gap-1.5" aria-label={`${monthLabel(month)} legacy assignment window`}>
              {WEEKDAYS.map((day) => <div className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted" key={day}>{day}</div>)}
              {visibleDays.map((date, index) => date ? <div className={`min-h-20 rounded-lg border p-2 ${date >= firstDate && date <= lastDate ? "border-warning bg-warning-tint" : "border-border bg-surface"}`} key={date}><span className="text-xs font-semibold">{Number(date.slice(8, 10))}</span>{date >= firstDate && date <= lastDate ? <><span className="mt-2 block text-[10px] font-semibold uppercase text-warning">Date range</span><span className="mt-1 block text-[10px] leading-4 text-muted">Hours not recorded</span></> : null}</div> : <div aria-hidden="true" className="min-h-20 rounded-lg bg-chalk/30" key={`legacy-blank-${index}`} />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Required work calendar</div><h3 className="mt-1 font-heading text-xl">{monthLabel(month)}</h3></div>
              <div className="flex gap-2">
                <Btn aria-label="Show previous schedule month" disabled={month <= firstMonth} size="sm" variant="secondary" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</Btn>
                <Btn aria-label="Show next schedule month" disabled={month >= lastMonth} size="sm" variant="secondary" onClick={() => setMonth(shiftMonth(month, 1))}>Next</Btn>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5" aria-label={`${monthLabel(month)} required job schedule`}>
              {WEEKDAYS.map((day) => <div className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted" key={day}>{day}</div>)}
              {visibleDays.map((date, index) => {
                if (!date) return <div aria-hidden="true" className="min-h-24 rounded-lg bg-chalk/30" key={`blank-${index}`} />;
                const dayShifts = shiftsByDate.get(date) ?? [];
                const occupied = dayShifts.length > 0;
                const dayConflicts = conflictsByDate.get(date) ?? [];
                const conflict = dayConflicts.length > 0;
                const exception = exceptions.get(date);
                return (
                  <button
                    aria-label={`${longDate(date)}. ${occupied ? `${dayShifts.length} required shift${dayShifts.length === 1 ? "" : "s"}: ${dayShifts.map(shiftLabel).join(", ")}` : "No work required"}${conflict ? ". Conflicts with your calendar" : ""}`}
                    aria-current={selectedDate === date ? "date" : undefined}
                    className={`min-h-24 min-w-0 rounded-lg border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selectedDate === date ? "ring-2 ring-brand/30" : ""} ${conflict ? "border-danger bg-danger-tint" : occupied ? "border-brand/40 bg-brand-tint" : "border-border bg-surface"}`}
                    key={date}
                    onClick={() => { setSelectedDate(date); if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7)); }}
                    type="button"
                  >
                    <span className={`block text-xs font-semibold ${occupied ? "text-ink" : "text-muted"}`}>{Number(date.slice(8, 10))}</span>
                    {occupied ? <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-brand">Occupied</span> : <span className="mt-1 block text-[10px] text-muted">Free from this job</span>}
                    {dayShifts.slice(0, 2).map((shift, shiftIndex) => <span className="mt-1 block truncate rounded bg-surface/90 px-1.5 py-1 text-[10px] font-medium" key={`${date}-${shiftIndex}`}>{shiftLabel(shift)}</span>)}
                    {dayShifts.length > 2 ? <span className="mt-1 block text-[10px] font-semibold">+{dayShifts.length - 2} more</span> : null}
                    {exception ? <span className="mt-1 block text-[10px] font-semibold text-purple">{exception.kind === "add" ? "Extra hours" : exception.kind === "replace" ? "Changed hours" : "Excluded"}</span> : null}
                    {conflict ? <span className="mt-1 block text-[10px] font-semibold text-danger">{dayConflicts.length} {dayConflicts.length === 1 ? "conflict" : "conflicts"}</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted"><Legend className="border-brand/40 bg-brand-tint" label="Occupied by this job" /><Legend className="border-border bg-surface" label="No work for this job" /><Legend className="border-danger bg-danger-tint" label="Your calendar conflicts" /></div>
          </div>

          <aside className="rounded-xl border border-border bg-chalk/40 p-4" aria-live="polite">
            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Selected day</div>
            <h3 className="mt-1 font-heading text-xl">{longDate(selectedDate)}</h3>
            {selectedShifts.length ? <>
              <div className="mt-4 space-y-2">{selectedShifts.map((shift, index) => <div className="rounded-lg border border-border bg-surface p-3" key={`${shift.start}-${index}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">Shift {index + 1}</span><span className="text-sm font-semibold text-brand">{shiftLabel(shift)}</span></div><div className="mt-1 text-xs text-muted">{hoursLabel(shift.minutes)}</div></div>)}</div>
              <div className="mt-4 border-t border-border pt-4"><Detail label="Total occupied time" value={hoursLabel(selectedShifts.reduce((sum, shift) => sum + shift.minutes, 0))} /><Detail label="Estimated earnings" value={dayEarnings(job, selectedShifts)} /><Detail label="Release plan" value={releaseLabel(job.paymentFrequency)} /></div>
              {selectedConflicts.length ? <div className="mt-4 space-y-2" role="alert"><div className="text-xs font-semibold uppercase tracking-[0.08em] text-danger">Why this day conflicts</div>{selectedConflicts.map((conflict, index) => <ConflictDetail conflict={conflict} key={`${conflict.type}-${conflict.start}-${conflict.conflictingStart ?? index}`} timeZone={timeZone} />)}</div> : null}
            </> : <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm leading-6 text-muted">This job does not require you to work on this date.</div>}
          </aside>
        </div>
      )}

      {shifts.length ? <div className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-semibold">Complete work agenda</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{scheduledDates.map((date) => { const dayConflicts = conflictsByDate.get(date) ?? []; return <button className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm ${dayConflicts.length ? "border-danger/40 bg-danger-tint hover:border-danger" : "border-border bg-surface hover:border-brand"}`} key={date} onClick={() => { setSelectedDate(date); setMonth(date.slice(0, 7)); }} type="button"><span><strong className="block">{longDate(date)}</strong><span className="mt-1 block text-xs text-muted">{(shiftsByDate.get(date) ?? []).map(shiftLabel).join(" · ")}</span>{dayConflicts.length ? <span className="mt-1 block text-xs font-semibold text-danger">{dayConflicts.length} schedule {dayConflicts.length === 1 ? "conflict" : "conflicts"}</span> : null}</span><span className={`shrink-0 text-xs font-semibold ${dayConflicts.length ? "text-danger" : "text-brand"}`}>{hoursLabel((shiftsByDate.get(date) ?? []).reduce((sum, shift) => sum + shift.minutes, 0))}</span></button>; })}</div></div> : null}
    </section>
  );
}

function scheduledShifts(job: Job): ScheduledShift[] {
  if (!job.schedule || !job.startDate || !job.endDate) return [];
  return scheduleIntervals(job.schedule, job.startDate, job.endDate);
}
function groupShifts(shifts: ScheduledShift[]) { const groups = new Map<string, ScheduledShift[]>(); for (const shift of shifts) groups.set(shift.date, [...(groups.get(shift.date) ?? []), shift]); return groups; }
function groupConflicts(conflicts: ScheduleConflict[], timeZone: string) { const groups = new Map<string, ScheduleConflict[]>(); for (const conflict of conflicts) { const date = conflict.date || localDate(conflict.start, timeZone); groups.set(date, [...(groups.get(date) ?? []), conflict]); } return groups; }
function monthGrid(month: string): Array<string | null> { const [year, monthNumber] = month.split("-").map(Number); const first = new Date(Date.UTC(year, monthNumber - 1, 1)); const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(); const mondayOffset = (first.getUTCDay() + 6) % 7; const blanks = Array.from({ length: mondayOffset }, (): null => null); const dates = Array.from({ length: count }, (_, index) => `${year}-${String(monthNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`); return [...blanks, ...dates]; }
function shiftMonth(month: string, amount: number) { const [year, value] = month.split("-").map(Number); const date = new Date(Date.UTC(year, value - 1 + amount, 1)); return date.toISOString().slice(0, 7); }
function monthLabel(month: string) { return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`)); }
function longDate(date: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", weekday: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatDateRange(start: string, end: string) { return start === end ? longDate(start) : `${longDate(start)} to ${longDate(end)}`; }
function shiftLabel(shift: ScheduledShift) { return `${clockLabel(shift.start)}–${clockLabel(shift.end)}`; }
function clockLabel(value: string) { const [hour, minute] = value.split(":").map(Number); const displayHour = hour % 12 || 12; return `${displayHour}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`; }
function hoursLabel(minutes: number) { const hours = Math.floor(minutes / 60); const remainder = minutes % 60; return remainder ? `${hours ? `${hours}h ` : ""}${remainder}m` : `${hours}h`; }
function money(pence: number, currency = "GBP") { return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(pence / 100); }
function releaseLabel(value: Job["paymentFrequency"]) { return value === "completion" ? "On completion" : value === "milestone" ? "By agreed milestones" : value ? `${value[0].toUpperCase()}${value.slice(1)} periods` : "Existing invoice process"; }
function dayEarnings(job: Job, shifts: ScheduledShift[]) { if (job.payType === "fixed") return `Included in ${money(Math.round(job.rate * 100), job.currency)} fixed total`; if (job.payType === "daily") return money(Math.round(job.rate * 100), job.currency); return money(Math.round(shifts.reduce((sum, shift) => sum + shift.minutes, 0) * Math.round(job.rate * 100) / 60), job.currency); }
function localDate(value: string, timeZone: string) { const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)).map((part) => [part.type, part.value])); return `${parts.year}-${parts.month}-${parts.day}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function ConflictDetail({ conflict, timeZone }: { conflict: ScheduleConflict; timeZone: string }) {
  const required = instantRange(conflict.start, conflict.end, timeZone);
  const occupied = conflict.conflictingStart && conflict.conflictingEnd ? instantRange(conflict.conflictingStart, conflict.conflictingEnd, timeZone) : null;
  const overlap = conflict.conflictingStart && conflict.conflictingEnd ? instantRange(new Date(Math.max(Date.parse(conflict.start), Date.parse(conflict.conflictingStart))).toISOString(), new Date(Math.min(Date.parse(conflict.end), Date.parse(conflict.conflictingEnd))).toISOString(), timeZone) : null;
  return <article className="rounded-lg border border-danger/30 bg-danger-tint p-3 text-xs leading-5 text-graphite"><strong className="block text-danger">{conflict.type === "BOOKING_CONFLICT" ? `Confirmed booking conflict${conflict.bookingTitle ? `: ${conflict.bookingTitle}` : ""}` : "Outside your saved availability"}</strong><div className="mt-1"><span className="text-muted">This job requires:</span> <b>{required}</b></div>{occupied ? <><div><span className="text-muted">Your booking occupies:</span> <b>{occupied}</b></div><div><span className="text-muted">Actual overlap:</span> <b className="text-danger">{overlap}</b></div></> : <p className="mt-1">Your saved working hours do not fully cover this required shift.</p>}</article>;
}
function instantRange(start: string, end: string, timeZone: string) { const first = new Date(start); const last = new Date(end); const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }); if (localDate(start, timeZone) === localDate(end, timeZone)) return `${time.format(first)}–${time.format(last)}`; const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone }); return `${dateTime.format(first)}–${dateTime.format(last)}`; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-chalk/40 p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 font-semibold leading-5 text-ink">{value}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="mb-2 flex items-start justify-between gap-3 text-sm"><span className="text-muted">{label}</span><strong className="text-right">{value}</strong></div>; }
function Legend({ className, label }: { className: string; label: string }) { return <span className="flex items-center gap-2"><i className={`h-3 w-3 rounded border ${className}`} />{label}</span>; }
