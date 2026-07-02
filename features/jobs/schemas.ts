import type { JobCreateInput, JobListFilters, JobUpdateInput } from "./types";

export function normalizeJobFilters(filters: JobListFilters = {}): JobListFilters {
  return {
    keyStage: filters.keyStage?.trim() || undefined,
    mode: filters.mode,
    search: filters.search?.trim() || undefined,
    subject: filters.subject?.trim() || undefined,
    urgent: filters.urgent,
  };
}

export function normalizeJobCreateInput(input: JobCreateInput): JobCreateInput {
  return {
    ...input,
    description: input.description?.trim() || undefined,
    keyStage: input.keyStage.trim(),
    subject: input.subject.trim(),
    title: input.title.trim(),
  };
}

export function normalizeJobUpdateInput(input: JobUpdateInput): JobUpdateInput {
  return {
    ...input,
    description: input.description?.trim() || undefined,
    id: input.id.trim(),
    keyStage: input.keyStage?.trim(),
    subject: input.subject?.trim(),
    title: input.title?.trim(),
  };
}
