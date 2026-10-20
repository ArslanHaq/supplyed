/** Only an authenticated invitation route can be a return destination. */
export function invitationReturnPath(value: unknown): string | null {
  return typeof value === "string" && /^\/job-invitations(?:\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})?$/i.test(value) ? value : null;
}
export function invitationLoginHref(value: unknown) {
  const destination = invitationReturnPath(value);
  return destination ? `/login?returnTo=${encodeURIComponent(destination)}` : "/login";
}
