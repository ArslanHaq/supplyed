export type PlannedWorkUnits = { hours?: number | null; days?: number | null };
export const MAX_PLANNED_UNITS = 2147483647;

export function normalizeWorkUnits(value: PlannedWorkUnits | null | undefined) {
  const read = (unit: unknown): number | null => typeof unit === "number" && Number.isInteger(unit) && unit > 0 && unit <= MAX_PLANNED_UNITS ? unit : null;
  return { hours: read(value?.hours), days: read(value?.days) };
}

export function validateWorkUnits(input: PlannedWorkUnits & { payType?: string | null }, partial = false): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, payType] of [["hours", "hourly"], ["days", "daily"]] as const) {
    const value = input[field];
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > MAX_PLANNED_UNITS) errors[field] = "Enter a whole number from 1 to 2,147,483,647, or leave blank.";
    else if ((!partial || input.payType !== undefined) && input.payType !== payType) errors[field] = `Planned ${field} can only be used with ${payType} pay.`;
  }
  return errors;
}

/** Blank values explicitly clear units when editing; no duration is inferred. */
export function plannedUnitsInput(payType: string, hours: string, days: string): PlannedWorkUnits {
  return { hours: payType === "hourly" && hours.trim() ? Number(hours) : null, days: payType === "daily" && days.trim() ? Number(days) : null };
}

export function formatPlannedUnits(value: PlannedWorkUnits): string {
  const { hours, days } = normalizeWorkUnits(value);
  if (hours !== null) return `${hours.toLocaleString("en-GB")} planned ${hours === 1 ? "hour" : "hours"}`;
  if (days !== null) return `${days.toLocaleString("en-GB")} planned ${days === 1 ? "day" : "days"}`;
  return "Not specified";
}
