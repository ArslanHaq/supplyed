"use server";

import { revalidateTag } from "next/cache";

import { normalizeRole, normalizeStatus, refreshBackendAuth } from "@/features/auth/backend";
import { createVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";
import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { normalizeOnboardingSubmitInput } from "./schemas";
import type {
  OnboardingDocumentDownloadResult,
  OnboardingDocumentKind,
  OnboardingDocumentSnapshot,
  OnboardingDocumentUploadResult,
  OnboardingInstructorSnapshot,
  OnboardingInstitutionSnapshot,
  OnboardingProfileSnapshot,
  OnboardingProgressResult,
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
  let timeout: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timeout));
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
  skills?: string[];
  subjects?: string[];
};

type InstitutionProfilePayload = {
  address: string;
  city: string;
  countryCode?: string;
  county: string;
  domain: string;
  name: string;
  postalCode?: string;
  registrationId?: string;
  staffingNeeds?: string;
  userRole?: string;
};

type BackendDocumentType = "ADDRESS_PROOF" | "DBS" | "ID" | "QUALIFICATION";

type UploadDocumentResponse = {
  document: {
    id: string;
  };
  requiredHeaders?: Record<string, string>;
  uploadUrl: string;
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
  skills?: string[];
  status?: unknown;
  subjects?: string[];
};

type BackendInstitutionProfile = {
  address?: string;
  city?: string;
  countryCode?: string;
  county?: string;
  domain?: string;
  id?: string;
  name?: string;
  postalCode?: string | null;
  registrationId?: string | null;
  staffingNeeds?: string | null;
  userRole?: string | null;
  verified?: boolean;
};

type BackendDocumentProfile = {
  contentType?: string;
  dbsNumber?: string | null;
  id?: string;
  name?: string;
  sizeBytes?: number;
  status?: unknown;
  type?: unknown;
  uploadedAt?: string | Date | null;
};

const allowedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxDocumentSizeBytes = 10 * 1024 * 1024;
const backendRefreshTimeoutMs = 12_000;

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function splitStaffingNeeds(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    countryCode: profile.countryCode || "GB",
    county: profile.county || "",
    domain: profile.domain || "",
    id: profile.id,
    name: profile.name || "",
    postalCode: profile.postalCode || "",
    registrationId: profile.registrationId || "",
    staffingNeeds: splitStaffingNeeds(profile.staffingNeeds),
    userRole: profile.userRole || "",
    verified: Boolean(profile.verified),
  };
}

function documentKind(type: unknown): OnboardingDocumentKind | undefined {
  const value = readString(type)?.toUpperCase();
  if (value === "DBS") return "dbs";
  if (value === "ID") return "id";
  if (value === "ADDRESS_PROOF") return "addressProof";
  if (value === "QUALIFICATION") return "qualification";
  return undefined;
}

function backendDocumentType(kind: string): BackendDocumentType | undefined {
  if (kind === "dbs") return "DBS";
  if (kind === "id") return "ID";
  if (kind === "addressProof") return "ADDRESS_PROOF";
  if (kind === "qualification") return "QUALIFICATION";
  return undefined;
}

function normalizeDocumentSnapshot(document: BackendDocumentProfile): OnboardingDocumentSnapshot | undefined {
  const kind = documentKind(document.type);
  if (!kind || !document.id || !document.name || !document.contentType || !document.sizeBytes) return undefined;

  return {
    dbsNumber: document.dbsNumber,
    id: document.id,
    name: document.name,
    size: document.sizeBytes,
    status: readString(document.status),
    type: document.contentType,
    uploadedAt: document.uploadedAt instanceof Date ? document.uploadedAt.toISOString() : document.uploadedAt,
  };
}

