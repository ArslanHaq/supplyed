"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api } from "@/lib/server/api-client";

import { normalizeJobCreateInput, normalizeJobUpdateInput } from "./schemas";
import type { JobCreateInput, JobUpdateInput } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function createJobAction(input: JobCreateInput) {
  const normalizedInput = normalizeJobCreateInput(input);

  if (backendEnabled()) {
    await api.post("/jobs", normalizedInput);
  }

  revalidateTag("jobs", "max");
  return actionOk(null, backendEnabled() ? "Job created." : "Job creation is ready for NestJS integration.");
}

export async function updateJobAction(input: JobUpdateInput) {
  const normalizedInput = normalizeJobUpdateInput(input);

  if (backendEnabled()) {
    await api.patch(`/jobs/${normalizedInput.id}`, normalizedInput);
  }

  revalidateTag("jobs", "max");
  revalidateTag(`job:${normalizedInput.id}`, "max");
  return actionOk(null, backendEnabled() ? "Job updated." : "Job update is ready for NestJS integration.");
}

export async function deleteJobAction(id: string) {
  if (!id.trim()) return actionError("Choose a valid job.", { code: "JOB_ID_REQUIRED" });

  if (backendEnabled()) {
    await api.delete(`/jobs/${id}`);
  }

  revalidateTag("jobs", "max");
  revalidateTag(`job:${id}`, "max");
  return actionOk(null, backendEnabled() ? "Job deleted." : "Job deletion is ready for NestJS integration.");
}
