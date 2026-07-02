import type { TeacherListFilters, TeacherProfileUpdateInput } from "./types";

export function normalizeTeacherFilters(filters: TeacherListFilters = {}): TeacherListFilters {
  return {
    keyStage: filters.keyStage?.trim() || undefined,
    search: filters.search?.trim() || undefined,
    subject: filters.subject?.trim() || undefined,
  };
}

export function normalizeTeacherProfileUpdate(input: TeacherProfileUpdateInput): TeacherProfileUpdateInput {
  return {
    ...input,
    availability: input.availability?.trim() || undefined,
    city: input.city?.trim() || undefined,
  };
}
