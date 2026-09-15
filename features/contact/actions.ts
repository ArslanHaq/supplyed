"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import {
  foundingSchoolCoverTypes,
  foundingSchoolRoles,
  foundingSchoolTiers,
  foundingTeacherKeyStages,
  foundingTeacherRoles,
  foundingTeacherSkills,
  foundingTeacherSubjects,
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
type FoundingInterestSubmitResult = { alreadyRegistered?: boolean; id: string; submitted: true };

type FoundingInterestField =
  | "availability"
  | "bio"
  | "campaign"
  | "coverTypes"
  | "dailyRate"
  | "email"
  | "hourlyRate"
  | "institutionAddress"
  | "institutionCity"
  | "institutionDomain"
  | "keyStages"
  | "localAuthority"
  | "maxTravelDistance"
  | "message"
  | "name"
  | "organizationName"
  | "phone"
  | "phase"
  | "postcode"
  | "role"
  | "schoolType"
  | "skills"
  | "source"
  | "subjects"
  | "tier"
  | "typicalPupilCount"
  | "type"
  | "yearsExperience";

export type FoundingInterestActionState = ActionResult<FoundingInterestSubmitResult, FoundingInterestField> | null;

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  return /^[0-9+()\s-]{10,}$/.test(phone);
}

function isValidDomain(domain: string) {
  return /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(domain);
}

function readFormStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isNonNegativeNumber(value: string) {
  if (!value) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
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

function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase() ?? "";
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
  const schoolProfileInput = {
    coverTypes: readFormStringArray(formData, "coverTypes"),
    institutionAddress: readFormString(formData, "institutionAddress"),
    institutionCity: readFormString(formData, "institutionCity"),
    institutionDomain: normalizeDomain(readFormString(formData, "institutionDomain")),
    localAuthority: readFormString(formData, "localAuthority"),
    typicalPupilCount: readFormString(formData, "typicalPupilCount").replace(/\D/g, ""),
  };
  const teacherProfileInput = {
    bio: readFormString(formData, "bio"),
    dailyRate: readFormString(formData, "dailyRate").replace(/[^\d.]/g, ""),
    hourlyRate: readFormString(formData, "hourlyRate").replace(/[^\d.]/g, ""),
    keyStages: readFormStringArray(formData, "keyStages"),
    maxTravelDistance: readFormString(formData, "maxTravelDistance").replace(/[^\d.]/g, ""),
    skills: readFormStringArray(formData, "skills"),
    subjects: readFormStringArray(formData, "subjects"),
    yearsExperience: readFormString(formData, "yearsExperience").replace(/[^\d]/g, ""),
  };

  const fieldErrors: Partial<Record<FoundingInterestField, string>> = {};

  if (type !== "SCHOOL" && type !== "TEACHER") {
    fieldErrors.type = "Choose a valid register-interest type.";
  }

  if (input.name.length < 2) fieldErrors.name = "Enter your name.";
  else if (input.name.length > 120) fieldErrors.name = "Use 120 characters or fewer.";

  if (!isValidEmail(input.email)) fieldErrors.email = isSchool ? "Use a valid work email address." : "Use a valid email address.";
  else if (input.email.length > 254) fieldErrors.email = "Use 254 characters or fewer.";

  if (!input.phone) fieldErrors.phone = "Enter a contact number.";
  else if (input.phone.length > 32) fieldErrors.phone = "Use 32 characters or fewer.";
  else if (!isValidPhone(input.phone)) fieldErrors.phone = "Use a valid contact number.";
  if (input.postcode.length < 2) fieldErrors.postcode = "Enter a postcode.";
  else if (input.postcode.length > 20) fieldErrors.postcode = "Use 20 characters or fewer.";
  if (input.message.length > 2000) fieldErrors.message = "Use 2000 characters or fewer.";

  if (isSchool) {
    if (input.organizationName.length < 2) fieldErrors.organizationName = "Enter the school or trust name.";
    else if (input.organizationName.length > 160) fieldErrors.organizationName = "Use 160 characters or fewer.";
    if (!isOneOf(input.role, foundingSchoolRoles)) fieldErrors.role = "Choose your role.";
    if (!isOneOf(input.schoolType, schoolTypes)) fieldErrors.schoolType = "Choose the school type.";
    if (input.tier && !isOneOf(input.tier, foundingSchoolTiers)) fieldErrors.tier = "Choose a valid tier.";
    if (schoolProfileInput.institutionDomain && !isValidDomain(schoolProfileInput.institutionDomain)) {
      fieldErrors.institutionDomain = "Use a valid domain, for example greenfield.ac.uk.";
    }
    if (schoolProfileInput.institutionAddress.length > 180) fieldErrors.institutionAddress = "Use 180 characters or fewer.";
    if (schoolProfileInput.institutionCity.length > 100) fieldErrors.institutionCity = "Use 100 characters or fewer.";
    if (schoolProfileInput.localAuthority.length > 100) fieldErrors.localAuthority = "Use 100 characters or fewer.";
    if (schoolProfileInput.typicalPupilCount && Number(schoolProfileInput.typicalPupilCount) < 0) {
      fieldErrors.typicalPupilCount = "Pupil count cannot be negative.";
    }
    if (schoolProfileInput.coverTypes.some((coverType) => !isOneOf(coverType, foundingSchoolCoverTypes))) {
      fieldErrors.coverTypes = "Choose valid staffing needs.";
    }
  } else {
    if (!isOneOf(input.role, foundingTeacherRoles)) fieldErrors.role = "Choose your role.";
    if (!isOneOf(input.phase, teacherPhases)) fieldErrors.phase = "Choose the phase you work in.";
    if (input.availability && !isOneOf(input.availability, teacherAvailabilityOptions)) {
      fieldErrors.availability = "Choose a valid availability option.";
    }
    if (teacherProfileInput.subjects.some((subject) => !isOneOf(subject, foundingTeacherSubjects))) {
      fieldErrors.subjects = "Choose valid subjects.";
    }
    if (teacherProfileInput.keyStages.some((keyStage) => !isOneOf(keyStage, foundingTeacherKeyStages))) {
      fieldErrors.keyStages = "Choose valid key stages.";
    }
    if (teacherProfileInput.skills.some((skill) => !isOneOf(skill, foundingTeacherSkills))) {
      fieldErrors.skills = "Choose valid skills.";
    }
    if (teacherProfileInput.yearsExperience && !isNonNegativeNumber(teacherProfileInput.yearsExperience)) {
      fieldErrors.yearsExperience = "Experience cannot be negative.";
    }
    if (teacherProfileInput.dailyRate && !isNonNegativeNumber(teacherProfileInput.dailyRate)) fieldErrors.dailyRate = "Daily rate cannot be negative.";
    if (teacherProfileInput.hourlyRate && !isNonNegativeNumber(teacherProfileInput.hourlyRate)) fieldErrors.hourlyRate = "Hourly rate cannot be negative.";
    if (teacherProfileInput.maxTravelDistance && !isNonNegativeNumber(teacherProfileInput.maxTravelDistance)) {
      fieldErrors.maxTravelDistance = "Travel distance cannot be negative.";
    }
    if (teacherProfileInput.bio.length > 1200) {
      fieldErrors.bio = "Use 1200 characters or fewer.";
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
    const result = await api.post<FoundingInterestSubmitResult>("/contact/founding-interest", input, { auth: false });
    return actionOk(
      result,
      result.alreadyRegistered
        ? "This email is already registered. Continue to signup with the same email."
        : "Thanks. We received your details and will contact you before launch.",
    );
  } catch (error) {
    return actionError(readApiErrorMessage(error));
  }
}
