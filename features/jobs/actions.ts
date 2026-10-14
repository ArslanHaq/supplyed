"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk, type ActionResult } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeBackendJob, normalizeJobCreateInput, normalizeJobUpdateInput, toCreateJobPayload, toUpdateJobPayload } from "./schemas";
import type { BackendJobResponse, Job, JobCreateInput, JobUpdateInput } from "./types";
import { validateJobInput } from "./validation";

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
    });
  }
}

export async function updateJobAction(input: JobUpdateInput) {
  try {
    if (!input || typeof input.id !== "string" || !input.id.trim()) return actionError("Choose a valid job.");
    let fieldErrors = validateJobInput(input, { partial: true });
    if (Object.keys(fieldErrors).length) return actionError("Check the highlighted job details.", { fieldErrors });
    if (input.status === "ACTIVE") {
      // The public detail endpoint only returns active jobs. The owned endpoint
      // supports drafts and applies the backend's institution/admin access rules.
      const existing = await api.get<BackendJobResponse>(`/jobs/mine/${encodeURIComponent(input.id)}`, { cache: "no-store" });
      const stored = Object.fromEntries(Object.entries(existing).filter(([, value]) => value !== null));
      fieldErrors = validateJobInput({ ...stored, payAmount: existing.payAmount == null ? undefined : Number(existing.payAmount), minExperienceYears: existing.minExperienceYears == null ? undefined : Number(existing.minExperienceYears), ...input } as JobUpdateInput);
      if (Object.keys(fieldErrors).length) return actionError("Correct the saved job details before publishing.", { fieldErrors });
    }
    const normalizedInput = normalizeJobUpdateInput(input);
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
