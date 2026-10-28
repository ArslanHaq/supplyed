import { ApiError } from "./api-error";

type Rule = { maxLength?: number; min?: number; max?: number; integer?: boolean; values?: readonly string[]; date?: boolean; uuid?: boolean };
/** Reject supplied invalid filters instead of silently broadening the query. */
export function assertValidQuery(params: URLSearchParams, rules: Record<string, Rule> = {}) {
  const errors: Record<string, string> = {};
  const combined: Record<string, Rule> = { page: { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true }, limit: { min: 1, max: 100, integer: true }, ...rules };
  for (const key of new Set(params.keys())) if (!(key in combined)) errors[key] = "Choose a valid filter.";
  for (const [key, rule] of Object.entries(combined)) {
    const value = params.get(key);
    if (value === null || value === "") continue;
    if (rule.maxLength !== undefined && value.length > rule.maxLength) errors[key] = `Use ${rule.maxLength} characters or fewer.`;
    if (rule.values && !rule.values.includes(value)) errors[key] = "Choose a valid filter.";
    if (rule.min !== undefined && (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < rule.min || (rule.max !== undefined && Number(value) > rule.max) || (rule.integer && !Number.isInteger(Number(value))))) errors[key] = "Enter a valid filter value.";
    if (rule.date && (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10))) errors[key] = "Enter a valid date.";
    if (rule.uuid && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)) errors[key] = "Choose a valid record.";
  }
  if (Object.keys(errors).length) throw new ApiError(Object.values(errors)[0], 400, { message: Object.values(errors)[0], fieldErrors: errors }, "INVALID_FILTERS");
}
