const fallbackMessage = "We couldn't complete this request. Please try again.";

/** Keep diagnostics in error metadata, never in customer-facing copy. */
export function userFacingError(message: string, options: { status?: number; code?: string } = {}): string {
  const clean = message.replace(/\s*\(?Support reference:[\s\S]*$/i, "").trim();
  if (options.status === 401 || options.code === "SESSION_EXPIRED") return "Your session expired. Sign in again to continue.";
  if (options.status === 408 || options.status === 504 || /timeout|timed out|aborted/i.test(clean)) return "This is taking longer than expected. Please try again.";
  if (options.status && options.status >= 500) return "Something went wrong on our side. Please try again shortly.";
  if (/already booked.*overlapping|bookings? overlap|overlapping booking/i.test(clean)) return "This teacher is already booked during these dates. Choose different dates or another teacher.";
  if (/failed to fetch|fetch failed|network ?error|connection lost|ECONN|ENOTFOUND/i.test(clean)) return "We couldn't connect. Check your internet connection and try again.";
  if (!clean || /<[^>]+>|prisma|SQLSTATE|API_BASE_URL|stack trace|unexpected (token|end)|JSON|internal server error|unexpected server error|[A-Z]:\\|\/(?:app|src|node_modules)\/|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i.test(clean)) return fallbackMessage;
  if (/^(?:request failed(?: with status \d+)?|bad request|unauthorized|forbidden|not found|conflict|too many requests)[.!]?$/i.test(clean)) {
    if (options.status === 403) return "Your account doesn't have permission to do this.";
    if (options.status === 404) return "This item is no longer available. Refresh the page and try again.";
    if (options.status === 409) return "This item has changed. Refresh the page and review it before trying again.";
    if (options.status === 429) return "Please wait a moment before trying again.";
    if (options.status === 400 || options.status === 422) return "Please check the details you entered and try again.";
    return fallbackMessage;
  }
  return clean;
}
