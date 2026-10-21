"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeIdentityVerification } from "./schemas";
import type { IdentityVerification } from "./types";

/**
 * Starts the TrustID check once the teacher has agreed to it, or returns the
 * link they already have. The backend also emails and texts the link. A 409
 * means the teacher has to wait (verified, in review, or waiting for our
 * team); its message says so.
 */
export async function startIdentityVerificationAction(input: { consent: boolean }) {
  if (input?.consent !== true) {
    return actionError("Agree to the identity check before starting it.");
  }

  try {
    const verification = normalizeIdentityVerification(
      await api.post<unknown>("/identity-verification/me", { consent: true }),
    );
    if (!verification) return actionError("Your identity check could not be started. Please try again.");
    return actionOk<IdentityVerification>(verification);
  } catch (error) {
    if (error instanceof ApiError) {
      return actionError(error.message || "Your identity check could not be started.", {
        code: error.code,
        requestId: error.requestId,
      });
    }

    return actionError("Your identity check could not be started. Please try again.");
  }
}
