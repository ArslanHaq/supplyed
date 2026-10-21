import type { IdentityState, MyIdentityVerification } from "./types";

type Tone = "green" | "amber" | "red" | "ghost";

const STATE_TAGS: Record<IdentityState, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not verified", tone: "ghost" },
  LINK_SENT: { label: "Waiting for you", tone: "amber" },
  PROCESSING: { label: "Checking", tone: "amber" },
  IN_REVIEW: { label: "In review", tone: "amber" },
  RETRY_PENDING: { label: "Needs another look", tone: "amber" },
  VERIFIED: { label: "Verified", tone: "green" },
  UNSUCCESSFUL: { label: "Unsuccessful", tone: "red" },
};

export const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Whether the teacher must stay on the identity step. Once they have started a
 * check they can set up the rest of their account while it is completed and
 * checked: TrustID only tells us when results are ready, not when the teacher
 * has finished on their phone, and checks can take hours. Sending the profile
 * for review still needs VERIFIED. An unsuccessful check stops them here.
 */
export function identityStepRequired(identity: MyIdentityVerification) {
  return identity.required && (identity.state === "NOT_STARTED" || identity.state === "UNSUCCESSFUL");
}

/** Whether the check is under way but not yet decided. */
export function identityCheckPending(state: IdentityState) {
  return state === "LINK_SENT" || state === "PROCESSING" || state === "IN_REVIEW" || state === "RETRY_PENDING";
}

export function identityStateTag(state: IdentityState) {
  return STATE_TAGS[state];
}

/** What the teacher is told about where they stand. Never why a check failed. */
export function describeIdentityState(identity: MyIdentityVerification) {
  const { state, verification } = identity;

  switch (state) {
    case "NOT_STARTED":
      return verification?.status === "EXPIRED"
        ? "Your last TrustID link expired before it was used. Start again when you're ready."
        : "Verify your identity and right to work with TrustID, our identity partner. You'll need your phone and your passport or share code. It takes about five minutes.";
    case "LINK_SENT":
      return `Open the TrustID link on your phone to photograph your passport (or enter your share code) and take a selfie. We've also emailed and texted it to you.${verification ? ` It expires on ${shortDate(verification.linkExpiresAt)}.` : ""}`;
    case "PROCESSING":
      return "TrustID is checking what you sent. This can take a little while; we'll email you when it's done.";
    case "IN_REVIEW":
      return "TrustID has finished your check and our team is reviewing the result. We'll let you know the outcome.";
    case "RETRY_PENDING":
      return "TrustID couldn't verify the photos you sent. Our team will review it and may send you a new link to try again.";
    case "VERIFIED":
      return identity.verifiedAt
        ? `Your identity and right to work were confirmed on ${shortDate(identity.verifiedAt)}.`
        : "Your identity and right to work are confirmed.";
    case "UNSUCCESSFUL":
      return "We couldn't verify your identity. Please contact SupplyEd support.";
  }
}
