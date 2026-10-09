"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeApplication, normalizeApplicationCreateInput } from "./schemas";
import { isEmptyRichText, MAX_PROPOSAL_LENGTH } from "./rich-text";
import type { ApplicationCreateInput, ApplicationStatusUpdateInput, JobApplication } from "./types";

export async function createApplicationAction(input: ApplicationCreateInput) {
  const normalized = normalizeApplicationCreateInput(input);

  if (!normalized.jobId) {
    return actionError("Choose a valid job before applying.", { code: "JOB_ID_REQUIRED" });
  }
  if (isEmptyRichText(normalized.coverLetter)) {
    return actionError("Add a proposal before applying.", {
      code: "COVER_LETTER_REQUIRED",
      fieldErrors: { coverLetter: "Add a proposal before applying." },
    });
  }
  if (normalized.coverLetter.length > MAX_PROPOSAL_LENGTH) {
    return actionError(`The formatted proposal must be ${MAX_PROPOSAL_LENGTH.toLocaleString()} characters or fewer.`, {
      code: "COVER_LETTER_TOO_LONG",
      fieldErrors: { coverLetter: "Shorten the proposal or remove some formatting, then try again." },
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
    revalidateTag(`applications:job:${application.jobId}`, "max");
    if (application.status === "HIRED") {
      revalidateTag("bookings", "max");
      revalidateTag("invoices", "max");
    }
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
