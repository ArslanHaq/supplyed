"use server";

import { backendEnabled } from "@/lib/server/backend-config";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { validateUkCity } from "@/lib/uk-validation";
import { api } from "@/lib/server/api-client";

import { normalizeTeacherProfileUpdate } from "./schemas";
import type { TeacherProfileUpdateInput } from "./types";


export async function updateTeacherProfileAction(input: TeacherProfileUpdateInput) {
  if (!input || typeof input !== "object") return actionError("Check your teacher profile details.");
  const city = validateUkCity(input.city);
  if (!city.valid) return actionError(city.error!, { fieldErrors: { city: city.error! } });
  if (input.rate !== undefined && (typeof input.rate !== "number" || !Number.isFinite(input.rate) || input.rate < 0)) return actionError("Enter a valid non-negative rate.");
  for (const values of [input.keyStages, input.subjects]) if (values !== undefined && (!Array.isArray(values) || values.length > 100 || values.some(value => typeof value !== "string" || !value.trim() || value.length > 100))) return actionError("Choose valid subjects and key stages.");
  if (input.availability !== undefined && (typeof input.availability !== "string" || input.availability.length > 500)) return actionError("Use up to 500 characters for availability.");
  input = { ...input, ...(input.city !== undefined ? { city: city.value } : {}) };
  const normalizedInput = normalizeTeacherProfileUpdate(input);

  if (backendEnabled()) {
    await api.patch("/teachers/me", normalizedInput);
  }

  revalidateTag("teachers", "max");
  return actionOk(null, backendEnabled() ? "Teacher profile updated." : "Teacher profile update is ready for NestJS integration.");
}
