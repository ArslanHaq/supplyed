import { useState } from "react";
import type { JobSchedule, JobTimeSlot } from "@/types/supplyed";
import { Btn, Checkbox } from "../atoms";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_SLOT: JobTimeSlot = { start: "09:00", end: "15:00" };
const WHOLE_HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

export function WorkScheduleEditor({ value, onChange, error }: {
  value: JobSchedule; onChange: (value: JobSchedule) => void; error?: string;
}) {
  const [sameHours, setSameHours] = useState(true);
  const selected = new Map(value.weekdays.map((item) => [item.day, item.slots]));
  const updateDay = (day: number, slots: JobTimeSlot[] | null) => {
    const weekdays = value.weekdays.filter((item) => item.day !== day);
    if (slots) weekdays.push({ day, slots });
    onChange({ ...value, weekdays: weekdays.sort((a, b) => a.day - b.day) });
  };
  const updateSlots = (day: number, slots: JobTimeSlot[]) => {
    if (sameHours) onChange({ ...value, weekdays: value.weekdays.map((item) => ({ ...item, slots: slots.map((slot) => ({ ...slot })) })) });
    else updateDay(day, slots);
  };
  const commonSlots = value.weekdays[0]?.slots ?? [DEFAULT_SLOT];

  return (
    <section className="rounded-xl border border-border bg-chalk/30 p-4 md:col-span-2" aria-label="Working schedule">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold text-ink">Working weekdays and shifts</h3><p className="mt-1 text-xs leading-5 text-muted">Choose whole-hour times; minutes are always 00. Add split shifts separately. An end time earlier than the start is treated as an overnight shift.</p></div>
        <Checkbox checked={sameHours} label="Use the same hours for selected days" onChange={setSameHours} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {DAYS.map((label, day) => <Checkbox key={label} checked={selected.has(day)} label={label} onChange={(checked) => updateDay(day, checked ? commonSlots.map((slot) => ({ ...slot })) : null)} />)}
      </div>
      {sameHours && value.weekdays.length ? <SlotEditor label="Hours for all selected days" slots={commonSlots} onChange={(slots) => updateSlots(value.weekdays[0].day, slots)} /> : null}
      {!sameHours ? value.weekdays.map((item) => <SlotEditor key={item.day} label={DAYS[item.day]} slots={item.slots} onChange={(slots) => updateSlots(item.day, slots)} />) : null}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-semibold">Date exceptions</h4><p className="mt-1 text-xs text-muted">Add work, exclude a date, or replace that date&apos;s normal hours.</p></div><Btn size="sm" variant="secondary" onClick={() => onChange({ ...value, exceptions: [...(value.exceptions ?? []), { date: "", kind: "exclude" }] })}>Add exception</Btn></div>
        <div className="mt-3 space-y-3">
          {(value.exceptions ?? []).map((exception, index) => <div className="rounded-lg border border-border bg-surface p-3" key={`${exception.date}-${index}`}>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input aria-label="Exception date" className="input" type="date" value={exception.date} onChange={(event) => changeException(value, index, { ...exception, date: event.target.value }, onChange)} />
              <select aria-label="Exception action" className="input" value={exception.kind} onChange={(event) => changeException(value, index, { date: exception.date, kind: event.target.value as typeof exception.kind, ...(event.target.value === "exclude" ? {} : { slots: exception.slots?.length ? exception.slots : [{ ...DEFAULT_SLOT }] }) }, onChange)}><option value="exclude">No work</option><option value="replace">Changed hours</option><option value="add">Additional hours</option></select>
              <Btn size="sm" variant="ghost" onClick={() => onChange({ ...value, exceptions: value.exceptions?.filter((_, itemIndex) => itemIndex !== index) })}>Remove</Btn>
            </div>
            {exception.kind !== "exclude" ? <SlotEditor compact label={`${exception.kind === "add" ? "Additional" : "Replacement"} hours`} slots={exception.slots ?? [{ ...DEFAULT_SLOT }]} onChange={(slots) => changeException(value, index, { ...exception, slots }, onChange)} /> : null}
          </div>)}
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
    </section>
  );
}

function SlotEditor({ label, slots, onChange, compact = false }: { label: string; slots: JobTimeSlot[]; onChange: (slots: JobTimeSlot[]) => void; compact?: boolean }) {
  return <div className={compact ? "mt-3" : "mt-4 rounded-lg border border-border bg-surface p-3"}>
    <div className="mb-2 text-xs font-semibold text-muted">{label}</div>
    <div className="space-y-2">{slots.map((slot, index) => <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2" key={index}>
      <select aria-label={`${label} shift ${index + 1} start`} className="input" value={slot.start} onChange={(event) => onChange(slots.map((item, itemIndex) => itemIndex === index ? { ...item, start: event.target.value } : item))}>
        {WHOLE_HOURS.map((time) => <option key={time} value={time}>{time}</option>)}
      </select>
      <select aria-label={`${label} shift ${index + 1} end`} className="input" value={slot.end} onChange={(event) => onChange(slots.map((item, itemIndex) => itemIndex === index ? { ...item, end: event.target.value } : item))}>
        {WHOLE_HOURS.map((time) => <option key={time} value={time}>{time}</option>)}
      </select>
      <button aria-label={`Remove shift ${index + 1}`} className="rounded-md px-2 py-1 text-sm text-danger disabled:opacity-40" disabled={slots.length === 1} onClick={() => onChange(slots.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
    </div>)}</div>
    <button className="mt-2 text-xs font-semibold text-brand" onClick={() => onChange([...slots, { start: "16:00", end: "18:00" }])} type="button">+ Add another time slot</button>
  </div>;
}

function changeException(value: JobSchedule, index: number, next: NonNullable<JobSchedule["exceptions"]>[number], onChange: (value: JobSchedule) => void) {
  onChange({ ...value, exceptions: (value.exceptions ?? []).map((item, itemIndex) => itemIndex === index ? next : item) });
}
