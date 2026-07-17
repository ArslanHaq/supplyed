"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

const registerInterestRoles = new Set([
  "Head Teacher",
  "Deputy Head",
  "Cover Manager",
  "HR Lead",
  "MAT / Trust Lead",
]);

type RegisterInterestField = "contactName" | "email" | "role" | "schoolName";

export type RegisterInterestActionState = ActionResult<{ submitted: true }, RegisterInterestField> | null;

function readFormString(formData: FormData, key: RegisterInterestField) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return "We could not send your details right now. Please try again in a few minutes.";
    }

    return error.message || "We could not send your details right now.";
  }

  if (error instanceof Error && error.message) return error.message;

  return "We could not send your details right now.";
}

export async function registerInterestAction(
  _previousState: RegisterInterestActionState,
  formData: FormData,
): Promise<RegisterInterestActionState> {
  const input = {
    contactName: readFormString(formData, "contactName"),
    email: readFormString(formData, "email").toLowerCase(),
    role: readFormString(formData, "role"),
    schoolName: readFormString(formData, "schoolName"),
  };

  const fieldErrors: Partial<Record<RegisterInterestField, string>> = {};

  if (input.schoolName.length < 2) fieldErrors.schoolName = "Enter the school or trust name.";
  else if (input.schoolName.length > 120) fieldErrors.schoolName = "Use 120 characters or fewer.";

  if (input.contactName.length < 2) fieldErrors.contactName = "Enter your name.";
  else if (input.contactName.length > 120) fieldErrors.contactName = "Use 120 characters or fewer.";

  if (!registerInterestRoles.has(input.role)) fieldErrors.role = "Choose your role.";

  if (!isValidEmail(input.email)) fieldErrors.email = "Use a valid work email address.";
  else if (input.email.length > 254) fieldErrors.email = "Use 254 characters or fewer.";

  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Check the highlighted fields.", { fieldErrors });
  }

  if (!process.env.API_BASE_URL) {
    return actionError("Register-interest email is not connected yet. Set API_BASE_URL to the Nest backend URL.", {
      code: "BACKEND_NOT_CONFIGURED",
    });
  }

  try {
    await api.post("/contact/register-interest", input, { auth: false });
    return actionOk({ submitted: true }, "Thanks. We received your interest and will contact you before launch.");
  } catch (error) {
    return actionError(readApiErrorMessage(error));
  }
}
