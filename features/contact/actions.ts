"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import {
  foundingSchoolRoles,
  foundingSchoolTiers,
  foundingTeacherRoles,
  schoolTypes,
  teacherAvailabilityOptions,
  teacherPhases,
} from "./founding-interest-options";

const registerInterestRoles = new Set([
  "Head Teacher",
  "Deputy Head",
  "Cover Manager",
  "HR Lead",
  "MAT / Trust Lead",
  ...foundingSchoolRoles,
]);

type RegisterInterestField = "contactName" | "email" | "role" | "schoolName";

export type RegisterInterestActionState = ActionResult<{ submitted: true }, RegisterInterestField> | null;

type FoundingInterestType = "SCHOOL" | "TEACHER";

type FoundingInterestField =
  | "availability"
  | "campaign"
  | "email"
  | "message"
  | "name"
  | "organizationName"
  | "phone"
  | "phase"
  | "postcode"
  | "role"
  | "schoolType"
  | "source"
  | "tier"
  | "type";

export type FoundingInterestActionState = ActionResult<{ id: string; submitted: true }, FoundingInterestField> | null;

function readFormString(formData: FormData, key: string) {
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

function isOneOf<T extends readonly string[]>(value: string, options: T): value is T[number] {
  return options.includes(value as T[number]);
}

function normalizeSource(value: string, fallback: string) {
  return value ? value.slice(0, 80) : fallback;
}

function normalizeCampaign(value: string) {
  return value ? value.slice(0, 120) : undefined;
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

export async function foundingInterestAction(
  _previousState: FoundingInterestActionState,
  formData: FormData,
): Promise<FoundingInterestActionState> {
  const type = readFormString(formData, "type") as FoundingInterestType;
  const isSchool = type === "SCHOOL";
  const input = {
    availability: readFormString(formData, "availability"),
    campaign: normalizeCampaign(readFormString(formData, "campaign")),
    email: readFormString(formData, "email").toLowerCase(),
    message: readFormString(formData, "message"),
    name: readFormString(formData, "name"),
    organizationName: readFormString(formData, "organizationName"),
    phone: readFormString(formData, "phone"),
    phase: readFormString(formData, "phase"),
    postcode: readFormString(formData, "postcode").toUpperCase(),
    role: readFormString(formData, "role"),
    schoolType: readFormString(formData, "schoolType"),
    source: normalizeSource(
      readFormString(formData, "source"),
      isSchool ? "founding-schools-landing" : "founding-teachers-landing",
    ),
    tier: readFormString(formData, "tier"),
    type,
  };

  const fieldErrors: Partial<Record<FoundingInterestField, string>> = {};

  if (type !== "SCHOOL" && type !== "TEACHER") {
    fieldErrors.type = "Choose a valid register-interest type.";
  }

  if (input.name.length < 2) fieldErrors.name = "Enter your name.";
  else if (input.name.length > 120) fieldErrors.name = "Use 120 characters or fewer.";

  if (!isValidEmail(input.email)) fieldErrors.email = isSchool ? "Use a valid work email address." : "Use a valid email address.";
  else if (input.email.length > 254) fieldErrors.email = "Use 254 characters or fewer.";

  if (input.phone.length > 32) fieldErrors.phone = "Use 32 characters or fewer.";
  if (input.postcode.length < 2) fieldErrors.postcode = "Enter a postcode.";
  else if (input.postcode.length > 20) fieldErrors.postcode = "Use 20 characters or fewer.";
  if (input.message.length > 2000) fieldErrors.message = "Use 2000 characters or fewer.";

  if (isSchool) {
    if (input.organizationName.length < 2) fieldErrors.organizationName = "Enter the school or trust name.";
    else if (input.organizationName.length > 160) fieldErrors.organizationName = "Use 160 characters or fewer.";
    if (!isOneOf(input.role, foundingSchoolRoles)) fieldErrors.role = "Choose your role.";
    if (!isOneOf(input.schoolType, schoolTypes)) fieldErrors.schoolType = "Choose the school type.";
    if (input.tier && !isOneOf(input.tier, foundingSchoolTiers)) fieldErrors.tier = "Choose a valid tier.";
  } else {
    if (!isOneOf(input.role, foundingTeacherRoles)) fieldErrors.role = "Choose your role.";
    if (!isOneOf(input.phase, teacherPhases)) fieldErrors.phase = "Choose the phase you work in.";
    if (input.availability && !isOneOf(input.availability, teacherAvailabilityOptions)) {
      fieldErrors.availability = "Choose a valid availability option.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Check the highlighted fields.", { fieldErrors });
  }

  if (!process.env.API_BASE_URL) {
    return actionError("Register-interest capture is not connected yet. Set API_BASE_URL to the Nest backend URL.", {
      code: "BACKEND_NOT_CONFIGURED",
    });
  }

  try {
    const result = await api.post<{ id: string; submitted: true }>("/contact/founding-interest", input, { auth: false });
    return actionOk(result, "Thanks. We received your details and will contact you before launch.");
  } catch (error) {
    return actionError(readApiErrorMessage(error));
  }
}
