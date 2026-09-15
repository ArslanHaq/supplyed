"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeApplication, normalizeApplicationCreateInput } from "./schemas";
import type { ApplicationCreateInput, JobApplication } from "./types";

const MAX_COVER_LETTER_LENGTH = 2_000;

export async function createApplicationAction(input: ApplicationCreateInput) {
  const normalized = normalizeApplicationCreateInput(input);

  if (!normalized.jobId) {
    return actionError("Choose a valid job before applying.", { code: "JOB_ID_REQUIRED" });
  }
  if (!normalized.coverLetter) {
    return actionError("Add a cover letter before applying.", {
      code: "COVER_LETTER_REQUIRED",
      fieldErrors: { coverLetter: "Add a cover letter before applying." },
    });
  }
  if (normalized.coverLetter.length > MAX_COVER_LETTER_LENGTH) {
    return actionError(`Cover letter must be ${MAX_COVER_LETTER_LENGTH.toLocaleString()} characters or fewer.`, {
      code: "COVER_LETTER_TOO_LONG",
      fieldErrors: { coverLetter: `Use ${MAX_COVER_LETTER_LENGTH.toLocaleString()} characters or fewer.` },
    });
  }

  try {
    const application = await api.post<JobApplication>("/applications", normalized);

    revalidateTag("applications", "max");
    revalidateTag(`applications:job:${normalized.jobId}`, "max");
    return actionOk(normalizeApplication(application), "Application submitted.");
  } catch (error) {
    return actionError(readApplicationError(error), {
      code: error instanceof ApiError ? error.code : undefined,
    });
  }
}

function readApplicationError(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Application could not be submitted. Please try again.";
}
