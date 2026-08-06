"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeBackendJob, normalizeJobCreateInput, normalizeJobUpdateInput, toCreateJobPayload, toUpdateJobPayload } from "./schemas";
import type { BackendJobResponse, JobCreateInput, JobUpdateInput } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function createJobAction(input: JobCreateInput) {
  const normalizedInput = normalizeJobCreateInput(input);
  const shouldActivate = normalizedInput.status === "ACTIVE";

  try {
    if (backendEnabled()) {
      const created = await api.post<BackendJobResponse>("/jobs", toCreateJobPayload(normalizedInput));
      const job = shouldActivate
        ? await api.patch<BackendJobResponse>(`/jobs/${created.id}`, { status: "ACTIVE" })
        : created;

      revalidateTag("jobs", "max");
      revalidateTag("jobs:mine", "max");
      revalidateTag(`job:${job.id}`, "max");
      return actionOk(normalizeBackendJob(job), shouldActivate ? "Job published." : "Job saved as draft.");
    }

    const now = new Date().toISOString();
    const job = normalizeBackendJob({
      id: `local-job-${Date.now()}`,
      createdAt: now,
      description: normalizedInput.description,
      endDate: normalizedInput.endDate ?? null,
      expiresAt: normalizedInput.expiresAt ?? null,
      keyStages: normalizedInput.keyStages,
      location: normalizedInput.location ?? null,
      parkingInfo: normalizedInput.parkingInfo ?? null,
      payAmount: normalizedInput.payAmount ?? null,
      payType: normalizedInput.payType ?? null,
      postedByUserId: "local-user",
      startDate: normalizedInput.startDate ?? null,
      status: shouldActivate ? "ACTIVE" : "DRAFT",
      subject: normalizedInput.subject ?? null,
      title: normalizedInput.title,
      updatedAt: now,
    });

    revalidateTag("jobs", "max");
    return actionOk(job, "Job flow is ready for NestJS integration.");
  } catch (error) {
    return actionError(readJobActionError(error, "Job could not be saved. Check the details and try again."));
  }
}

export async function updateJobAction(input: JobUpdateInput) {
  const normalizedInput = normalizeJobUpdateInput(input);

  try {
    if (backendEnabled()) {
      const job = await api.patch<BackendJobResponse>(`/jobs/${normalizedInput.id}`, toUpdateJobPayload(normalizedInput));

      revalidateTag("jobs", "max");
      revalidateTag("jobs:mine", "max");
      revalidateTag(`job:${normalizedInput.id}`, "max");
      return actionOk(normalizeBackendJob(job), "Job updated.");
    }

    revalidateTag("jobs", "max");
    revalidateTag(`job:${normalizedInput.id}`, "max");
    return actionOk(null, "Job update is ready for NestJS integration.");
  } catch (error) {
    return actionError(readJobActionError(error, "Job could not be updated. Check the details and try again."));
  }
}

export async function deleteJobAction(id: string) {
  if (!id.trim()) return actionError("Choose a valid job.", { code: "JOB_ID_REQUIRED" });

  try {
    if (backendEnabled()) {
      await api.delete(`/jobs/${id}`);
    }

    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`job:${id}`, "max");
    return actionOk(null, backendEnabled() ? "Job deleted." : "Job deletion is ready for NestJS integration.");
  } catch (error) {
    return actionError(readJobActionError(error, "Job could not be deleted. Try again."));
  }
}

function readJobActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}
