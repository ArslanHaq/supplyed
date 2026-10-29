const uuidPattern = "[\\da-f]{8}-(?:[\\da-f]{4}-){3}[\\da-f]{12}";

/** Only an authenticated invitation route can be an invitation destination. */
export function invitationReturnPath(value: unknown): string | null {
  return typeof value === "string" && new RegExp(`^/job-invitations(?:/${uuidPattern})?$`, "i").test(value) ? value : null;
}

/** Validate login return paths without allowing external or arbitrary redirects. */
export function authReturnPath(value: unknown): string | null {
  const invitation = invitationReturnPath(value);
  if (invitation) return invitation;
  if (typeof value !== "string" || !value.startsWith("/")) return null;

  try {
    const url = new URL(value, "https://supplyed.local");
    if (url.origin !== "https://supplyed.local" || url.pathname !== "/job-detail") return null;
    const jobId = url.searchParams.get("jobId");
    if (!jobId || !new RegExp(`^${uuidPattern}$`, "i").test(jobId)) return null;
    return `/job-detail?jobId=${encodeURIComponent(jobId)}`;
  } catch {
    return null;
  }
}

export function loginHref(value: unknown) {
  const destination = authReturnPath(value);
  return destination ? `/login?returnTo=${encodeURIComponent(destination)}` : "/login";
}

export const invitationLoginHref = loginHref;
