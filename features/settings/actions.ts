"use server";

import { revalidateTag } from "next/cache";

import { normalizeRole } from "@/features/auth/backend";
import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import type { AppRole } from "@/types/supplyed";

import { getSettingsProfileSnapshot } from "./queries";
import type {
  SettingsInstitutionUpdateInput,
  SettingsInstructorUpdateInput,
  SettingsProfileSnapshot,
  SettingsRecruiterUpdateInput,
  SettingsUpdateInput,
  SettingsUserUpdateInput,
} from "./types";

type SettingsActionField =
  | "address"
  | "bio"
  | "city"
  | "complianceEmail"
  | "displayName"
  | "domain"
  | "fullName"
  | "name"
  | "phone"
  | "schoolName";

const phonePattern = /^[0-9+()\s-]{7,}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function optionalText(value: string | undefined) {
  const normalized = text(value);
  return normalized || undefined;
}

function normalizeStringArray(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function optionalNumber(value: string | undefined) {
  const normalized = text(value);
  if (!normalized) return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return parsed;
}

function hasInvalidNumber(value: number | undefined) {
  return typeof value === "number" && Number.isNaN(value);
}

function withoutUndefined<Input extends Record<string, unknown>>(input: Input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<Input>;
}

function actionFailure(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return actionError(error.message || fallback, { code: error.code });
  }

  if (error instanceof Error && error.message.trim()) {
    return actionError(error.message);
  }

  return actionError(fallback);
}

function validateUser(input: SettingsUserUpdateInput) {
  const errors: Partial<Record<SettingsActionField, string>> = {};
  const name = text(input.name);
  const phone = text(input.phone);

  if (!name) errors.name = "Enter your display name.";
  if (phone && !phonePattern.test(phone)) errors.phone = "Use a valid phone number.";

  return errors;
}

function userPayload(input: SettingsUserUpdateInput) {
  return withoutUndefined({
    name: text(input.name),
    phone: optionalText(input.phone),
  });
}

function instructorPayload(input: SettingsInstructorUpdateInput) {
  const hourlyRate = optionalNumber(input.hourlyRate);
  const dailyRate = optionalNumber(input.dailyRate);
  const experience = optionalNumber(input.experience);
  const maxTravelDistance = optionalNumber(input.maxTravelDistance);

  if (
    [hourlyRate, dailyRate, experience, maxTravelDistance].some(hasInvalidNumber) ||
    (experience !== undefined && !Number.isInteger(experience))
  ) {
    throw new Error("Rates, experience, and travel distance must be valid positive numbers.");
  }

  return withoutUndefined({
    address: optionalText(input.address),
    bio: optionalText(input.bio),
    city: optionalText(input.city),
    countryCode: optionalText(input.countryCode) ?? "GB",
    county: optionalText(input.county),
    currency: optionalText(input.currency) ?? "GBP",
    dailyRate,
    experience,
    fullName: text(input.fullName),
    hourlyRate,

    keyStages: normalizeStringArray(input.keyStages),
    maxTravelDistance,
    postalCode: optionalText(input.postalCode),
    skills: normalizeStringArray(input.skills),
    subjects: normalizeStringArray(input.subjects),
  });
}

function institutionPayload(input: SettingsInstitutionUpdateInput) {
  const typicalPupilCount = optionalNumber(input.typicalPupilCount);

  if (
    hasInvalidNumber(typicalPupilCount) ||
    (typicalPupilCount !== undefined && !Number.isInteger(typicalPupilCount))
  ) {
    throw new Error("Typical pupil count must be a valid positive number.");
  }

  return withoutUndefined({
    address: text(input.address),
    city: text(input.city),
    complianceContact: optionalText(input.complianceContact),
    complianceEmail: optionalText(input.complianceEmail),
    countryCode: optionalText(input.countryCode) ?? "GB",
    county: optionalText(input.county),
    coverTypes: normalizeStringArray(input.coverTypes),
    domain: text(input.domain)
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      ?.trim()
      .toLowerCase(),
    name: text(input.name),
    postalCode: optionalText(input.postalCode),
    registrationId: optionalText(input.registrationId),
    safeguardingConfirmed: input.safeguardingConfirmed,
    staffingNeeds: optionalText(input.staffingNeeds),
    typicalPupilCount,
    userRole: optionalText(input.userRole),
  });
}

function recruiterPayload(input: SettingsRecruiterUpdateInput) {
  return withoutUndefined({
    address: optionalText(input.address),
    bio: optionalText(input.bio),
    city: optionalText(input.city),
    countryCode: optionalText(input.countryCode) ?? "GB",
    county: optionalText(input.county),
    displayName: text(input.displayName),

    postalCode: optionalText(input.postalCode),
  });
}

function validateProfile(input: SettingsUpdateInput) {
  const errors: Partial<Record<SettingsActionField, string>> = {};

  if (input.role === "teacher") {
    if (!text(input.instructor?.fullName)) errors.fullName = "Enter your teacher profile name.";
  }

  if (input.role === "institution") {
    if (!text(input.institution?.name)) errors.schoolName = "Enter the school or organisation name.";
    if (!text(input.institution?.domain)) errors.domain = "Enter the institution domain.";
    if (!text(input.institution?.address)) errors.address = "Enter the institution address.";
    if (!text(input.institution?.city)) errors.city = "Enter the city.";
    if (input.institution?.complianceEmail && !emailPattern.test(text(input.institution.complianceEmail))) {
      errors.complianceEmail = "Use a valid compliance email.";
    }
  }

  if (input.role === "individual") {
    if (!text(input.recruiter?.displayName)) errors.displayName = "Enter your profile display name.";
  }

  return errors;
}

