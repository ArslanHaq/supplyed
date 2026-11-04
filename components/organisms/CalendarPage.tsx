import { useMemo, useState } from "react";
import { useAvailability, useUpdateAvailability } from "@/features/availability/use-availability";
import type { TeacherAvailability } from "@/features/availability/types";
import { scheduleIntervals } from "@/features/jobs/job-schedule";
import type { JobSchedule } from "@/types/supplyed";
import { Btn } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { WorkScheduleEditor } from "../molecules/WorkScheduleEditor";

type CalendarView = "month" | "week" | "day";
const DEFAULT: TeacherAvailability = {
  timeZone: "Europe/London",
  weeklySchedule: { weekdays: [1, 2, 3, 4, 5].map((day) => ({ day, slots: [{ start: "08:00", end: "18:00" }] })) },
  exceptions: [],
};

export function CalendarPage() {
  const query = useAvailability();
  const update = useUpdateAvailability();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [draftOverride, setDraft] = useState<TeacherAvailability | null>(null);
  const [notice, setNotice] = useState<string>();
  const savedDraft = query.data?.availability ? normalizeAvailability(query.data.availability) : DEFAULT;
  const draft = draftOverride ?? savedDraft;

  const range = useMemo(() => viewRange(cursor, view), [cursor, view]);
  const days = useMemo(() => calendarDays(range.start, range.end), [range]);
  const availabilitySchedule: JobSchedule = { ...draft.weeklySchedule, exceptions: draft.exceptions };
  const availableDates = new Set(scheduleIntervals(availabilitySchedule, range.start, range.end).map((item) => item.date));
  const bookingsByDate = bookingDates(query.data?.bookings ?? []);

  function reset() {
    setDraft(null);
    setNotice("Unsaved changes discarded.");
  }
  async function save() {
    const result = await update.mutateAsync(draft);
    if (result.ok) setDraft(null);
    setNotice(result.ok ? "Availability saved. Active applications were rechecked for conflicts." : result.message);
  }
  function setSelectedException(kind: "exclude" | "replace" | "add") {
    const current = draft.exceptions.filter((item) => item.date !== selectedDate);
    const next: NonNullable<JobSchedule["exceptions"]>[number] = kind === "exclude"
      ? { date: selectedDate, kind }
      : { date: selectedDate, kind, slots: [{ start: "09:00", end: "15:30" }] };
    setDraft({ ...draft, exceptions: [...current, next].sort((a, b) => a.date.localeCompare(b.date)) });
  }

  if (query.isLoading) return <div className="app-page calendar-page"><PageHead title="Availability calendar" /><SectionLoader rows={7} /></div>;
  if (query.error) return <div className="app-page calendar-page"><PageHead title="Availability calendar" /><div className="card card-pad-lg"><p className="text-danger">{query.error.message || "Availability could not be loaded."}</p><Btn className="mt-4" onClick={() => void query.refetch()}>Try again</Btn></div></div>;

  return <div className="app-page calendar-page">
    <PageHead title="Availability calendar" subtitle="Saved availability is authoritative for applications and confirmed bookings." actions={<div className="flex gap-2"><Btn variant="secondary" disabled={update.isPending} onClick={reset}>Cancel</Btn><Btn disabled={update.isPending} loading={update.isPending} loadingLabel="Saving" onClick={() => void save()}>Save changes</Btn></div>} />
    {!query.data?.availability ? <p className="mb-4 rounded-xl border border-warning bg-warning-tint p-4 text-sm">No explicit availability has been saved yet, so your legacy account remains unrestricted. Saving creates an explicit weekly schedule.</p> : null}
    {notice ? <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm" role="status">{notice}</p> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
      <section className="calendar-board card card-pad-lg">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="workspace-kicker">Your schedule</p><h2 className="font-heading text-2xl">{range.label}</h2></div>
          <div className="flex flex-wrap gap-2">
            {(["month", "week", "day"] as const).map((item) => <Btn key={item} size="sm" variant={view === item ? "primary" : "secondary"} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</Btn>)}
            <Btn aria-label="Previous period" size="sm" variant="secondary" onClick={() => setCursor(shift(cursor, view, -1))}>Prev</Btn><Btn aria-label="Next period" size="sm" variant="secondary" onClick={() => setCursor(shift(cursor, view, 1))}>Next</Btn>
          </div>
        </div>
        <div className={`grid gap-2 ${view === "month" || view === "week" ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7" : "grid-cols-1"}`}>
          {days.map((date) => {
            const booked = bookingsByDate.get(date) ?? [];
            const available = availableDates.has(date);
            const conflict = booked.length > 0 && !available;
            return <button aria-label={`${displayDate(date)}, ${available ? "available" : "unavailable"}${booked.length ? `, ${booked.length} confirmed booking` : ""}`} className={`min-h-28 rounded-xl border p-3 text-left transition ${selectedDate === date ? "border-brand ring-2 ring-brand/20" : "border-border"} ${conflict ? "bg-danger-tint" : booked.length ? "bg-purple-tint" : available ? "bg-brand-tint" : "bg-chalk"}`} key={date} onClick={() => setSelectedDate(date)} type="button">
              <span className="block text-sm font-semibold">{displayDate(date)}</span>
              <span className="mt-2 block text-xs font-medium">{available ? "Available" : "Unavailable"}</span>
              {booked.map((title) => <span className="mt-1 block truncate rounded bg-surface px-2 py-1 text-xs" key={title}>Confirmed · {title}</span>)}
              {conflict ? <span className="mt-1 block text-xs font-semibold text-danger">Conflict: booking outside availability</span> : null}
            </button>;
          })}
        </div>
        <div className="mt-5 flex flex-wrap gap-4 text-xs"><Legend color="bg-brand-tint" label="Available" /><Legend color="bg-chalk" label="Unavailable" /><Legend color="bg-purple-tint" label="Confirmed booking" /><Legend color="bg-danger-tint" label="Conflict" /></div>
        <div className="mt-5 rounded-xl border border-border p-4"><div className="text-sm font-semibold">{displayDate(selectedDate)} actions</div><div className="mt-3 flex flex-wrap gap-2"><Btn size="sm" variant="secondary" onClick={() => setSelectedException("replace")}>Set changed hours</Btn><Btn size="sm" variant="secondary" onClick={() => setSelectedException("add")}>Add hours</Btn><Btn size="sm" variant="secondary" onClick={() => setSelectedException("exclude")}>Mark unavailable</Btn><Btn size="sm" variant="ghost" onClick={() => setDraft({ ...draft, exceptions: draft.exceptions.filter((item) => item.date !== selectedDate) })}>Use recurring schedule</Btn></div></div>
        <div className="mt-5 space-y-2 md:hidden"><h3 className="text-sm font-semibold">Mobile agenda</h3>{days.filter((date) => availableDates.has(date) || bookingsByDate.has(date)).map((date) => <div className="rounded-lg border border-border p-3 text-sm" key={date}><strong>{displayDate(date)}</strong><span className="ml-2 text-muted">{bookingsByDate.has(date) ? `Confirmed: ${bookingsByDate.get(date)!.join(", ")}` : "Available"}</span></div>)}</div>
      </section>
      <aside className="card card-pad-lg self-start xl:sticky xl:top-6">
        <h2 className="font-heading text-xl">Recurring availability</h2><p className="mt-1 text-xs leading-5 text-muted">Private reasons are never shared. Schools only see whether required work conflicts.</p>
        <div className="mt-4"><WorkScheduleEditor value={availabilitySchedule} onChange={(value) => setDraft({ ...draft, weeklySchedule: { weekdays: value.weekdays }, exceptions: value.exceptions ?? [] })} /></div>
      </aside>
    </div>
  </div>;
}

function bookingDates(bookings: Array<{ startDate: string | null; endDate: string | null; schedule: JobSchedule | null; job: { title: string } }>) {
  const result = new Map<string, string[]>();
  for (const booking of bookings) {
    if (!booking.startDate || !booking.endDate) continue;
    const dates = booking.schedule ? [...new Set(scheduleIntervals(booking.schedule, booking.startDate, booking.endDate).map((item) => item.date))] : calendarDays(booking.startDate.slice(0, 10), booking.endDate.slice(0, 10));
    for (const date of dates) result.set(date, [...(result.get(date) ?? []), booking.job.title]);
  }
  return result;
}
function normalizeAvailability(value: TeacherAvailability): TeacherAvailability { return { ...value, weeklySchedule: value.weeklySchedule ?? { weekdays: [] }, exceptions: value.exceptions ?? [] }; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-2"><i className={`h-3 w-3 rounded border border-border ${color}`} />{label}</span>; }
function isoDate(date: Date) { return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10); }
function displayDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short" }).format(new Date(`${value}T12:00:00Z`)); }
function calendarDays(start: string, end: string) { const result: string[] = []; for (let stamp = Date.parse(`${start}T12:00:00Z`); stamp <= Date.parse(`${end}T12:00:00Z`); stamp += 86_400_000) result.push(new Date(stamp).toISOString().slice(0, 10)); return result; }
function shift(date: Date, view: CalendarView, amount: number) { const next = new Date(date); if (view === "month") next.setMonth(next.getMonth() + amount); else next.setDate(next.getDate() + amount * (view === "week" ? 7 : 1)); return next; }
function viewRange(cursor: Date, view: CalendarView) {
  const base = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
  if (view === "day") { const date = base.toISOString().slice(0, 10); return { start: date, end: date, label: displayDate(date) }; }
  if (view === "week") { base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7)); const end = new Date(base); end.setUTCDate(end.getUTCDate() + 6); return { start: base.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: `${displayDate(base.toISOString().slice(0, 10))} – ${displayDate(end.toISOString().slice(0, 10))}` }; }
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)); const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(start) };
}
