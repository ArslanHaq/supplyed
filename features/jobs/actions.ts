"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk, type ActionResult } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeBackendJob, normalizeJobCreateInput, normalizeJobUpdateInput, toCreateJobPayload, toUpdateJobPayload } from "./schemas";
import type { BackendJobResponse, Job, JobCreateInput, JobUpdateInput } from "./types";
import { validateJobInput } from "./validation";
import { validateWorkUnits } from "./work-units";

export async function createJobAction(input: JobCreateInput): Promise<ActionResult<Job> & { savedJobId?: string }> {
  let savedJobId: string | undefined;
  try {
    const fieldErrors = validateJobInput(input);
    if (Object.keys(fieldErrors).length) return actionError("Check the highlighted job details.", { fieldErrors });
    const normalizedInput = normalizeJobCreateInput(input);
    const shouldActivate = normalizedInput.status === "ACTIVE";
    const created = await api.post<BackendJobResponse>("/jobs", toCreateJobPayload(normalizedInput));
    savedJobId = created.id;
    const job = shouldActivate
      ? await api.patch<BackendJobResponse>(`/jobs/${created.id}`, { status: "ACTIVE" })
      : created;

    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`job:${job.id}`, "max");
    return actionOk(normalizeBackendJob(job), shouldActivate ? "Job published." : "Job saved as draft.");
  } catch (error) {
    if (savedJobId) {
      revalidateTag("jobs", "max");
      revalidateTag("jobs:mine", "max");
      revalidateTag(`job:${savedJobId}`, "max");
      return {
        ...actionError("Your job was saved, but publishing could not be confirmed. Try again to finish publishing this same job.", {
          code: readJobActionCode(error),
        }),
        savedJobId,
      };
    }
    return actionError(readJobActionError(error, "Job could not be saved. Check the details and try again."), {
      code: readJobActionCode(error),
      fieldErrors: readJobFieldErrors(error),
      requestId: error instanceof ApiError ? error.requestId : undefined,
      status: error instanceof ApiError ? error.status : undefined,
    });
  }
}

export async function updateJobAction(input: JobUpdateInput) {
  try {
    if (!input || typeof input.id !== "string" || !input.id.trim()) return actionError("Choose a valid job.");
    let fieldErrors = validateJobInput(input, { partial: true });
    if (Object.keys(fieldErrors).length) return actionError("Check the highlighted job details.", { fieldErrors });
    const normalizedInput = normalizeJobUpdateInput(input);
    const changesDates = (["startDate", "endDate", "liveFrom", "expiresAt"] as const).some(key => normalizedInput[key] !== undefined);
    const changesUnits = (["hours", "days", "payType"] as const).some(key => normalizedInput[key] !== undefined);
    if (input.status === "ACTIVE" || changesDates || changesUnits) {
      // The public detail endpoint only returns active jobs. The owned endpoint
      // supports drafts and applies the backend's institution/admin access rules.
      const existing = await api.get<BackendJobResponse>(`/jobs/mine/${encodeURIComponent(input.id)}`, { cache: "no-store" });
      const stored = Object.fromEntries(Object.entries(existing).filter(([, value]) => value !== null));
      const merged = { ...stored, payAmount: existing.payAmount == null ? undefined : Number(existing.payAmount), minExperienceYears: existing.minExperienceYears == null ? undefined : Number(existing.minExperienceYears), ...normalizedInput } as JobUpdateInput;
      if (normalizedInput.payType !== undefined && normalizedInput.payType !== existing.payType) {
        if (merged.payType !== "hourly" && normalizedInput.hours === undefined) merged.hours = null;
        if (merged.payType !== "daily" && normalizedInput.days === undefined) merged.days = null;
      }
      fieldErrors = input.status === "ACTIVE"
        ? validateJobInput(merged)
        : { ...(changesDates ? validateJobInput({ id: input.id, startDate: merged.startDate, endDate: merged.endDate, liveFrom: merged.liveFrom, expiresAt: merged.expiresAt }, { partial: true }) : {}), ...validateWorkUnits(merged) };
      if (Object.keys(fieldErrors).length) return actionError(input.status === "ACTIVE" ? "Correct the saved job details before publishing." : "Check the highlighted job details.", { fieldErrors });
    }
    const job = await api.patch<BackendJobResponse>(`/jobs/${normalizedInput.id}`, toUpdateJobPayload(normalizedInput));

    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`job:${normalizedInput.id}`, "max");
    return actionOk(normalizeBackendJob(job), "Job updated.");
  } catch (error) {
    return actionError(readJobActionError(error, "Job could not be updated. Check the details and try again."), {
      code: readJobActionCode(error),
      fieldErrors: readJobFieldErrors(error),
      requestId: error instanceof ApiError ? error.requestId : undefined,
      status: error instanceof ApiError ? error.status : undefined,
    });
  }
}

export async function deleteJobAction(id: string) {
  if (typeof id !== "string" || !id.trim()) return actionError("Choose a valid job.", { code: "JOB_ID_REQUIRED" });

  try {
    await api.delete(`/jobs/${id}`);

    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`job:${id}`, "max");
    return actionOk(null, "Job deleted.");
  } catch (error) {
    return actionError(readJobActionError(error, "Job could not be deleted. Try again."), {
      code: readJobActionCode(error),
    });
  }
}

function readJobActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function readJobActionCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined;
}

function readJobFieldErrors(error: unknown): Record<string, string> | undefined {
  if (!(error instanceof ApiError) || !error.payload || typeof error.payload !== "object") return undefined;
  const payload = error.payload as { data?: unknown; fieldErrors?: unknown };
  const candidate = payload.fieldErrors ?? (payload.data && typeof payload.data === "object" ? (payload.data as { fieldErrors?: unknown }).fieldErrors : undefined);
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate as Record<string, string>;
  if (/listing expiry.*live-from|expiry after the live-from/i.test(error.message)) return { expiresAt: "Please choose a listing expiry after the live-from date." };
  if (/work start must be on or after the live-from/i.test(error.message)) return { startDate: "Work start must be on or after the live-from date.", liveFrom: "Live-from date cannot be after the work start." };
  return undefined;
}
