"use client";

import { useId } from "react";
import { Field } from "../atoms";
import { hourlyWorkSummary } from "@/features/jobs/schedule-editor";

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
  const summary = hourlyWorkSummary(startDate, endDate, timeZone);
  const hours = summary?.hours ?? NaN;
  const formatHours = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  return (
    <fieldset className="col-span-full min-w-0 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-ink">Working hours</legend>
      <p className="mb-4 text-xs leading-5 text-muted">These working times apply each day from the start date through the end date. Time between daily shifts is not counted. Times are in {timeZone === "Europe/London" ? "UK local time (GMT / BST)" : timeZone}.</p>
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
              <Field label={`Daily ${label.toLowerCase()} time`} htmlFor={`${id}-${field}-time`} required={required}>
                <input className="input" id={`${id}-${field}-time`} type="time" disabled={!date} required={required || Boolean(date)} value={time} onChange={event => onChange(field, `${date}T${event.target.value}`)} />
              </Field>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {summary && hours > 0
          ? `${formatHours(summary.hoursPerDay)} hours per day × ${summary.days} ${summary.days === 1 ? "day" : "days"} = ${formatHours(hours)} total working hours.`
          : hours === 0 ? "The start and end time are the same. Planned hours can be left blank."
          : hours < 0 ? "Choose a daily end time on or after the daily start time."
          : "Choose start and end times to see the duration."}
      </p>
    </fieldset>
  );
}
