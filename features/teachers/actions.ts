"use server";

import { revalidateTag } from "next/cache";

import { actionOk } from "@/lib/server/action-response";
import { api } from "@/lib/server/api-client";

import { normalizeTeacherProfileUpdate } from "./schemas";
import type { TeacherProfileUpdateInput } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function updateTeacherProfileAction(input: TeacherProfileUpdateInput) {
  const normalizedInput = normalizeTeacherProfileUpdate(input);

  if (backendEnabled()) {
    await api.patch("/teachers/me", normalizedInput);
  }

  revalidateTag("teachers", "max");
  return actionOk(null, backendEnabled() ? "Teacher profile updated." : "Teacher profile update is ready for NestJS integration.");
}
