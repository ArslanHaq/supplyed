import "server-only";

import { api } from "@/lib/server/api-client";

import { identityStepRequired } from "./presentation";
import { normalizeMyIdentityVerification } from "./schemas";
import type { MyIdentityVerification } from "./types";

/** Where the teacher stands on the identity step, and their latest TrustID check. */
export async function getMyIdentityVerification(): Promise<MyIdentityVerification> {
  if (!process.env.API_BASE_URL) {
    return { canStart: false, required: false, state: "NOT_STARTED", verification: null, verifiedAt: null };
  }

  return normalizeMyIdentityVerification(await api.get<unknown>("/identity-verification/me", { cache: "no-store" }));
}

/**
 * Whether a teacher who has created their profile must be sent to
 * /verify-identity. Fails open when the status can't be loaded: the backend
 * still refuses to submit or approve an unverified teacher.
 */
export async function needsIdentityStep(): Promise<boolean> {
  try {
    return identityStepRequired(await getMyIdentityVerification());
  } catch {
    return false;
  }
}
