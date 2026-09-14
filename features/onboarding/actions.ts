"use server";

import { revalidateTag } from "next/cache";

import { normalizeRole, normalizeStatus, refreshBackendAuth } from "@/features/auth/backend";
import { createVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";
import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { contentTypeForFile } from "./document-utils";
import {
  assertRequiredDocumentsUploaded,
  emptyDocumentState,
  getDocumentSnapshots,
  getDocumentState,
  getProfileDocumentRequirements,
  uploadProfileDocument,
  validateDocumentFile,
} from "./documents";
import { normalizeOnboardingSubmitInput } from "./schemas";
import type {
  OnboardingDocumentDownloadResult,
  OnboardingDocumentSnapshot,
  OnboardingDocumentState,
  OnboardingDocumentUploadResult,
  OnboardingInstructorSnapshot,
  OnboardingInstitutionSnapshot,
  OnboardingProfileSnapshot,
  OnboardingProgressResult,
  OnboardingRecruiterSnapshot,
  OnboardingSubmitInput,
  OnboardingSubmitResult,
  OnboardingUserSnapshot,
} from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

type InstructorProfilePayload = {
  bio?: string;
  currency?: string;
  dailyRate?: number;
  experience?: number;
  fullName: string;
  hourlyRate?: number;
  keyStages?: string[];
  maxTravelDistance?: number;
  postalCode?: string;
  skills?: string[];
  subjects?: string[];
};

type InstitutionProfilePayload = {
  address: string;
  city: string;
  complianceContact?: string;
  complianceEmail?: string;
  countryCode?: string;
  coverTypes?: string[];
  county?: string;
  domain: string;
  name: string;
  postalCode?: string;
  registrationId?: string;
  safeguardingConfirmed?: boolean;
  staffingNeeds?: string;
  typicalPupilCount?: number;
  userRole?: string;
};

type RecruiterProfilePayload = {
  countryCode?: string;
  displayName: string;
  postalCode?: string;
};

type DownloadDocumentResponse = {
  downloadUrl?: string;
  expiresAt?: string;
  url?: string;
};

type BackendUserProfile = {
  email?: string;
  id?: string;
  name?: string | null;
  phone?: string | null;
  postCode?: string | null;
  role?: unknown;
};

type BackendInstructorProfile = {
  bio?: string | null;
  currency?: string | null;
  dailyRate?: unknown;
  experience?: number | null;
  fullName?: string;
  hourlyRate?: unknown;
  id?: string;
  keyStages?: string[];
  maxTravelDistance?: unknown;
  postalCode?: string | null;
  skills?: string[];
  status?: unknown;
  subjects?: string[];
};

type BackendInstitutionProfile = {
  address?: string;
  city?: string;
  complianceContact?: string | null;
  complianceEmail?: string | null;
  countryCode?: string;
  coverTypes?: unknown;
  county?: string;
  domain?: string;
  id?: string;
  name?: string;
  postalCode?: string | null;
  registrationId?: string | null;
  safeguardingConfirmed?: boolean | null;
  status?: unknown;
  staffingNeeds?: string | null;
  typicalPupilCount?: unknown;
  userRole?: string | null;
  verified?: boolean;
};

type BackendRecruiterProfile = {
  address?: string | null;
  bio?: string | null;
  city?: string | null;
  countryCode?: string;
  county?: string | null;
  displayName?: string;
  id?: string;
  imageUrl?: string | null;
  postalCode?: string | null;
  status?: unknown;
};

const backendRefreshTimeoutMs = 12_000;

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function numberString(value: unknown) {
  const numeric = readNumber(value);
  return numeric === undefined ? "" : String(numeric);
}

function normalizeUserSnapshot(user: BackendUserProfile, fallbackEmail?: string, postcodeFallback = ""): OnboardingUserSnapshot {
  return {
    email: user.email || fallbackEmail || "",
    fullName: user.name || "",
    phone: user.phone || "",
    postcode: user.postCode || postcodeFallback,
  };
}

function normalizeInstructorSnapshot(profile: BackendInstructorProfile): OnboardingInstructorSnapshot | undefined {
  if (!profile.id) return undefined;

  return {
    bio: profile.bio || "",
    currency: profile.currency || "GBP",
    dailyRate: numberString(profile.dailyRate),
    fullName: profile.fullName || "",
    hourlyRate: numberString(profile.hourlyRate),
    id: profile.id,
    keyStages: readStringArray(profile.keyStages),
    maxTravelDistance: numberString(profile.maxTravelDistance),
    postalCode: profile.postalCode || "",
    skills: readStringArray(profile.skills),
    status: normalizeStatus(profile.status),
    subjects: readStringArray(profile.subjects),
    yearsExperience: numberString(profile.experience),
  };
}

function normalizeInstitutionSnapshot(profile: BackendInstitutionProfile): OnboardingInstitutionSnapshot | undefined {
  if (!profile.id) return undefined;

  return {
    address: profile.address || "",
    city: profile.city || "",
    complianceContact: profile.complianceContact || "",
    complianceEmail: profile.complianceEmail || "",
    countryCode: profile.countryCode || "GB",
    coverTypes: readStringArray(profile.coverTypes),
    county: profile.county || "",
    domain: profile.domain || "",
    id: profile.id,
    name: profile.name || "",
    postalCode: profile.postalCode || "",
    registrationId: profile.registrationId || "",
    safeguardingConfirmed: Boolean(profile.safeguardingConfirmed),
    status: normalizeStatus(profile.status),
    staffingNeeds: profile.staffingNeeds || "",
    typicalPupilCount: numberString(profile.typicalPupilCount),
    userRole: profile.userRole || "",
    verified: Boolean(profile.verified),
  };
}

function normalizeRecruiterProfileStatus(profile: { id?: string; status?: unknown }) {
  const status = normalizeStatus(profile.status);
  if (status === "rejected" || status === "suspended") return status;
  return profile.id ? "approved" : "none";
}

function normalizeRecruiterSnapshot(profile: BackendRecruiterProfile): OnboardingRecruiterSnapshot | undefined {
  if (!profile.id) return undefined;

  return {
    address: profile.address || "",
    bio: profile.bio || "",
    city: profile.city || "",
    countryCode: profile.countryCode || "GB",
    county: profile.county || "",
    displayName: profile.displayName || "",
    id: profile.id,
    imageUrl: profile.imageUrl || "",
    postalCode: profile.postalCode || "",
    status: normalizeRecruiterProfileStatus(profile),
  };
}

function emptySnapshot(role: AppRole | null, email?: string): OnboardingProfileSnapshot {
  return {
    ...emptyDocumentState(),
    applicationStatus: "none",
    role,
    user: {
      email: email || "",
      fullName: "",
      phone: "",
      postcode: "",
    },
  };
}

function isFormData(input: FormData | OnboardingSubmitInput): input is FormData {
  return typeof FormData !== "undefined" && input instanceof FormData;
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFormStringArray(formData: FormData, key: string) {
  const value = readFormString(formData, key);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

function readFormNumber(formData: FormData, key: string) {
  const value = readFormString(formData, key);
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function readFormBoolean(formData: FormData, key: string) {
  return readFormString(formData, key) === "true";
}

function readFormFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size <= 0) return null;
  return value;
}

function readFormValue(value: FormDataEntryValue) {
  if (value instanceof File) return undefined;
  if (!value.trim()) return "";

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function buildGenericSubmitInput(formData: FormData): OnboardingSubmitInput {
  const values: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    const parsedValue = readFormValue(value);
    if (parsedValue !== undefined) values[key] = parsedValue;
  }

  return {
    role: readFormString(formData, "role") as AppRole,
    step: Number(readFormString(formData, "step")) || 4,
    values,
  };
}

function buildInstructorProfilePayload(formData: FormData): InstructorProfilePayload {
  const postalCode = readFormString(formData, "postcode");
  const profile: InstructorProfilePayload = {
    bio: readFormString(formData, "bio") || undefined,
    currency: readFormString(formData, "currency") || "GBP",
    dailyRate: readFormNumber(formData, "dailyRate"),
    experience: readFormNumber(formData, "yearsExperience"),
    fullName: readFormString(formData, "fullName"),
    hourlyRate: readFormNumber(formData, "hourlyRate"),
    keyStages: readFormStringArray(formData, "keyStages"),
    maxTravelDistance: readFormNumber(formData, "maxTravelDistance"),
    postalCode: postalCode || undefined,
    skills: readFormStringArray(formData, "skills"),
    subjects: readFormStringArray(formData, "subjects"),
  };

  return profile;
}

function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase() ?? "";
}

function buildInstitutionProfilePayload(formData: FormData): InstitutionProfilePayload {
  return {
    address: readFormString(formData, "institutionAddress"),
    city: readFormString(formData, "institutionCity"),
    countryCode: readFormString(formData, "institutionCountryCode") || "GB",
    complianceContact: readFormString(formData, "complianceContact") || undefined,
    complianceEmail: readFormString(formData, "complianceEmail") || undefined,
    coverTypes: readFormStringArray(formData, "coverTypes"),
    county: readFormString(formData, "localAuthority") || undefined,
    domain: normalizeDomain(readFormString(formData, "institutionDomain")),
    name: readFormString(formData, "schoolName"),
    postalCode: readFormString(formData, "postcode") || undefined,
    registrationId: readFormString(formData, "institutionRegistrationId") || undefined,
    safeguardingConfirmed: readFormBoolean(formData, "safeguardingConfirmed"),
    staffingNeeds: readFormString(formData, "staffingNeeds") || undefined,
    typicalPupilCount: readFormNumber(formData, "typicalPupilCount"),
    userRole: readFormString(formData, "contactRole") || undefined,
  };
}

function buildRecruiterProfilePayload(formData: FormData): RecruiterProfilePayload {
  return {
    countryCode: "GB",
    displayName: readFormString(formData, "fullName"),
    postalCode: readFormString(formData, "postcode") || undefined,
  };
}

function buildBearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function notFoundOrForbidden(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

function isStatusTransitionRace(error: unknown) {
  return error instanceof ApiError && (error.status === 400 || error.status === 409);
}

async function getCurrentUserSnapshot(postcodeFallback = "") {
  const authContext = await getServerAuthContext();
  if (!authContext?.userId) return undefined;

  const user = await api.get<BackendUserProfile>(`/users/${authContext.userId}`);
  return normalizeUserSnapshot(user, authContext.email ?? undefined, postcodeFallback);
}

async function getInstructorSnapshotById(id: string | null | undefined) {
  if (!id) return undefined;

  try {
    return normalizeInstructorSnapshot(await api.get<BackendInstructorProfile>(`/instructors/${id}`));
  } catch (error) {
    if (notFoundOrForbidden(error)) return undefined;
    throw error;
  }
}

async function getCurrentInstructorSnapshot(accessToken?: string) {
  try {
    return normalizeInstructorSnapshot(
      await api.get<BackendInstructorProfile>(
        "/instructors/me",
        accessToken
          ? {
              auth: false,
              headers: buildBearerHeaders(accessToken),
            }
          : undefined,
      ),
    );
  } catch (error) {
    if (notFoundOrForbidden(error)) return undefined;
    throw error;
  }
}

async function getInstitutionSnapshot(accessToken?: string) {
  try {
    return normalizeInstitutionSnapshot(
      await api.get<BackendInstitutionProfile>(
        "/institutions/me",
        accessToken
          ? {
              auth: false,
              headers: buildBearerHeaders(accessToken),
            }
          : undefined,
      ),
    );
  } catch (error) {
    if (notFoundOrForbidden(error)) return undefined;
    throw error;
  }
}

async function getRecruiterSnapshot(accessToken?: string) {
  try {
    return normalizeRecruiterSnapshot(
      await api.get<BackendRecruiterProfile>(
        "/recruiters/me",
        accessToken
          ? {
              auth: false,
              headers: buildBearerHeaders(accessToken),
            }
          : undefined,
      ),
    );
  } catch (error) {
    if (notFoundOrForbidden(error)) return undefined;
    throw error;
  }
}

/**
 * Document state for the page-load snapshot. A failure here must not wipe the
 * rest of the profile, so it degrades to an empty state and the documents
 * step refetches on the client.
 */
async function loadDocumentState(role: AppRole): Promise<OnboardingDocumentState> {
  try {
    return await getDocumentState(role);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[SupplyED onboarding] document state could not be loaded", error);
    }

    return emptyDocumentState();
  }
}

export async function getOnboardingProfileSnapshot(): Promise<OnboardingProfileSnapshot> {
  const authContext = await getServerAuthContext();
  const role = normalizeRole(authContext?.role);

  if (!backendEnabled() || !authContext?.userId) {
    return emptySnapshot(role, authContext?.email ?? undefined);
  }

  try {
    const user = await getCurrentUserSnapshot();
    const snapshot: OnboardingProfileSnapshot = {
      ...emptyDocumentState(),
      applicationStatus: "none",
      role,
      user,
    };

    if (role === "teacher") {
      snapshot.instructor =
        (await getInstructorSnapshotById(authContext.instructorProfileId)) ?? (await getCurrentInstructorSnapshot());
      Object.assign(snapshot, await loadDocumentState("teacher"));
      snapshot.applicationStatus = snapshot.instructor?.status ?? "none";
    }

    if (role === "institution") {
      snapshot.institution = await getInstitutionSnapshot();
      snapshot.applicationStatus = snapshot.institution?.status ?? "none";
    }

    if (role === "individual") {
      snapshot.recruiter = await getRecruiterSnapshot();
      snapshot.applicationStatus = snapshot.recruiter?.status ?? "none";
    }

    return snapshot;
  } catch {
    return emptySnapshot(role, authContext.email ?? undefined);
  }
}

function createSessionResponse({
  applicationStatus,
  auth,
  instructorProfileId,
  institutionProfileId,
  recruiterProfileId,
  name,
  role,
}: {
  applicationStatus: ApplicationStatus;
  auth: BackendAuthResponse;
  instructorProfileId?: string;
  institutionProfileId?: string;
  recruiterProfileId?: string;
  name?: string;
  role: AppRole;
}): BackendAuthResponse {
  return {
    ...auth,
    user: {
      ...auth.user,
      applicationStatus,
      instructorProfileId: instructorProfileId ?? auth.user.instructorProfileId,
      institutionProfileId: institutionProfileId ?? auth.user.institutionProfileId,
      recruiterProfileId: recruiterProfileId ?? auth.user.recruiterProfileId,
      name: auth.user.name ?? name ?? null,
      role,
    },
  };
}

async function refreshSessionForRole(
  refreshToken: string,
  options: {
    applicationStatus: OnboardingSubmitResult["applicationStatus"];
    instructorProfileId?: string;
    institutionProfileId?: string;
    recruiterProfileId?: string;
    name?: string;
    role: AppRole;
  },
) {
  const refreshedAuth = await withTimeout(
    refreshBackendAuth(refreshToken),
    backendRefreshTimeoutMs,
    "Your profile was saved, but the backend token refresh timed out. Try again before uploading documents.",
  );
  if (!refreshedAuth?.accessToken) return undefined;
  return createVerifiedEmailSessionTicket(createSessionResponse({ ...options, auth: refreshedAuth }));
}

async function saveUserBasics(formData: FormData, postcodeFallback = "") {
  if (!backendEnabled()) {
    return normalizeUserSnapshot(
      {
        email: readFormString(formData, "email"),
        name: readFormString(formData, "fullName"),
        phone: readFormString(formData, "phone"),
      },
      readFormString(formData, "email"),
      postcodeFallback,
    );
  }

  const name = readFormString(formData, "fullName");
  const phone = readFormString(formData, "phone");

  if (name || phone) {
    await api.patch("/users/me", {
      name: name || undefined,
      phone: phone || undefined,
    });
  }

  return getCurrentUserSnapshot(postcodeFallback);
}

function onboardingError(error: unknown) {
  if (error instanceof ApiError) {
    return actionError(error.message || "Onboarding could not be submitted.");
  }

  if (error instanceof Error && error.message.trim()) {
    return actionError(error.message);
  }

  return actionError("Onboarding could not be submitted. Try again.");
}

async function saveInstructorProfile(formData: FormData, accessToken: string, existingProfileId?: string | null) {
  const profile = buildInstructorProfilePayload(formData);
  const profileId = readFormString(formData, "teacherProfileId") || existingProfileId || "";

  if (!profile.fullName) {
    throw new Error("Enter your full name before continuing.");
  }

  if (profileId) {
    return normalizeInstructorSnapshot(
      await api.patch<BackendInstructorProfile>(`/instructors/${profileId}`, profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  }

  const currentInstructor = await getCurrentInstructorSnapshot(accessToken);
  if (currentInstructor?.id) {
    return normalizeInstructorSnapshot(
      await api.patch<BackendInstructorProfile>(`/instructors/${currentInstructor.id}`, profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  }

  try {
    return normalizeInstructorSnapshot(
      await api.post<BackendInstructorProfile>("/instructors", profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      throw new Error(
        "We found an existing teacher profile for this account, but could not restore it in this session. Sign out and sign in again, then try once more.",
      );
    }

    if (error instanceof ApiError && error.status === 409) {
      throw new Error("Your teacher profile already exists, but the backend does not expose an authenticated instructor profile lookup yet.");
    }

    throw error;
  }
}

async function saveInstitutionProfile(formData: FormData, accessToken: string, existingProfileId?: string | null) {
  const profile = buildInstitutionProfilePayload(formData);
  const profileId = readFormString(formData, "institutionProfileId") || existingProfileId || "";

  if (!profile.name || !profile.domain || !profile.address || !profile.city) {
    throw new Error("Complete the required institution profile fields before continuing.");
  }

  if (profileId) {
    return normalizeInstitutionSnapshot(
      await api.patch<BackendInstitutionProfile>(`/institutions/${profileId}`, profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  }

  const currentInstitution = await getInstitutionSnapshot(accessToken);
  if (currentInstitution?.id) {
    return normalizeInstitutionSnapshot(
      await api.patch<BackendInstitutionProfile>(`/institutions/${currentInstitution.id}`, profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  }

  try {
    return normalizeInstitutionSnapshot(
      await api.post<BackendInstitutionProfile>("/institutions", profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      throw new Error(
        "We found an existing school profile for this account, but could not restore it in this session. Sign out and sign in again, then try once more.",
      );
    }

    if (error instanceof ApiError && error.status === 409) {
      return getInstitutionSnapshot(accessToken);
    }

    throw error;
  }
}

async function saveRecruiterProfile(formData: FormData, accessToken: string, existingProfileId?: string | null) {
  const profile = buildRecruiterProfilePayload(formData);
  const profileId = readFormString(formData, "recruiterProfileId") || existingProfileId || "";

  if (!profile.displayName) {
    throw new Error("Enter your full name before continuing.");
  }

  if (profileId) {
    return normalizeRecruiterSnapshot(
      await api.patch<BackendRecruiterProfile>("/recruiters/me", profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  }

  const currentRecruiter = await getRecruiterSnapshot(accessToken);
  if (currentRecruiter?.id) {
    return normalizeRecruiterSnapshot(
      await api.patch<BackendRecruiterProfile>("/recruiters/me", profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  }

  try {
    return normalizeRecruiterSnapshot(
      await api.post<BackendRecruiterProfile>("/recruiters", profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return getRecruiterSnapshot(accessToken);
    }

    throw error;
  }
}

async function submitInstructorProfileForReview(accessToken: string, fallback?: OnboardingInstructorSnapshot) {
  try {
    return normalizeInstructorSnapshot(
      await api.patch<BackendInstructorProfile>("/instructors/me/status", undefined, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  } catch (error) {
    if (!isStatusTransitionRace(error)) throw error;

    const currentInstructor = await getCurrentInstructorSnapshot(accessToken);
    if (currentInstructor && currentInstructor.status !== "none") return currentInstructor;
    if (fallback && fallback.status !== "none") return fallback;

    throw error;
  }
}

async function submitInstitutionProfileForReview(accessToken: string, fallback?: OnboardingInstitutionSnapshot) {
  try {
    return normalizeInstitutionSnapshot(
      await api.patch<BackendInstitutionProfile>("/institutions/me/status", undefined, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  } catch (error) {
    if (!isStatusTransitionRace(error)) throw error;

    const currentInstitution = await getInstitutionSnapshot(accessToken);
    if (currentInstitution && currentInstitution.status !== "none") return currentInstitution;
    if (fallback && fallback.status !== "none") return fallback;

    throw error;
  }
}

/**
 * One card upload: resolve the requirement, validate against its limits, then
 * run the backend's create, upload-url, PUT, upload-complete cycle.
 */
export async function uploadOnboardingDocumentAction(formData: FormData) {
  const requirementId = readFormString(formData, "requirementId");
  const role = normalizeRole(readFormString(formData, "role")) ?? "teacher";
  const file = readFormFile(formData, "file");

  if (!requirementId) {
    return actionError("Choose a document type before uploading.");
  }

  if (!file) {
    return actionError("Choose a file to upload.");
  }

  if (!backendEnabled()) {
    const requirement = (await getProfileDocumentRequirements(role)).find((item) => item.id === requirementId);
    if (!requirement) {
      return actionError("This document type is not available.");
    }

    const fileError = validateDocumentFile(file, requirement);
    if (fileError) {
      return actionError(fileError);
    }

    const document: OnboardingDocumentSnapshot = {
      code: requirement.code,
      id: `local-${requirementId}-${Date.now()}`,
      name: file.name,
      requirementId,
      size: file.size,
      status: requirement.requiresReview ? "PENDING" : "NOT_REQUIRED",
      type: contentTypeForFile(file, requirement.allowedMimes),
      uploadedAt: new Date().toISOString(),
    };

    return actionOk<OnboardingDocumentUploadResult>({ document, documents: { [requirementId]: document } }, "Document uploaded.");
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.accessToken) {
    return actionError("Your session expired. Sign in again before uploading documents.");
  }

  try {
    // The session token may still carry the USER role from before the profile
    // was created; the document routes need the profile role.
    const refreshedAuth = authContext.refreshToken
      ? await withTimeout(
          refreshBackendAuth(authContext.refreshToken),
          backendRefreshTimeoutMs,
          "The backend token refresh timed out. Try uploading this document again.",
        )
      : null;
    const auth = { accessToken: refreshedAuth?.accessToken ?? authContext.accessToken };
    const requirement = (await getProfileDocumentRequirements(role, auth)).find((item) => item.id === requirementId);

    if (!requirement) {
      throw new Error("This document type is no longer available. Refresh the page and try again.");
    }

    const fileError = validateDocumentFile(file, requirement);
    if (fileError) {
      return actionError(fileError);
    }

    const document = await uploadProfileDocument({ auth, file, requirement });
    const documents = await getDocumentSnapshots(auth);

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingDocumentUploadResult>(
      {
        document,
        documents: { ...documents, [requirementId]: document },
      },
      "Document uploaded.",
    );
  } catch (error) {
    return onboardingError(error);
  }
}

export async function downloadOnboardingDocumentAction(formData: FormData) {
  const documentId = readFormString(formData, "documentId");
  const fileName = readFormString(formData, "fileName");

  if (!documentId) {
    return actionError("Choose an uploaded document to view.");
  }

  if (!backendEnabled()) {
    return actionError("Document preview requires backend file storage.");
  }

  try {
    const response = await api.get<DownloadDocumentResponse>(`/documents/${documentId}/download-url`);
    const url = readString(response.downloadUrl) ?? readString(response.url);

    if (!url) {
      throw new Error("The backend did not return a document preview URL.");
    }

    const previewPath = `/api/onboarding/documents/${encodeURIComponent(documentId)}/preview${
      fileName ? `?name=${encodeURIComponent(fileName)}` : ""
    }`;

    return actionOk<OnboardingDocumentDownloadResult>(
      {
        expiresAt: readString(response.expiresAt),
        url: previewPath,
      },
      "Document preview ready.",
    );
  } catch (error) {
    return onboardingError(error);
  }
}

export async function saveOnboardingStepAction(formData: FormData) {
  const role = readFormString(formData, "role") as AppRole;
  const step = Number(readFormString(formData, "step")) || 1;
  const postcode = readFormString(formData, "postcode");

  if (!backendEnabled()) {
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "none",
        savedStep: step,
        snapshot: emptySnapshot(role, readFormString(formData, "email")),
      },
      "Step saved locally for backend-disabled development.",
    );
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.accessToken || !authContext.refreshToken) {
    return actionError("Your session expired. Sign in again before continuing.");
  }

  try {
    const user = step === 1 ? await saveUserBasics(formData, postcode) : await getCurrentUserSnapshot(postcode);
    const snapshot: OnboardingProfileSnapshot = {
      ...emptyDocumentState(),
      applicationStatus: "none",
      role,
      user,
    };
    let ticket: string | undefined;

    if (role === "teacher" && step === 1) {
      const instructor = await saveInstructorProfile(formData, authContext.accessToken, authContext.instructorProfileId);
      if (!instructor) throw new Error("The backend did not return the saved teacher profile.");

      snapshot.instructor = instructor;
      ticket = await refreshSessionForRole(authContext.refreshToken, {
        applicationStatus: "none",
        instructorProfileId: instructor.id,
        name: instructor.fullName,
        role: "teacher",
      });

      if (!ticket) {
        return actionError("Your teacher profile was saved, but we could not refresh your session. Sign in again before uploading documents.");
      }
    }

    if (role === "teacher" && step === 2) {
      // The backend is the source of truth for what was uploaded.
      const documentState = await getDocumentState("teacher");
      assertRequiredDocumentsUploaded(documentState);
      Object.assign(snapshot, documentState);

      snapshot.instructor =
        (await getInstructorSnapshotById(authContext.instructorProfileId || readFormString(formData, "teacherProfileId"))) ??
        (await getCurrentInstructorSnapshot(authContext.accessToken));
    }

    if (role === "institution" && step === 1) {
      snapshot.institution = await getInstitutionSnapshot(authContext.accessToken);
    }

    if (role === "institution" && (step === 2 || step === 3)) {
      const institution = await saveInstitutionProfile(formData, authContext.accessToken, authContext.institutionProfileId);
      if (!institution) throw new Error("The backend did not return the saved institution profile.");

      snapshot.institution = institution;
      ticket = await refreshSessionForRole(authContext.refreshToken, {
        applicationStatus: "none",
        institutionProfileId: institution.id,
        name: institution.name,
        role: "institution",
      });

      if (!ticket) {
        return actionError("Your school profile was saved, but we could not refresh your session. Sign in again to continue.");
      }
    }

    if (role === "institution" && step !== 1 && step !== 2 && step !== 3) {
      snapshot.institution = await getInstitutionSnapshot();
    }

    if (role === "individual") {
      snapshot.recruiter = await getRecruiterSnapshot(authContext.accessToken);
    }

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "none",
        savedStep: step,
        snapshot,
        ticket,
      },
      "Step saved.",
    );
  } catch (error) {
    return onboardingError(error);
  }
}

async function submitInstructorOnboarding(formData: FormData) {
  if (!backendEnabled()) {
    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "pending_review",
        savedStep: Number(readFormString(formData, "step")) || 3,
        snapshot: emptySnapshot("teacher", readFormString(formData, "email")),
      },
      "Instructor onboarding is ready for backend integration.",
    );
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.accessToken || !authContext.refreshToken) {
    return actionError("Your session expired. Sign in again before submitting onboarding.");
  }

  try {
    const postcode = readFormString(formData, "postcode");
    const user = await saveUserBasics(formData, postcode);
    const instructor = await saveInstructorProfile(formData, authContext.accessToken, authContext.instructorProfileId);
    if (!instructor) throw new Error("The backend did not return the saved teacher profile.");

    const refreshedAuth = await refreshBackendAuth(authContext.refreshToken);
    if (!refreshedAuth?.accessToken) {
      return actionError("Your teacher profile was created, but we could not refresh your document upload session. Sign in again and retry the document step.");
    }

    const documentState = await getDocumentState("teacher", { accessToken: refreshedAuth.accessToken });
    assertRequiredDocumentsUploaded(documentState);
    const submittedInstructor = await submitInstructorProfileForReview(refreshedAuth.accessToken, instructor);
    if (!submittedInstructor || submittedInstructor.status === "none") {
      throw new Error("The backend did not mark your teacher profile as pending review.");
    }

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: submittedInstructor.status,
        savedStep: Number(readFormString(formData, "step")) || 3,
        snapshot: {
          ...documentState,
          applicationStatus: submittedInstructor.status,
          instructor: submittedInstructor,
          role: "teacher",
          user,
        },
        ticket: createVerifiedEmailSessionTicket(
          createSessionResponse({
            applicationStatus: submittedInstructor.status,
            auth: refreshedAuth,
            instructorProfileId: submittedInstructor.id,
            name: submittedInstructor.fullName || readFormString(formData, "fullName"),
            role: "teacher",
          }),
        ),
      },
      "Your teacher profile and documents were submitted for review.",
    );
  } catch (error) {
    return onboardingError(error);
  }
}

async function submitInstitutionOnboarding(formData: FormData) {
  if (!backendEnabled()) {
    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "pending_review",
        savedStep: Number(readFormString(formData, "step")) || 3,
        snapshot: emptySnapshot("institution", readFormString(formData, "email")),
      },
      "Institution onboarding is ready for backend integration.",
    );
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.accessToken || !authContext.refreshToken) {
    return actionError("Your session expired. Sign in again before submitting onboarding.");
  }

  try {
    const postcode = readFormString(formData, "postcode");
    const user = await saveUserBasics(formData, postcode);
    const institution = await saveInstitutionProfile(formData, authContext.accessToken, authContext.institutionProfileId);
    if (!institution) throw new Error("The backend did not return the saved institution profile.");

    const refreshedAuth = await refreshBackendAuth(authContext.refreshToken);
    if (!refreshedAuth?.accessToken) {
      return actionError("Your school profile was created, but we could not refresh your session. Sign in again to continue.");
    }

    const submittedInstitution = await submitInstitutionProfileForReview(refreshedAuth.accessToken, institution);
    if (!submittedInstitution || submittedInstitution.status === "none") {
      throw new Error("The backend did not mark your school profile as pending review.");
    }

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: submittedInstitution.status,
        savedStep: Number(readFormString(formData, "step")) || 4,
        snapshot: {
          ...emptyDocumentState(),
          applicationStatus: submittedInstitution.status,
          institution: submittedInstitution,
          role: "institution",
          user,
        },
        ticket: createVerifiedEmailSessionTicket(
          createSessionResponse({
            applicationStatus: submittedInstitution.status,
            auth: refreshedAuth,
            institutionProfileId: submittedInstitution.id,
            name: submittedInstitution.name,
            role: "institution",
          }),
        ),
      },
      "Your school profile was submitted for review.",
    );
  } catch (error) {
    return onboardingError(error);
  }
}

async function submitIndividualOnboarding(formData: FormData) {
  if (!backendEnabled()) {
    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "pending_review",
        savedStep: Number(readFormString(formData, "step")) || 4,
        snapshot: emptySnapshot("individual", readFormString(formData, "email")),
      },
      "Individual onboarding is ready for backend integration.",
    );
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.accessToken || !authContext.refreshToken) {
    return actionError("Your session expired. Sign in again before submitting onboarding.");
  }

  try {
    const postcode = readFormString(formData, "postcode");
    const user = await saveUserBasics(formData, postcode);
    const recruiter = await saveRecruiterProfile(formData, authContext.accessToken, authContext.recruiterProfileId);
    if (!recruiter) throw new Error("The backend did not return the saved individual profile.");

    const refreshedAuth = await refreshBackendAuth(authContext.refreshToken);
    if (!refreshedAuth?.accessToken) {
      return actionError("Your individual profile was created, but we could not refresh your session. Sign in again to continue.");
    }

    const savedRecruiter = (await getRecruiterSnapshot(refreshedAuth.accessToken)) ?? recruiter;
    const applicationStatus = savedRecruiter.status === "none" ? "approved" : savedRecruiter.status;

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus,
        savedStep: Number(readFormString(formData, "step")) || 4,
        snapshot: {
          ...emptyDocumentState(),
          applicationStatus,
          recruiter: savedRecruiter,
          role: "individual",
          user,
        },
        ticket: createVerifiedEmailSessionTicket(
          createSessionResponse({
            applicationStatus,
            auth: refreshedAuth,
            name: savedRecruiter.displayName || readFormString(formData, "fullName"),
            recruiterProfileId: savedRecruiter.id,
            role: "individual",
          }),
        ),
      },
      "Your individual profile was created.",
    );
  } catch (error) {
    return onboardingError(error);
  }
}

export async function submitOnboardingAction(input: FormData | OnboardingSubmitInput) {
  if (isFormData(input)) {
    const role = readFormString(input, "role");

    if (role === "teacher") {
      return submitInstructorOnboarding(input);
    }

    if (role === "institution") {
      return submitInstitutionOnboarding(input);
    }

    if (role === "individual") {
      return submitIndividualOnboarding(input);
    }

    const normalizedInput = normalizeOnboardingSubmitInput(buildGenericSubmitInput(input));
    if (backendEnabled()) {
      const result = await api.post<OnboardingSubmitResult>("/onboarding/submit", normalizedInput);
      revalidateTag("onboarding", "max");
      return actionOk(result, "Onboarding submitted.");
    }

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingSubmitResult>(
      {
        applicationStatus: "pending_review",
      },
      "Onboarding submitted.",
    );
  }

  const normalizedInput = normalizeOnboardingSubmitInput(input);

  if (backendEnabled()) {
    const result = await api.post<OnboardingSubmitResult>("/onboarding/submit", normalizedInput);
    revalidateTag("onboarding", "max");
    return actionOk(result, "Onboarding submitted.");
  }

  revalidateTag("onboarding", "max");
  return actionOk<OnboardingSubmitResult>(
    { applicationStatus: "pending_review" },
    "Onboarding submission is ready for NestJS integration.",
  );
}
