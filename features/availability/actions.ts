"use server";
import { revalidateTag } from "next/cache";
import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { validateStructuredSchedule } from "@/features/jobs/job-schedule";
import type { TeacherAvailability } from "./types";

export async function updateAvailabilityAction(input: TeacherAvailability) {
  const error = validateStructuredSchedule({ ...input.weeklySchedule, exceptions: input.exceptions });
  if (error) return actionError(error, { fieldErrors: { schedule: error } });
  try {
    const availability = await api.put<TeacherAvailability>("/availability/me", input);
    revalidateTag("availability", "max");
    revalidateTag("applications", "max");
    return actionOk(availability, "Availability saved.");
  } catch (error) {
    return actionError(error instanceof ApiError ? error.message : "Availability could not be saved.", {
      code: error instanceof ApiError ? error.code : undefined,
      fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined,
      status: error instanceof ApiError ? error.status : undefined,
    });
  }
}
