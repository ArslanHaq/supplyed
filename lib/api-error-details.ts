export function apiErrorDetails(payload: unknown, retryHeader?: string | null, now = Date.now()) {
  const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const fields = value.fieldErrors;
  const fieldErrors = fields && typeof fields === "object" && !Array.isArray(fields)
    ? Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : undefined;
  const headerSeconds = retryHeader ? (/^\d+(?:\.\d+)?$/.test(retryHeader) ? Number(retryHeader) : (Date.parse(retryHeader) - now) / 1000) : NaN;
  const bodySeconds = typeof value.retryAfter === "number" ? value.retryAfter : NaN;
  const delays = [headerSeconds, bodySeconds].filter(value => Number.isFinite(value) && value >= 0);
  return { fieldErrors, retryAfter: delays.length ? Math.ceil(Math.max(...delays)) : undefined };
}
