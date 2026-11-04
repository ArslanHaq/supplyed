"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeApplication, normalizeApplicationCreateInput } from "./schemas";
import { MAX_PROPOSAL_LENGTH } from "./rich-text";
import type { ApplicationCreateInput, ApplicationStatusUpdateInput, HireApplicationInput, JobApplication } from "./types";

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
  // Hiring has stronger ownership, eligibility and booking guarantees than a
  // normal pipeline update. Keep older callers safe by routing them through
  // the dedicated atomic endpoint with the original payment terms.
  if (input.status === "HIRED") return hireApplicationAction({ id: input.id });
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

export async function hireApplicationAction(input: HireApplicationInput) {
  if (!input || typeof input.id !== "string" || !input.id.trim()) {
    return actionError("Choose a valid application before hiring.", { code: "APPLICATION_ID_REQUIRED" });
  }

  const { id, ...paymentTerms } = input;
  const fieldErrors = validateHirePaymentTerms(paymentTerms);
  if (Object.keys(fieldErrors).length) {
    return actionError("Check the negotiated booking terms before hiring.", {
      code: "INVALID_BOOKING_PAYMENT_TERMS",
      fieldErrors,
    });
  }

  try {
    const application = await api.post<JobApplication>(`/applications/${id.trim()}/hire`, paymentTerms);
    revalidateTag("applications", "max");
    revalidateTag(`applications:job:${application.jobId}`, "max");
    revalidateTag("bookings", "max");
    revalidateTag("invoices", "max");
    revalidateTag("invitations", "max");
    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`job:${application.jobId}`, "max");
    return actionOk(normalizeApplication(application), "Teacher hired and booking created.");
  } catch (error) {
    return actionError(readApplicationError(error), {
      retryAfter: error instanceof ApiError ? error.retryAfter : undefined,
      fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined,
      code: error instanceof ApiError ? error.code : undefined,
      requestId: error instanceof ApiError ? error.requestId : undefined,
      status: error instanceof ApiError ? error.status : undefined,
    });
  }
}

function validateHirePaymentTerms(input: Omit<HireApplicationInput, "id">) {
  const errors: Partial<Record<keyof Omit<HireApplicationInput, "id">, string>> = {};
  if (input.payAmount !== undefined && (!Number.isFinite(input.payAmount) || input.payAmount <= 0 || input.payAmount > 99_999_999.99 || Math.abs(input.payAmount * 100 - Math.round(input.payAmount * 100)) > 1e-8)) {
    errors.payAmount = "Enter a positive GBP amount with no more than two decimal places.";
  }
  if (input.payType !== undefined && !["hourly", "daily", "fixed"].includes(input.payType)) errors.payType = "Choose hourly, daily or fixed pay.";
  if (input.paymentFrequency !== undefined && !["hourly", "daily", "weekly", "monthly", "completion", "milestone"].includes(input.paymentFrequency)) errors.paymentFrequency = "Choose a supported payment frequency.";
  if (input.periodAnchor !== undefined && !["ASSIGNMENT_START", "CALENDAR"].includes(input.periodAnchor)) errors.periodAnchor = "Choose a valid payment-period boundary.";
  if (input.hours !== undefined && (!Number.isInteger(input.hours) || input.hours < 1)) errors.hours = "Enter planned hours as a positive whole number.";
  if (input.days !== undefined && (!Number.isInteger(input.days) || input.days < 1)) errors.days = "Enter planned days as a positive whole number.";
  return errors;
}

function readApplicationError(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Application could not be submitted. Please try again.";
}
