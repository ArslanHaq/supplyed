"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeBackendJob, normalizeJobCreateInput, normalizeJobUpdateInput, toCreateJobPayload, toUpdateJobPayload } from "./schemas";
import type { BackendJobResponse, JobCreateInput, JobUpdateInput } from "./types";

export async function createJobAction(input: JobCreateInput) {
  const normalizedInput = normalizeJobCreateInput(input);
  const shouldActivate = normalizedInput.status === "ACTIVE";

  try {
    const created = await api.post<BackendJobResponse>("/jobs", toCreateJobPayload(normalizedInput));
    const job = shouldActivate
      ? await api.patch<BackendJobResponse>(`/jobs/${created.id}`, { status: "ACTIVE" })
      : created;

    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`job:${job.id}`, "max");
    return actionOk(normalizeBackendJob(job), shouldActivate ? "Job published." : "Job saved as draft.");
  } catch (error) {
    return actionError(readJobActionError(error, "Job could not be saved. Check the details and try again."), {
      code: readJobActionCode(error),
    });
  }
}

export async function updateJobAction(input: JobUpdateInput) {
  const normalizedInput = normalizeJobUpdateInput(input);

  try {
    const job = await api.patch<BackendJobResponse>(`/jobs/${normalizedInput.id}`, toUpdateJobPayload(normalizedInput));

    revalidateTag("jobs", "max");
    revalidateTag("jobs:mine", "max");
    revalidateTag(`job:${normalizedInput.id}`, "max");
    return actionOk(normalizeBackendJob(job), "Job updated.");
  } catch (error) {
    return actionError(readJobActionError(error, "Job could not be updated. Check the details and try again."), {
      code: readJobActionCode(error),
    });
  }
}

export async function deleteJobAction(id: string) {
  if (!id.trim()) return actionError("Choose a valid job.", { code: "JOB_ID_REQUIRED" });

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
