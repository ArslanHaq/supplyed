"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeApplication, normalizeApplicationCreateInput } from "./schemas";
import type { ApplicationCreateInput, ApplicationStatusUpdateInput, JobApplication } from "./types";

const MAX_COVER_LETTER_LENGTH = 2_000;

export async function createApplicationAction(input: ApplicationCreateInput) {
  const normalized = normalizeApplicationCreateInput(input);

  if (!normalized.jobId) {
    return actionError("Choose a valid job before applying.", { code: "JOB_ID_REQUIRED" });
  }
  if ((normalized.coverLetter?.length ?? 0) > MAX_COVER_LETTER_LENGTH) {
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

export async function updateApplicationStatusAction(input: ApplicationStatusUpdateInput) {
  if (!input.id.trim()) return actionError("Choose a valid application.", { code: "APPLICATION_ID_REQUIRED" });
  try {
    const application = await api.patch<JobApplication>(`/applications/${input.id}/status`, { status: input.status });
    revalidateTag("applications", "max");
    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`applications:job:${application.jobId}`, "max");
    return actionOk(normalizeApplication(application), "Application status updated.");
  } catch (error) {
    return actionError(readApplicationError(error), { code: error instanceof ApiError ? error.code : undefined });
  }
}

function readApplicationError(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Application could not be submitted. Please try again.";
}
