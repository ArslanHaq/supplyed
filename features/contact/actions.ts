"use server";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { foundingSchoolRoles } from "./founding-interest-options";
import {
  coverBookingOptions,
  currentSupplyOptions,
  daysPerWeekOptions,
  supplyDaysOptions,
  waitlistPhases,
  waitlistSchoolAreas,
  waitlistSchoolRoles,
  waitlistSchoolTypes,
  waitlistTeacherAreas,
  waitlistTeacherRoles,
} from "./waitlist-options";

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
function includes(options: readonly string[], value: string) {
  return options.includes(value);
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
  if (
    !includes(
      [
        ...foundingSchoolRoles,
        "Deputy Head",
        "Cover Manager",
        "HR Lead",
        "MAT / Trust Lead",
      ],
      input.role,
    )
  )
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
    return actionError(apiMessage(error));
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
          phone: read(form, "phone") || undefined,
          currentSupply: read(form, "currentSupply"),
          daysPerWeek: read(form, "daysPerWeek"),
          emailConsent: form.get("emailConsent") === "on",
        }),
  };
  const fieldErrors: Partial<Record<WaitlistField, string>> = {};
  if (type !== "SCHOOL" && type !== "TEACHER")
    fieldErrors.type = "Choose school or teacher.";
  if (school && (input.name.length < 2 || input.name.length > 120))
    fieldErrors.name = "Enter your name (2–120 characters).";
  if (!school) {
    if (!firstName || firstName.length > 60)
      fieldErrors.firstName = "Enter your first name (up to 60 characters).";
    if (!lastName || lastName.length > 60)
      fieldErrors.lastName = "Enter your last name (up to 60 characters).";
    if (input.name.length > 120)
      fieldErrors.lastName = "Use 120 characters or fewer for your full name.";
  }
  if (!validEmail(input.email) || input.email.length > 254)
    fieldErrors.email = "Use a valid email address.";
  if (
    !includes(school ? waitlistSchoolRoles : waitlistTeacherRoles, input.role)
  )
    fieldErrors.role = "Choose your role.";
  if (
    !includes(school ? waitlistSchoolAreas : waitlistTeacherAreas, input.area)
  )
    fieldErrors.area = "Choose an area.";
  if ("organizationName" in input) {
    if (
      !input.organizationName ||
      input.organizationName.length < 2 ||
      input.organizationName.length > 160
    )
      fieldErrors.organizationName =
        "Enter your school name (2–160 characters).";
    if (!includes(waitlistSchoolTypes, input.schoolType ?? ""))
      fieldErrors.schoolType = "Choose your school type.";
    if (!includes(supplyDaysOptions, input.supplyDaysPerTerm ?? ""))
      fieldErrors.supplyDaysPerTerm = "Choose your approximate supply days.";
    if (!includes(coverBookingOptions, input.coverBookingMethod ?? ""))
      fieldErrors.coverBookingMethod = "Choose how you book cover.";
  } else {
    if (
      input.phone &&
      (input.phone.length > 32 ||
        !/^[+()\d\s-]+$/.test(input.phone) ||
        input.phone.replace(/\D/g, "").length < 10)
    )
      fieldErrors.phone = "Use a valid mobile number or leave it blank.";
    if (!includes(currentSupplyOptions, input.currentSupply ?? ""))
      fieldErrors.currentSupply = "Choose your current supply situation.";
    if (!includes(daysPerWeekOptions, input.daysPerWeek ?? ""))
      fieldErrors.daysPerWeek = "Choose how many days you would like.";
    if (!input.emailConsent)
      fieldErrors.emailConsent =
        "Please agree to receive first-cohort and launch emails.";
  }
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
    return actionError(apiMessage(error));
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
  const postcode = read(form, "postcode").toUpperCase();
  const fieldErrors: Partial<
    Record<"phases" | "mainSubject" | "postcode", string>
  > = {};
  if (phases.some((phase) => !includes(waitlistPhases, phase)))
    fieldErrors.phases = "Choose one of the listed phases.";
  if (mainSubject.length > 100)
    fieldErrors.mainSubject = "Use 100 characters or fewer.";
  if (postcode && !/^[A-Z]{1,2}\d[A-Z\d]?(?:\s*\d[A-Z]{2})?$/.test(postcode))
    fieldErrors.postcode =
      "Enter a UK postcode area or postcode, for example M20 or M20 2AB.";
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
    return actionError(apiMessage(error));
  }
}
