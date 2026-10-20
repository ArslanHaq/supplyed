"use client";

import { Field } from "../atoms";
import { MAX_PLANNED_UNITS, validateWorkUnits } from "@/features/jobs/work-units";

export function PlannedWorkUnitsField({ payType, hours, days, errors, onChange }: {
  payType: string; hours: string; days: string;
  errors?: { hours?: string; days?: string };
  onChange: (field: "hours" | "days", value: string) => void;
}) {
  if (payType !== "hourly" && payType !== "daily") return null;
  const field = payType === "hourly" ? "hours" : "days";
  const value = field === "hours" ? hours : days;
  const error = errors?.[field] || validateWorkUnits({ payType, [field]: value.trim() ? Number(value) : null })[field];
  return <Field label={`Total planned ${field} (optional)`} error={error} hint={`${field === "hours" ? "Daily working hours multiplied by the number of selected days. Editing this total adjusts the daily end time and keeps your dates" : "Counts both the start and end day. Editing this total adjusts the work end date"}. Use whole numbers, or leave blank. Invoices use actual work submitted later.`}>
    <input className="input" type="number" min={1} max={MAX_PLANNED_UNITS} step={1} value={value} placeholder={field === "hours" ? "e.g. 4" : "e.g. 1"} onChange={event => onChange(field, event.target.value)} />
  </Field>;
}
