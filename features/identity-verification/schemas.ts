import type {
  IdentityState,
  IdentityVerification,
  IdentityVerificationResult,
  IdentityVerificationStatus,
  MyIdentityVerification,
} from "./types";

const statuses: IdentityVerificationStatus[] = ["LINK_SENT", "SUBMITTED", "RESULTS_READY", "COMPLETED", "EXPIRED", "CANCELLED"];
const results: IdentityVerificationResult[] = ["VERIFIED", "IN_REVIEW", "RETRY_PENDING", "UNSUCCESSFUL"];
const states: IdentityState[] = ["NOT_STARTED", "LINK_SENT", "PROCESSING", "IN_REVIEW", "RETRY_PENDING", "VERIFIED", "UNSUCCESSFUL"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Only an https link is followed, so a bad response can never send the teacher somewhere unexpected. */
function readGuestLink(value: unknown) {
  const link = readString(value);
  return link && link.startsWith("https://") ? link : null;
}

export function normalizeIdentityVerification(value: unknown): IdentityVerification | null {
  if (!isRecord(value) || !readString(value.id)) return null;
  const status = statuses.find((item) => item === value.status);
  if (!status) return null;

  return {
    completedAt: readString(value.completedAt),
    createdAt: readString(value.createdAt) ?? new Date(0).toISOString(),
    guestLinkUrl: status === "LINK_SENT" ? readGuestLink(value.guestLinkUrl) : null,
    id: String(value.id),
    linkExpiresAt: readString(value.linkExpiresAt) ?? new Date(0).toISOString(),
    result: results.find((item) => item === value.result) ?? null,
    status,
    submittedAt: readString(value.submittedAt),
  };
}

export function normalizeMyIdentityVerification(value: unknown): MyIdentityVerification {
  const item = isRecord(value) ? value : {};

  return {
    canStart: item.canStart === true,
    // Only an explicit false switches the step off.
    required: item.required !== false,
    state: states.find((state) => state === item.state) ?? "NOT_STARTED",
    verification: normalizeIdentityVerification(item.verification),
    verifiedAt: readString(item.verifiedAt),
  };
}