function mergeLocalSnapshot(current: SettingsProfileSnapshot, input: SettingsUpdateInput): SettingsProfileSnapshot {
  return {
    ...current,
    institution:
      input.role === "institution" && input.institution && current.institution
        ? { ...current.institution, ...input.institution }
        : current.institution,
    instructor:
      input.role === "teacher" && input.instructor && current.instructor
        ? { ...current.instructor, ...input.instructor }
        : current.instructor,
    recruiter:
      input.role === "individual" && input.recruiter && current.recruiter
        ? { ...current.recruiter, ...input.recruiter }
        : current.recruiter,
    role: input.role,
    user: {
      ...current.user,
      name: text(input.user.name),
      phone: text(input.user.phone),
    },
  };
}

function assertRoleAllowed(sessionRole: AppRole | null, requestedRole: AppRole) {
  if (!sessionRole || sessionRole === requestedRole) return;
  throw new Error("Refresh the page before saving settings for this account role.");
}

const profileImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxProfileImageBytes = 5 * 1024 * 1024;

type ProfileImageUploadUrlResponse = {
  expiresAt?: string | Date;
  fileKey?: string;
  requiredHeaders?: Record<string, string>;
  uploadUrl?: string;
  url?: string;
};

type ProfileImageResponse = {
  expiresAt?: string | Date | null;
  imageUrl?: string | null;
};

export type SettingsProfileImageUploadResult = {
  expiresAt: string | null;
  imageUrl: string | null;
};

function readFormFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size <= 0) return null;
  return value;
}

function profileImageContentType(file: File) {
  const explicitType = file.type.toLowerCase();
  if (profileImageTypes.has(explicitType)) return explicitType;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";

  return explicitType;
}

function validateProfileImage(file: File | null) {
  if (!file) return "Choose a profile image to upload.";
  if (file.size > maxProfileImageBytes) return "Profile image must be 5 MB or smaller.";
  if (!profileImageTypes.has(profileImageContentType(file))) return "Profile image must be a JPG, PNG, or WebP file.";
  return undefined;
}

function responseDate(value: string | Date | null | undefined) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.trim() ? value : null;
}

export async function uploadSettingsProfileImageAction(formData: FormData) {
  const file = readFormFile(formData, "file");
  const validationError = validateProfileImage(file);

  if (validationError) {
    return actionError(validationError);
  }

  if (!backendEnabled()) {
    return actionError("Profile image upload requires backend file storage.");
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.userId) {
    return actionError("Your session expired. Sign in again to continue.", { code: "SESSION_EXPIRED" });
  }

  try {
    const contentType = profileImageContentType(file!);
    const upload = await api.post<ProfileImageUploadUrlResponse>("/users/me/profile-image/upload-url", {
      contentType,
      sizeBytes: file!.size,
    });
    const uploadUrl = upload.uploadUrl ?? upload.url;
    const fileKey = upload.fileKey;

    if (!uploadUrl || !fileKey) {
      throw new Error("The backend did not return a profile image upload URL.");
    }

    const uploadResponse = await fetch(uploadUrl, {
      body: file!,
      headers: { "Content-Type": contentType, ...(upload.requiredHeaders ?? {}) },
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      throw new Error(`Unable to upload ${file!.name}. The signed upload failed with status ${uploadResponse.status}.`);
    }

    const completed = await api.post<ProfileImageResponse>("/users/me/profile-image/upload-complete", { fileKey });

    revalidateTag("settings", "max");
    revalidateTag("auth", "max");
    revalidateTag("auth:me", "max");
    revalidateTag("onboarding", "max");

    return actionOk<SettingsProfileImageUploadResult>(
      {
        expiresAt: responseDate(completed.expiresAt),
        imageUrl: completed.imageUrl ?? null,
      },
      "Profile image updated.",
    );
  } catch (error) {
    return actionFailure(error, "Profile image could not be uploaded. Choose another image and try again.");
  }
}

export async function updateSettingsAction(input: SettingsUpdateInput) {
  const userErrors = validateUser(input.user);
  const profileErrors = validateProfile(input);
  const fieldErrors = { ...userErrors, ...profileErrors };

  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Check the highlighted settings and try again.", { fieldErrors });
  }

  try {
    const current = await getSettingsProfileSnapshot();

    if (!backendEnabled()) {
      return actionOk(mergeLocalSnapshot(current, input), "Settings saved locally for backend-disabled development.");
    }

    const authContext = await getServerAuthContext();
    if (!authContext?.userId) {
      return actionError("Your session expired. Sign in again to continue.", { code: "SESSION_EXPIRED" });
    }

    assertRoleAllowed(normalizeRole(authContext.role), input.role);

    await api.patch("/users/me", userPayload(input.user));

    if (input.role === "teacher") {
      const profileId = input.instructor?.id || current.instructor?.id || authContext.instructorProfileId || "";
      if (!profileId || !input.instructor) return actionError("Teacher profile was not found.");

      await api.patch(`/instructors/${profileId}`, instructorPayload(input.instructor));
    }

    if (input.role === "institution") {
      const profileId = input.institution?.id || current.institution?.id || authContext.institutionProfileId || "";
      if (!profileId || !input.institution) return actionError("Institution profile was not found.");

      await api.patch(`/institutions/${profileId}`, institutionPayload(input.institution));
    }

    if (input.role === "individual") {
      if (!input.recruiter) return actionError("Individual profile was not found.");
      await api.patch("/recruiters/me", recruiterPayload(input.recruiter));
    }

    revalidateTag("settings", "max");
    revalidateTag("auth", "max");
    revalidateTag("auth:me", "max");
    revalidateTag("onboarding", "max");

    return actionOk(await getSettingsProfileSnapshot(), "Settings saved.");
  } catch (error) {
    return actionFailure(error, "Settings could not be saved. Check the details and try again.");
  }
}
