"use server";

import { backendEnabled } from "@/lib/server/backend-config";

import { revalidateTag } from "next/cache";

import { normalizeRole } from "@/features/auth/backend";
import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import type { AppRole } from "@/types/supplyed";

import { getSettingsProfileSnapshot } from "./queries";
import { validateSettingsInput } from "./validation";
import { validateUkCity, validateUkCountry, validateUkPhone, validateUkPostcode, validateUkRegion } from "@/lib/uk-validation";
import type {
  SettingsInstitutionUpdateInput,
  SettingsInstructorUpdateInput,
  SettingsProfileSnapshot,
  SettingsUpdateInput,
  SettingsUserUpdateInput,
} from "./types";



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

function userPayload(input: SettingsUserUpdateInput) {
  // Phone changes are saved by the verification endpoint, including across tabs.
  return {
    name: text(input.name),
  };
}

function instructorPayload(input: SettingsInstructorUpdateInput) {
  const hourlyRate = optionalNumber(input.hourlyRate);
  const dailyRate = optionalNumber(input.dailyRate);
  const experience = optionalNumber(input.experience);
  const maxTravelDistance = optionalNumber(input.maxTravelDistance);

  if ([hourlyRate, dailyRate, experience, maxTravelDistance].some(hasInvalidNumber)) {
    throw new Error("Rates, experience, and travel distance must be valid positive numbers.");
  }

  return withoutUndefined({
    address: optionalText(input.address),
    bio: optionalText(input.bio),
    city: validateUkCity(input.city).value,
    countryCode: validateUkCountry(input.countryCode, { required: true }).value,
    county: validateUkRegion(input.county).value,
    currency: optionalText(input.currency) ?? "GBP",
    dailyRate,
    experience,
    fullName: text(input.fullName),
    hourlyRate,

    keyStages: normalizeStringArray(input.keyStages),
    maxTravelDistance,
    postalCode: validateUkPostcode(input.postalCode).value,
    skills: normalizeStringArray(input.skills),
    subjects: normalizeStringArray(input.subjects),
  });
}

function institutionPayload(input: SettingsInstitutionUpdateInput) {
  const typicalPupilCount = optionalNumber(input.typicalPupilCount);

  if (hasInvalidNumber(typicalPupilCount)) {
    throw new Error("Typical pupil count must be a valid positive number.");
  }

  return withoutUndefined({
    address: text(input.address),
    city: validateUkCity(input.city).value,
    complianceContact: optionalText(input.complianceContact),
    complianceEmail: optionalText(input.complianceEmail),
    countryCode: validateUkCountry(input.countryCode, { required: true }).value,
    county: validateUkRegion(input.county).value,
    coverTypes: normalizeStringArray(input.coverTypes),
    domain: text(input.domain).replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase(),
    name: text(input.name),
    postalCode: validateUkPostcode(input.postalCode).value,
    registrationId: optionalText(input.registrationId),
    safeguardingConfirmed: input.safeguardingConfirmed,
    staffingNeeds: optionalText(input.staffingNeeds),
    typicalPupilCount,
    userRole: optionalText(input.userRole),
  });
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
    role: input.role,
    user: {
      ...current.user,
      name: text(input.user.name),
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
  if (explicitType) return explicitType;

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
      signal: AbortSignal.timeout(120_000),
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
  let userSaved = false;
  try {
    if (!input || !input.user || typeof input.user !== "object") return actionError("Check your settings and try again.");
    const fieldErrors = validateSettingsInput(input);
    if (Object.keys(fieldErrors).length > 0) {
      return actionError("Check the highlighted settings and try again.", { fieldErrors });
    }
    // Validate both payloads before starting the existing two-request save.
    const profilePayload = input.role === "teacher" && input.instructor
      ? instructorPayload(input.instructor)
      : input.role === "institution" && input.institution ? institutionPayload(input.institution) : undefined;
    const current = await getSettingsProfileSnapshot();
    const savedPhone = validateUkPhone(current.user.phone);
    if (!savedPhone.valid) return actionError("Update and verify your saved UK phone number before saving your profile.", { fieldErrors: { phone: savedPhone.error! } });

    if (!backendEnabled()) {
      return actionOk(mergeLocalSnapshot(current, input), "Settings saved locally for backend-disabled development.");
    }

    const authContext = await getServerAuthContext();
    if (!authContext?.userId) {
      return actionError("Your session expired. Sign in again to continue.", { code: "SESSION_EXPIRED" });
    }

    assertRoleAllowed(normalizeRole(authContext.role), input.role);

    if (input.role === "teacher" && (!input.instructor || !(input.instructor.id || current.instructor?.id || authContext.instructorProfileId))) {
      return actionError("Teacher profile was not found.");
    }
    if (input.role === "institution" && (!input.institution || !(input.institution.id || current.institution?.id || authContext.institutionProfileId))) {
      return actionError("Institution profile was not found.");
    }

    await api.patch("/users/me", userPayload(input.user));
    userSaved = true;

    if (input.role === "teacher") {
      const profileId = input.instructor?.id || current.instructor?.id || authContext.instructorProfileId || "";
      if (!profileId || !input.instructor) return actionError("Teacher profile was not found.");

      await api.patch(`/instructors/${profileId}`, profilePayload);
    }

    if (input.role === "institution") {
      const profileId = input.institution?.id || current.institution?.id || authContext.institutionProfileId || "";
      if (!profileId || !input.institution) return actionError("Institution profile was not found.");

      await api.patch(`/institutions/${profileId}`, profilePayload);
    }

    revalidateTag("settings", "max");
    revalidateTag("auth", "max");
    revalidateTag("auth:me", "max");
    revalidateTag("onboarding", "max");

    return actionOk(await getSettingsProfileSnapshot(), "Settings saved.");
  } catch (error) {
    if (userSaved && !(error instanceof ApiError && error.status === 401)) {
      revalidateTag("settings", "max");
      revalidateTag("auth", "max");
      return actionError("Your account details were saved, but the full profile update could not be confirmed. Please try saving again.", { code: "SETTINGS_PARTIAL_SAVE" });
    }
    return actionFailure(error, "Settings could not be saved. Check the details and try again.");
  }
}
