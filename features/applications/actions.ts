"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeApplication, normalizeApplicationCreateInput } from "./schemas";
import { MAX_PROPOSAL_LENGTH } from "./rich-text";
import type { ApplicationCreateInput, ApplicationStatusUpdateInput, JobApplication } from "./types";

export async function createApplicationAction(input: ApplicationCreateInput) {
  if (!input || typeof input.jobId !== "string" || (input.coverLetter !== undefined && typeof input.coverLetter !== "string")) {
    return actionError("Check the job and proposal before applying.", { code: "APPLICATION_INPUT_INVALID" });
  }
  const normalized = normalizeApplicationCreateInput(input);

  if (!normalized.jobId) {
    return actionError("Choose a valid job before applying.", { code: "JOB_ID_REQUIRED" });
  }
  if (normalized.coverLetter && normalized.coverLetter.length > MAX_PROPOSAL_LENGTH) {
    return actionError(`The formatted proposal must be ${MAX_PROPOSAL_LENGTH.toLocaleString()} characters or fewer.`, {
      code: "COVER_LETTER_TOO_LONG",
      fieldErrors: { coverLetter: "Shorten the proposal or remove some formatting, then try again." },
    });
  }

  try {
    // The API snapshots the canonical job title as jobName. Only send its
    // accepted input fields so the title cannot be supplied or changed here.
    const application = await api.post<JobApplication>("/applications", normalized);

    revalidateTag("applications", "max");
    revalidateTag(`applications:job:${normalized.jobId}`, "max");
    return actionOk(normalizeApplication(application), "Application submitted.");
  } catch (error) {
    return actionError(readApplicationError(error), {
      retryAfter: error instanceof ApiError ? error.retryAfter : undefined, fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined, code: error instanceof ApiError ? error.code : undefined,
      requestId: error instanceof ApiError ? error.requestId : undefined,
      status: error instanceof ApiError ? error.status : undefined,
    });
  }
}

export async function updateApplicationStatusAction(input: ApplicationStatusUpdateInput) {
  if (!input || typeof input.id !== "string" || !input.id.trim()) return actionError("Choose a valid application.", { code: "APPLICATION_ID_REQUIRED" });
  if (!["APPLIED", "VIEWED", "SHORTLISTED", "HIRED", "REJECTED"].includes(input.status)) return actionError("Choose a valid application status.");
  try {
    const application = await api.patch<JobApplication>(`/applications/${input.id}/status`, { status: input.status });
    revalidateTag("applications", "max");
    revalidateTag(`applications:job:${application.jobId}`, "max");
    if (application.status === "HIRED") {
      revalidateTag("bookings", "max");
      revalidateTag("invoices", "max");
      revalidateTag("invitations", "max");
      revalidateTag("jobs", "max");
      revalidateTag("jobs:mine", "max");
      revalidateTag(`job:${application.jobId}`, "max");
    }
    return actionOk(normalizeApplication(application), "Application status updated.");
  } catch (error) {
    return actionError(readApplicationError(error), {
      retryAfter: error instanceof ApiError ? error.retryAfter : undefined, fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined, code: error instanceof ApiError ? error.code : undefined,
      requestId: error instanceof ApiError ? error.requestId : undefined,
      status: error instanceof ApiError ? error.status : undefined,
    });
  }
}

function readApplicationError(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Application could not be submitted. Please try again.";
}
