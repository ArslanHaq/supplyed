"use client";

import { useId } from "react";
import { Field } from "../atoms";
import { zonedDateTimeToIso } from "@/lib/zoned-date-time";

type Props = {
  startDate: string;
  endDate: string;
  onChange: (field: "startDate" | "endDate", value: string) => void;
  errors?: { startDate?: string; endDate?: string };
  minDate?: string;
  timeZone?: string;
  required?: boolean;
};

export function HourlyWorkSchedule({ startDate, endDate, onChange, errors, minDate, timeZone = "Europe/London", required }: Props) {
  const id = useId();
  const start = zonedDateTimeToIso(startDate, timeZone);
  const end = zonedDateTimeToIso(endDate, timeZone);
  const hours = start && end ? (Date.parse(end) - Date.parse(start)) / 3_600_000 : NaN;
  return (
    <fieldset className="col-span-full min-w-0 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-ink">Working hours</legend>
      <p className="mb-4 text-xs leading-5 text-muted">Hourly jobs can start and finish on the same date. Enter working times in {timeZone === "Europe/London" ? "UK local time (GMT / BST)" : timeZone}.</p>
      <div className="grid gap-x-4 sm:grid-cols-2">
        {(["startDate", "endDate"] as const).map(field => {
          const value = field === "startDate" ? startDate : endDate;
          const [date = "", time = ""] = value.split("T");
          const label = field === "startDate" ? "Start" : "End";
          const earliest = field === "endDate" && startDate.slice(0, 10) > (minDate ?? "") ? startDate.slice(0, 10) : minDate;
          return (
            <div key={field}>
              <Field label={`${label} date`} htmlFor={`${id}-${field}-date`} error={errors?.[field]} required={required}>
                <input className="input" id={`${id}-${field}-date`} type="date" min={earliest} required={required} value={date} onChange={event => onChange(field, event.target.value ? `${event.target.value}T${time || (field === "startDate" ? "09:00" : "17:00")}` : "")} />
              </Field>
              <Field label={`${label} time`} htmlFor={`${id}-${field}-time`} required={required}>
                <input className="input" id={`${id}-${field}-time`} type="time" disabled={!date} required={required || Boolean(date)} value={time} onChange={event => onChange(field, `${date}T${event.target.value}`)} />
              </Field>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {Number.isFinite(hours) && hours > 0
          ? `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(hours)} hours between start and end.`
          : hours === 0 ? "The start and end time are the same. Planned hours can be left blank."
          : hours < 0 ? "Choose an end time on or after the start time."
          : "Choose start and end times to see the duration."}
      </p>
    </fieldset>
  );
}
