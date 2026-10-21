export type IdentityVerificationStatus =
  | "LINK_SENT"
  | "SUBMITTED"
  | "RESULTS_READY"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

/** What the teacher is told about one check. The backend never says why a check failed. */
export type IdentityVerificationResult = "VERIFIED" | "IN_REVIEW" | "RETRY_PENDING" | "UNSUCCESSFUL";

/**
 * Where the teacher stands on the identity step of opening their account.
 * IN_REVIEW and RETRY_PENDING wait for our team; UNSUCCESSFUL ends the process.
 */
export type IdentityState =
  | "NOT_STARTED"
  | "LINK_SENT"
  | "PROCESSING"
  | "IN_REVIEW"
  | "RETRY_PENDING"
  | "VERIFIED"
  | "UNSUCCESSFUL";

/** Mirrors the backend's TeacherIdentityVerificationDto. */
export type IdentityVerification = {
  completedAt: string | null;
  createdAt: string;
  /** TrustID's journey; only while LINK_SENT. Must be opened in a phone browser, never an iframe. */
  guestLinkUrl: string | null;
  id: string;
  linkExpiresAt: string;
  result: IdentityVerificationResult | null;
  status: IdentityVerificationStatus;
  submittedAt: string | null;
};

/** Mirrors the backend's MyIdentityVerificationResponseDto. */
export type MyIdentityVerification = {
  canStart: boolean;
  /** False only where the backend has the check switched off (local development). */
  required: boolean;
  state: IdentityState;
  /** The latest check. */
  verification: IdentityVerification | null;
  verifiedAt: string | null;
};
