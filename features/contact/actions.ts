"use server";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { validateWaitlist, validateWaitlistDetails } from "./validation";
import { validateUkPhone, validateUkPostcode } from "@/lib/uk-validation";

type RegisterInterestField = "contactName" | "email" | "role" | "schoolName";
export type RegisterInterestActionState = ActionResult<
  { submitted: true },
  RegisterInterestField
> | null;
export type WaitlistField =
  | "type"
  | "firstName"
  | "lastName"
  | "name"
  | "email"
  | "phone"
  | "role"
  | "organizationName"
  | "schoolType"
  | "area"
  | "supplyDaysPerTerm"
  | "coverBookingMethod"
  | "currentSupply"
  | "daysPerWeek"
  | "emailConsent";
export type FoundingInterestSubmitResult = {
  id: string;
  submitted: true;
  alreadyRegistered?: boolean;
  detailsToken?: string;
  confirmationEmailSent?: boolean;
};
export type FoundingInterestActionState = ActionResult<
  FoundingInterestSubmitResult,
  WaitlistField
> | null;
export type WaitlistDetailsState = ActionResult<
  { saved: true },
  "phases" | "mainSubject" | "postcode"
> | null;

function read(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function apiMessage(error: unknown) {
  return error instanceof ApiError && error.status !== 503
    ? error.message
    : "We could not send your details right now. Please try again in a few minutes.";
}

export async function registerInterestAction(
  _previousState: RegisterInterestActionState,
  form: FormData,
): Promise<RegisterInterestActionState> {
  const input = {
    contactName: read(form, "contactName"),
    email: read(form, "email").toLowerCase(),
    role: read(form, "role"),
    schoolName: read(form, "schoolName"),
  };
  const fieldErrors: Partial<Record<RegisterInterestField, string>> = {};
  if (input.contactName.length < 2 || input.contactName.length > 120)
    fieldErrors.contactName = "Enter your name (2–120 characters).";
  if (input.schoolName.length < 2 || input.schoolName.length > 120)
    fieldErrors.schoolName =
      "Enter the school or trust name (2–120 characters).";
  if (!validEmail(input.email) || input.email.length > 254)
    fieldErrors.email = "Use a valid work email address.";
  if (!input.role || input.role.length > 100)
    fieldErrors.role = "Choose your role.";
  if (Object.keys(fieldErrors).length)
    return actionError("Check the highlighted fields.", { fieldErrors });
  if (!process.env.API_BASE_URL)
    return actionError("Registration is temporarily unavailable.", {
      code: "BACKEND_NOT_CONFIGURED",
    });
  try {
    await api.post("/contact/register-interest", input, { auth: false });
    return actionOk(
      { submitted: true },
      "Thanks. We received your interest and will contact you before launch.",
    );
  } catch (error) {
    return actionError(apiMessage(error), { retryAfter: error instanceof ApiError ? error.retryAfter : undefined, fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined, code: error instanceof ApiError ? error.code : undefined });
  }
}

export async function foundingInterestAction(
  _previousState: FoundingInterestActionState,
  form: FormData,
): Promise<FoundingInterestActionState> {
  const type = read(form, "type");
  const school = type === "SCHOOL";
  const firstName = read(form, "firstName"),
    lastName = read(form, "lastName");
  const input = {
    type,
    name: school ? read(form, "name") : `${firstName} ${lastName}`.trim(),
    email: read(form, "email").toLowerCase(),
    role: read(form, "role"),
    area: read(form, "area"),
    source:
      read(form, "source").slice(0, 80) ||
      (school ? "founding-schools-landing" : "founding-teachers-landing"),
    campaign: read(form, "campaign").slice(0, 120) || undefined,
    ...(school
      ? {
          organizationName: read(form, "organizationName"),
          schoolType: read(form, "schoolType"),
          supplyDaysPerTerm: read(form, "supplyDaysPerTerm"),
          coverBookingMethod: read(form, "coverBookingMethod"),
          foundingProgrammeInterest:
            form.get("foundingProgrammeInterest") === "on",
        }
      : {
          firstName,
          lastName,
          phone: validateUkPhone(read(form, "phone")).value || undefined,
          currentSupply: read(form, "currentSupply"),
          daysPerWeek: read(form, "daysPerWeek"),
          emailConsent: form.get("emailConsent") === "on",
        }),
  };
  const fieldErrors = validateWaitlist(form);
  if (Object.keys(fieldErrors).length)
    return actionError("Check the highlighted fields.", { fieldErrors });
  if (!process.env.API_BASE_URL)
    return actionError("The waitlist is temporarily unavailable.", {
      code: "BACKEND_NOT_CONFIGURED",
    });
  try {
    const result = await api.post<FoundingInterestSubmitResult>(
      "/contact/founding-interest",
      input,
      { auth: false },
    );
    return actionOk(
      result,
      result.alreadyRegistered
        ? "Your interest is already registered. We will keep you updated before launch."
        : "You're on the waitlist. No checks, no commitment.",
    );
  } catch (error) {
    return actionError(apiMessage(error), { retryAfter: error instanceof ApiError ? error.retryAfter : undefined, fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined, code: error instanceof ApiError ? error.code : undefined });
  }
}

export async function saveWaitlistDetailsAction(
  _previousState: WaitlistDetailsState,
  form: FormData,
): Promise<WaitlistDetailsState> {
  const phases = [
    ...new Set(
      form
        .getAll("phases")
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const mainSubject = read(form, "mainSubject");
  const postcode = validateUkPostcode(read(form, "postcode")).value;
  const fieldErrors = validateWaitlistDetails(form);
  if (Object.keys(fieldErrors).length)
    return actionError("Check the highlighted fields.", { fieldErrors });
  const id = read(form, "id"),
    token = read(form, "token");
  if (!id || !token)
    return actionError(
      "Your details session has expired. Your place on the waitlist is still saved.",
    );
  try {
    await api.patch(
      `/contact/founding-interest/${encodeURIComponent(id)}/details`,
      { token, phases, mainSubject, postcode },
      { auth: false },
    );
    return actionOk(
      { saved: true },
      "Your extra details have been saved. Thank you!",
    );
  } catch (error) {
    return actionError(apiMessage(error), { retryAfter: error instanceof ApiError ? error.retryAfter : undefined, fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined, code: error instanceof ApiError ? error.code : undefined });
  }
}