function emptySnapshot(role: AppRole | null, email?: string): OnboardingProfileSnapshot {
  return {
    applicationStatus: "none",
    documents: {},
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

function contentTypeFromFile(file: File) {
  const explicitType = file.type.toLowerCase();
  if (allowedDocumentTypes.has(explicitType)) return explicitType;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";

  return explicitType;
}

function validateDocumentFile(file: File | null, label: string) {
  if (!file) return `${label} is required.`;
  if (file.size > maxDocumentSizeBytes) return `${label} must be 10 MB or smaller.`;

  const contentType = contentTypeFromFile(file);
  if (!allowedDocumentTypes.has(contentType)) return `${label} must be a PDF, JPG, or PNG file.`;

  return undefined;
}

function buildInstructorProfilePayload(formData: FormData): InstructorProfilePayload {
  const profile: InstructorProfilePayload = {
    bio: readFormString(formData, "bio") || undefined,
    currency: readFormString(formData, "currency") || "GBP",
    dailyRate: readFormNumber(formData, "dailyRate"),
    experience: readFormNumber(formData, "yearsExperience"),
    fullName: readFormString(formData, "fullName"),
    hourlyRate: readFormNumber(formData, "hourlyRate"),
    keyStages: readFormStringArray(formData, "keyStages"),
    maxTravelDistance: readFormNumber(formData, "maxTravelDistance"),
    skills: readFormStringArray(formData, "skills"),
    subjects: readFormStringArray(formData, "subjects"),
  };

  return profile;
}

function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase() ?? "";
}

function buildInstitutionProfilePayload(formData: FormData): InstitutionProfilePayload {
  const coverTypes = readFormStringArray(formData, "coverTypes");

  return {
    address: readFormString(formData, "institutionAddress"),
    city: readFormString(formData, "institutionCity"),
    countryCode: readFormString(formData, "institutionCountryCode") || "GB",
    county: readFormString(formData, "localAuthority"),
    domain: normalizeDomain(readFormString(formData, "institutionDomain")),
    name: readFormString(formData, "schoolName"),
    postalCode: readFormString(formData, "postcode") || undefined,
    registrationId: readFormString(formData, "institutionRegistrationId") || undefined,
    staffingNeeds: coverTypes.length > 0 ? coverTypes.join(", ") : undefined,
    userRole: readFormString(formData, "contactRole") || undefined,
  };
}

function buildBearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function notFoundOrForbidden(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
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

async function getInstitutionSnapshot() {
  try {
    return normalizeInstitutionSnapshot(await api.get<BackendInstitutionProfile>("/institutions/me"));
  } catch (error) {
    if (notFoundOrForbidden(error)) return undefined;
    throw error;
  }
}

async function getDocumentSnapshots(accessToken?: string) {
  const documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>> = {};

  try {
    const response = await api.get<BackendDocumentProfile[]>(
      "/documents",
      accessToken
        ? {
            auth: false,
            headers: buildBearerHeaders(accessToken),
          }
        : undefined,
    );

    response.forEach((document) => {
      const kind = documentKind(document.type);
      const snapshot = normalizeDocumentSnapshot(document);
      if (kind && snapshot) documents[kind] = snapshot;
    });
  } catch (error) {
    if (!notFoundOrForbidden(error)) throw error;
  }

  return documents;
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
      applicationStatus: "none",
      documents: {},
      role,
      user,
    };

    if (role === "teacher") {
      snapshot.instructor = await getInstructorSnapshotById(authContext.instructorProfileId);
      snapshot.documents = await getDocumentSnapshots();
      snapshot.applicationStatus = snapshot.instructor?.status ?? "none";
    }

    if (role === "institution") {
      snapshot.institution = await getInstitutionSnapshot();
      snapshot.applicationStatus = snapshot.institution ? "pending_review" : "none";
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
  name,
  role,
}: {
  applicationStatus: ApplicationStatus;
  auth: BackendAuthResponse;
  instructorProfileId?: string;
  institutionProfileId?: string;
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

async function uploadInstructorDocument({
  accessToken,
  dbsNumber,
  file,
  type,
}: {
  accessToken: string;
  dbsNumber?: string;
  file: File;
  type: BackendDocumentType;
}) {
  const contentType = contentTypeFromFile(file);
  const upload = await api.post<UploadDocumentResponse>(
    "/documents/upload-url",
    {
      contentType,
      dbsNumber: type === "DBS" ? dbsNumber : undefined,
      name: file.name,
      sizeBytes: file.size,
      type,
    },
    {
      auth: false,
      headers: buildBearerHeaders(accessToken),
    },
  );

  const uploadResponse = await fetch(upload.uploadUrl, {
    body: file,
    headers: {
      ...upload.requiredHeaders,
      "Content-Type": contentType,
    },
    method: "PUT",
  });

  if (!uploadResponse.ok) {
    throw new Error(`Unable to upload ${file.name}. The signed upload failed with status ${uploadResponse.status}.`);
  }

  const completedDocument = await api.post<BackendDocumentProfile>(
    `/documents/${upload.document.id}/complete`,
    undefined,
    {
      auth: false,
      headers: buildBearerHeaders(accessToken),
    },
  );

  return normalizeDocumentSnapshot(completedDocument);
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

  try {
    return normalizeInstructorSnapshot(
      await api.post<BackendInstructorProfile>("/instructors", profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error("Your teacher profile already exists, but the backend does not expose an authenticated instructor profile lookup yet.");
    }

    throw error;
  }
}

async function saveInstitutionProfile(formData: FormData, accessToken: string, existingProfileId?: string | null) {
  const profile = buildInstitutionProfilePayload(formData);
  const profileId = readFormString(formData, "institutionProfileId") || existingProfileId || "";

  if (!profile.name || !profile.domain || !profile.address || !profile.city || !profile.county) {
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

  try {
    return normalizeInstitutionSnapshot(
      await api.post<BackendInstitutionProfile>("/institutions", profile, {
        auth: false,
        headers: buildBearerHeaders(accessToken),
      }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return getInstitutionSnapshot();
    }

    throw error;
  }
}

async function uploadInstructorDocuments(formData: FormData, accessToken: string) {
  const dbsNumber = readFormString(formData, "dbsNumber");
  const dbsCertificateFile = readFormFile(formData, "dbsCertificateFile");
  const identityPhoto = readFormFile(formData, "identityPhoto");
  const rightToWorkFile = readFormFile(formData, "rightToWorkFile");
  const qualificationFile = readFormFile(formData, "qualificationFile");
  const existingDbsDocumentId = readFormString(formData, "dbsDocumentId");
  const existingIdDocumentId = readFormString(formData, "idDocumentId");
  const existingAddressProofDocumentId = readFormString(formData, "addressProofDocumentId");
  const existingQualificationDocumentId = readFormString(formData, "qualificationDocumentId");
  const errors = [
    existingDbsDocumentId ? undefined : validateDocumentFile(dbsCertificateFile, "Enhanced DBS certificate"),
    existingIdDocumentId ? undefined : validateDocumentFile(identityPhoto, "Photo ID"),
    existingQualificationDocumentId ? undefined : validateDocumentFile(qualificationFile, "Teaching qualification"),
    existingAddressProofDocumentId ? undefined : validateDocumentFile(rightToWorkFile, "Right-to-work or address evidence"),
  ].filter(Boolean);
  const documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>> = {};

  if (!dbsNumber) {
    throw new Error("Enter your enhanced DBS certificate number before continuing.");
  }

  if (errors.length > 0) {
    throw new Error(errors[0] ?? "Upload the required instructor documents before continuing.");
  }

  if (dbsCertificateFile) {
    const snapshot = await uploadInstructorDocument({
      accessToken,
      dbsNumber,
      file: dbsCertificateFile,
      type: "DBS",
    });
    if (snapshot) documents.dbs = snapshot;
  }

  if (identityPhoto) {
    const snapshot = await uploadInstructorDocument({
      accessToken,
      file: identityPhoto,
      type: "ID",
    });
    if (snapshot) documents.id = snapshot;
  }

  if (qualificationFile) {
    const snapshot = await uploadInstructorDocument({
      accessToken,
      file: qualificationFile,
      type: "QUALIFICATION",
    });
    if (snapshot) documents.qualification = snapshot;
  }

  if (rightToWorkFile) {
    const snapshot = await uploadInstructorDocument({
      accessToken,
      file: rightToWorkFile,
      type: "ADDRESS_PROOF",
    });
    if (snapshot) documents.addressProof = snapshot;
  }

  return {
    ...(await getDocumentSnapshots()),
    ...documents,
  };
}

export async function uploadOnboardingDocumentAction(formData: FormData) {
  const kind = readFormString(formData, "kind");
  const type = backendDocumentType(kind);
  const file = readFormFile(formData, "file");
  const dbsNumber = readFormString(formData, "dbsNumber");

  if (!type) {
    return actionError("Choose a valid document type before uploading.");
  }

  const fileError = validateDocumentFile(file, "Document");
  if (fileError) {
    return actionError(fileError);
  }

  if (type === "DBS" && !dbsNumber) {
    return actionError("Enter your enhanced DBS certificate number before uploading the DBS certificate.", {
      fieldErrors: { dbsNumber: "Enter your enhanced DBS certificate number before uploading the DBS certificate." },
    });
  }

  if (!backendEnabled()) {
    return actionOk<OnboardingDocumentUploadResult>(
      {
        document: {
          dbsNumber: type === "DBS" ? dbsNumber : undefined,
          id: `local-${kind}-${Date.now()}`,
          name: file!.name,
          size: file!.size,
          status: "PENDING",
          type: contentTypeFromFile(file!),
          uploadedAt: new Date().toISOString(),
        },
        documents: {},
      },
      "Document uploaded.",
    );
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.accessToken) {
    return actionError("Your session expired. Sign in again before uploading documents.");
  }

  try {
    const refreshedAuth = authContext.refreshToken
      ? await withTimeout(
          refreshBackendAuth(authContext.refreshToken),
          backendRefreshTimeoutMs,
          "The backend token refresh timed out. Try uploading this document again.",
        )
      : null;
    const accessToken = refreshedAuth?.accessToken ?? authContext.accessToken;
    const document = await uploadInstructorDocument({
      accessToken,
      dbsNumber: type === "DBS" ? dbsNumber : undefined,
      file: file!,
      type,
    });

    if (!document) {
      throw new Error("The backend did not return the uploaded document.");
    }

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingDocumentUploadResult>(
      {
        document,
        documents: { ...(await getDocumentSnapshots(accessToken)), [kind]: document },
      },
      "Document uploaded.",
    );
  } catch (error) {
    return onboardingError(error);
  }
}

export async function downloadOnboardingDocumentAction(formData: FormData) {
  const documentId = readFormString(formData, "documentId");

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

    return actionOk<OnboardingDocumentDownloadResult>(
      {
        expiresAt: readString(response.expiresAt),
        url,
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
      applicationStatus: "none",
      documents: {},
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
      const dbsNumber = readFormString(formData, "dbsNumber");
      const existingDbsDocumentId = readFormString(formData, "dbsDocumentId");
      const existingIdDocumentId = readFormString(formData, "idDocumentId");
      const existingQualificationDocumentId = readFormString(formData, "qualificationDocumentId");
      const existingAddressProofDocumentId = readFormString(formData, "addressProofDocumentId");

      if (!dbsNumber) {
        throw new Error("Enter your enhanced DBS certificate number before continuing.");
      }

      if (!existingDbsDocumentId || !existingIdDocumentId || !existingQualificationDocumentId || !existingAddressProofDocumentId) {
        throw new Error("Upload all required instructor documents before continuing.");
      }

      snapshot.instructor = await getInstructorSnapshotById(authContext.instructorProfileId || readFormString(formData, "teacherProfileId"));
      snapshot.documents = await getDocumentSnapshots();
    }

    if (role === "institution" && step === 2) {
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

    if (role === "institution" && step !== 2) {
      snapshot.institution = await getInstitutionSnapshot();
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

    const documents = await uploadInstructorDocuments(formData, refreshedAuth.accessToken);

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "pending_review",
        savedStep: Number(readFormString(formData, "step")) || 3,
        snapshot: {
          applicationStatus: "pending_review",
          documents,
          instructor,
          role: "teacher",
          user,
        },
        ticket: createVerifiedEmailSessionTicket(
          createSessionResponse({
            applicationStatus: "pending_review",
            auth: refreshedAuth,
            instructorProfileId: instructor?.id,
            name: instructor?.fullName || readFormString(formData, "fullName"),
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
        savedStep: Number(readFormString(formData, "step")) || 4,
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

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "pending_review",
        savedStep: Number(readFormString(formData, "step")) || 4,
        snapshot: {
          applicationStatus: "pending_review",
          documents: {},
          institution,
          role: "institution",
          user,
        },
        ticket: createVerifiedEmailSessionTicket(
          createSessionResponse({
            applicationStatus: "pending_review",
            auth: refreshedAuth,
            institutionProfileId: institution.id,
            name: institution.name,
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
      revalidateTag("onboarding", "max");
      return actionOk<OnboardingSubmitResult>(
        {
          applicationStatus: "approved",
        },
        "Learner request onboarding submitted.",
      );
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
        applicationStatus: role === "individual" ? "approved" : "pending_review",
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
