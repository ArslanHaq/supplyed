"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import type { DegreeCheck, DegreeCheckInput, DegreeConsentUpload } from "./types";

function failure(error: unknown, fallback: string) {
  return error instanceof ApiError
    ? actionError(error.message, { code: error.code, requestId: error.requestId, status: error.status })
    : actionError(fallback);
}

export async function startConsentUploadAction(contentType: string, sizeBytes: number) {
  try {
    return actionOk(
      await api.post<DegreeConsentUpload>("/degree-checks/me/consent-upload-url", { contentType, sizeBytes }),
    );
  } catch (error) {
    return failure(error, "The consent form upload could not be started.");
  }
}

/** Sends the degree to Hedd. Hedd's own reasons for refusing it come back as the message. */
export async function submitDegreeCheckAction(input: DegreeCheckInput) {
  try {
    return actionOk(await api.post<DegreeCheck>("/degree-checks/me", input));
  } catch (error) {
    return failure(error, "Your degree check could not be sent. Please try again.");
  }
}
