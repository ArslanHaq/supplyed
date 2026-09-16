"use server";

import { revalidateTag } from "next/cache";

import { normalizeRole, normalizeStatus, refreshBackendAuth } from "@/features/auth/backend";
import { createVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";
import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { filterProfileDocumentRequirements } from "./document-requirements";
import { isDocumentReadyForReview } from "./document-utils";
import { getDocumentSnapshots, getProfileDocumentRequirements as loadProfileDocumentRequirements } from "./documents";
import { hasCreatedRoleProfile } from "./profile-progress";
import { normalizeOnboardingSubmitInput } from "./schemas";
import type {
  OnboardingDocumentDownloadResult,
  OnboardingDocumentKind,
  OnboardingDocumentRequirementSnapshot,
  OnboardingDocumentSnapshot,
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

type BackendDocumentType = "ADDRESS_PROOF" | "DBS" | "ID" | "QUALIFICATION";

type UploadDocumentResponse = {
  fileKey?: string;
  requiredHeaders?: Record<string, string>;
  uploadUrl?: string;
  url?: string;
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

type BackendDocumentProfile = {
  contentType?: string;
  fileKey?: string | null;
  originalName?: string | null;
  currentVersion?: {
    contentType?: string;
    createdAt?: string | Date | null;
    documentExpiryDate?: string | Date | null;
    id?: string;
    originalName?: string;
    sizeBytes?: number;
  } | null;
  dbsNumber?: string | null;
  documentType?: {
    code?: string;
    name?: string;
  } | null;
  id?: string;
  name?: string;
  requirement?: {
    documentType?: {
      code?: string;
      name?: string;
    } | null;
  } | null;
  requirementId?: string | null;
  sizeBytes?: number;
  status?: unknown;
  type?: unknown;
  uploadedAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type BackendDocumentListResponse = BackendDocumentProfile[] | { documents?: BackendDocumentProfile[] };

type BackendDocumentRequirementProfile = {
  context?: string;
  documentTypeId?: string;
  documentType?: {
    allowedMimes?: unknown;
    code?: string;
    id?: string;
    maxSizeBytes?: number;
    name?: string;
  } | null;
  id?: string;
  isRequired?: boolean;
};

type DocumentSnapshotData = {
  documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>>;
  requirementDocuments: Record<string, OnboardingDocumentSnapshot>;
};

const allowedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxDocumentSizeBytes = 10 * 1024 * 1024;
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
  return normalizeStatus(profile.status);
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

function documentCodeFromDocument(document: BackendDocumentProfile) {
  return (
    readString(document.type) ??
    readString(document.documentType?.code) ??
    readString(document.requirement?.documentType?.code)
  );
}

function dateString(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : readString(value);
}

function normalizeDocumentSnapshot(document: BackendDocumentProfile): OnboardingDocumentSnapshot | undefined {
  const version = document.currentVersion ?? null;
  const name = readString(document.originalName) ?? readString(document.name) ?? readString(version?.originalName);
  const contentType = readString(document.contentType) ?? readString(version?.contentType);
  const sizeBytes = readNumber(document.sizeBytes) ?? readNumber(version?.sizeBytes);
  const uploadedAt = dateString(document.uploadedAt) ?? dateString(version?.createdAt) ?? dateString(document.updatedAt);

  if (!document.id || !name || !contentType || !sizeBytes || !uploadedAt) {
    return undefined;
  }

  return {
    dbsNumber: document.dbsNumber,
    id: document.id,
    name,
    requirementId: readString(document.requirementId) ?? null,
    size: sizeBytes,
    status: readString(document.status),
    type: contentType,
    uploadedAt,
  };
}

function normalizeDocumentRequirement(requirement: BackendDocumentRequirementProfile): OnboardingDocumentRequirementSnapshot | undefined {
  const context = readString(requirement.context);
  if (!requirement.id || !context || !requirement.documentType?.code || !requirement.documentType.name) return undefined;

  return {
    context,
    documentType: {
      allowedMimes: readStringArray(requirement.documentType.allowedMimes),
      code: requirement.documentType.code,
      id: readString(requirement.documentType.id),
      maxSizeBytes: requirement.documentType.maxSizeBytes || maxDocumentSizeBytes,
      name: requirement.documentType.name,
    },
    documentTypeId: readString(requirement.documentTypeId),
    id: requirement.id,
    isRequired: Boolean(requirement.isRequired),
  };
}

function roleQueryValue(role: AppRole | null | undefined) {
  if (role === "teacher") return "INSTRUCTOR";
  if (role === "institution") return "INSTITUTION";
  if (role === "individual") return "RECRUITER";
  return undefined;
}

function requirementForKind(requirements: OnboardingDocumentRequirementSnapshot[], kind: OnboardingDocumentKind) {
  const type = backendDocumentType(kind);
  return requirements.find((requirement) => requirement.documentType.code.toUpperCase() === type);
}

function emptyDocumentSnapshotData(): DocumentSnapshotData {
  return { documents: {}, requirementDocuments: {} };
}

function readDocumentList(response: BackendDocumentListResponse) {
  if (Array.isArray(response)) return response;
  if (isRecord(response) && Array.isArray(response.documents)) return response.documents;
  return [];
}

function addDocumentSnapshot(data: DocumentSnapshotData, document: BackendDocumentProfile) {
  const snapshot = normalizeDocumentSnapshot(document);
  if (!snapshot) return;

  const kind = documentKind(documentCodeFromDocument(document));
  if (kind) data.documents[kind] = snapshot;
  if (snapshot.requirementId) data.requirementDocuments[snapshot.requirementId] = snapshot;
}

function missingRequiredDocumentNames(
  requirements: OnboardingDocumentRequirementSnapshot[],
  data: DocumentSnapshotData,
) {
  return requirements
    .filter((requirement) => requirement.isRequired)
    .filter((requirement) => !isDocumentReadyForReview(data.requirementDocuments[requirement.id]))
    .map((requirement) => requirement.documentType.name);
}

function emptySnapshot(role: AppRole | null, email?: string): OnboardingProfileSnapshot {
  return {
    applicationStatus: "none",
    documentRequirements: [],
    documents: {},
    requirementDocuments: {},
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

async function getDocumentSnapshotData(accessToken?: string): Promise<DocumentSnapshotData> {
  const requirementDocuments = await getDocumentSnapshots({ accessToken });
  const documents: DocumentSnapshotData["documents"] = {};
  for (const document of Object.values(requirementDocuments)) {
    const kind = documentKind(document.code);
    if (kind) documents[kind] = document;
  }
  return { documents, requirementDocuments };
}


async function getProfileDocumentRequirements(role?: AppRole | null, accessToken?: string) {
  const requirements = await loadProfileDocumentRequirements(role, { accessToken });
  return requirements.map((requirement): OnboardingDocumentRequirementSnapshot => ({
    context: requirement.context,
    id: requirement.id,
    isRequired: requirement.isRequired,
    documentType: {
      allowedMimes: requirement.allowedMimes,
      code: requirement.code,
      maxSizeBytes: requirement.maxSizeBytes,
      name: requirement.name,
    },
  }));
}

async function getDocumentState(role?: AppRole | null, accessToken?: string) {
  if (!role) return { documentRequirements: [], ...emptyDocumentSnapshotData() };
  const [documentRequirements, documentData] = await Promise.all([
    getProfileDocumentRequirements(role, accessToken),
    getDocumentSnapshotData(accessToken),
  ]);

  return { documentRequirements, ...documentData };
}

export async function getOnboardingProfileSnapshot(): Promise<OnboardingProfileSnapshot> {
  const authContext = await getServerAuthContext();
  let role = normalizeRole(authContext?.role);

  if (!backendEnabled() || !authContext?.userId) {
    return emptySnapshot(role, authContext?.email ?? undefined);
  }

  {
    const currentUser = await api.get<BackendUserProfile>("/auth/me", { cache: "no-store" });
    role = normalizeRole(currentUser.role);
    const user = normalizeUserSnapshot(currentUser, authContext.email ?? undefined);
    const documentState = await getDocumentState(role);
    const snapshot: OnboardingProfileSnapshot = {
      applicationStatus: "none",
      documentRequirements: documentState.documentRequirements,
      documents: documentState.documents,
      requirementDocuments: documentState.requirementDocuments,
      role,
      user,
    };

    if (role === "teacher") {
      snapshot.instructor =
        await getCurrentInstructorSnapshot();
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

    if (role && !hasCreatedRoleProfile(snapshot)) {
      throw new Error("Your existing profile could not be loaded. Retry before continuing.");
    }
    return snapshot;
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
  if (backendEnabled()) {
    const current = await api.get<BackendUserProfile>("/auth/me", { cache: "no-store" });
    if (normalizeRole(current.role)) return normalizeUserSnapshot(current, current.email, postcodeFallback);
  }
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
  requirementId,
  type,
}: {
  accessToken: string;
  dbsNumber?: string;
  file: File;
  requirementId?: string;
  type?: BackendDocumentType;
}) {
  const contentType = contentTypeFromFile(file);
  const authOptions = {
    auth: false,
    headers: buildBearerHeaders(accessToken),
  };

  if (requirementId) {
    const existingDocument = (await getDocumentSnapshots({ accessToken }))[requirementId];
    const documentId = existingDocument?.id ?? (await api.post<BackendDocumentProfile>(
      "/documents",
      { applicationId: null, requirementId },
      authOptions,
    )).id;

    if (!documentId) throw new Error("The backend did not create the document record.");

    const upload = await api.post<UploadDocumentResponse>(
      `/documents/${documentId}/upload-url`,
      { contentType, sizeBytes: file.size },
      authOptions,
    );
    const uploadUrl = upload.uploadUrl ?? upload.url;
    if (!uploadUrl || !upload.fileKey) throw new Error("The backend did not return a document upload URL.");

    const uploadResponse = await fetch(uploadUrl, {
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
      `/documents/${documentId}/upload-complete`,
      { fileKey: upload.fileKey, originalName: file.name },
      authOptions,
    );

    return normalizeDocumentSnapshot({ ...completedDocument, requirementId });
  }

  if (!type) throw new Error("Choose a valid document type before uploading.");

  const upload = await api.post<UploadDocumentResponse & { document?: { id?: string } }>(
    "/documents/upload-url",
    {
      contentType,
      dbsNumber: type === "DBS" ? dbsNumber : undefined,
      name: file.name,
      sizeBytes: file.size,
      type,
    },
    authOptions,
  );
  const uploadUrl = upload.uploadUrl ?? upload.url;
  const documentId = upload.document?.id;
  if (!uploadUrl || !documentId) throw new Error("The backend did not return a document upload URL.");

  const uploadResponse = await fetch(uploadUrl, {
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
    `/documents/${documentId}/complete`,
    undefined,
    authOptions,
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
  const existing = await getCurrentInstructorSnapshot(accessToken);
  if (existing) return existing;
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
  const existing = await getInstitutionSnapshot(accessToken);
  if (existing) return existing;
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
  const existing = await getRecruiterSnapshot(accessToken);
  if (existing) return existing;
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
    if (currentInstructor && ["pending_review", "approved"].includes(currentInstructor.status)) return currentInstructor;

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
    if (currentInstitution && ["pending_review", "approved"].includes(currentInstitution.status)) return currentInstitution;

    throw error;
  }
}

export async function uploadOnboardingDocumentAction(formData: FormData) {
  const kind = readFormString(formData, "kind");
  const requirementId = readFormString(formData, "requirementId");
  const type = backendDocumentType(kind);
  const file = readFormFile(formData, "file");
  const dbsNumber = readFormString(formData, "dbsNumber");

  if (!type && !requirementId) {
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
    const document: OnboardingDocumentSnapshot = {
      dbsNumber: type === "DBS" ? dbsNumber : undefined,
      id: `local-${requirementId || kind}-${Date.now()}`,
      name: file!.name,
      requirementId: requirementId || null,
      size: file!.size,
      status: "PENDING",
      type: contentTypeFromFile(file!),
      uploadedAt: new Date().toISOString(),
    };

    return actionOk<OnboardingDocumentUploadResult>(
      {
        document,
        documents: kind ? { [kind]: document } : {},
        requirementDocuments: requirementId ? { [requirementId]: document } : {},
      },
      "Document uploaded.",
    );
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
    const uploadRole = (readFormString(formData, "role") as AppRole) || normalizeRole(refreshedAuth?.user.role ?? authContext.role) || "teacher";
    let accessToken = refreshedAuth?.accessToken ?? authContext.accessToken;

    if (requirementId) {
      const requirements = await getProfileDocumentRequirements(uploadRole, accessToken);

      if (!requirements.some((requirement) => requirement.id === requirementId)) {
        return actionError("This document is not required for the selected profile.");
      }

      if (uploadRole === "teacher") {
        await saveInstructorProfile(
          formData,
          accessToken,
          authContext.instructorProfileId ?? refreshedAuth?.user.instructorProfileId,
        );
      }

      if (uploadRole === "institution") {
        await saveInstitutionProfile(
          formData,
          accessToken,
          authContext.institutionProfileId ?? refreshedAuth?.user.institutionProfileId,
        );
      }

      if (uploadRole === "individual") {
        await saveRecruiterProfile(
          formData,
          accessToken,
          authContext.recruiterProfileId ?? refreshedAuth?.user.recruiterProfileId,
        );
      }

      if (authContext.refreshToken) {
        const profileAuth = await refreshBackendAuth(authContext.refreshToken);
        accessToken = profileAuth?.accessToken ?? accessToken;
      }
    }

    let uploadRequirementId = requirementId;

    if (!uploadRequirementId && type) {
      const requirements = await getProfileDocumentRequirements(uploadRole, accessToken);
      uploadRequirementId = requirementForKind(requirements, kind as OnboardingDocumentKind)?.id ?? "";
    }

    const document = await uploadInstructorDocument({
      accessToken,
      dbsNumber: type === "DBS" ? dbsNumber : undefined,
      file: file!,
      requirementId: uploadRequirementId || undefined,
      type,
    });

    if (!document) {
      throw new Error("The backend did not return the uploaded document.");
    }

    const documentData = await getDocumentSnapshotData(accessToken);
    if (kind) documentData.documents[kind as OnboardingDocumentKind] = document;
    if (document.requirementId) documentData.requirementDocuments[document.requirementId] = document;

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingDocumentUploadResult>(
      {
        document,
        documents: documentData.documents,
        requirementDocuments: documentData.requirementDocuments,
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
  const user = normalizeUserSnapshot(
    {
      email: readFormString(formData, "email"),
      name: readFormString(formData, "fullName"),
      phone: readFormString(formData, "phone"),
    },
    readFormString(formData, "email"),
    postcode,
  );

  if (!backendEnabled()) {
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "none",
        savedStep: step,
        snapshot: { ...emptySnapshot(role, readFormString(formData, "email")), user },
      },
      "Step saved locally for backend-disabled development.",
    );
  }

  const authContext = await getServerAuthContext();
  if (!authContext?.accessToken) {
    return actionError("Your session expired. Sign in again before continuing.");
  }

  try {
    const documentState = normalizeRole(authContext.role)
      ? await getDocumentState(role, authContext.accessToken ?? undefined)
      : {
          documentRequirements: await getProfileDocumentRequirements(role, authContext.accessToken ?? undefined),
          ...emptyDocumentSnapshotData(),
        };

    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: "none",
        savedStep: step,
        snapshot: {
          applicationStatus: "none",
          documentRequirements: documentState.documentRequirements,
          documents: documentState.documents,
          requirementDocuments: documentState.requirementDocuments,
          role,
          user,
        },
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
        savedStep: Number(readFormString(formData, "step")) || 2,
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
    const profileAuth = await refreshBackendAuth(authContext.refreshToken);
    const profileAccessToken = profileAuth?.accessToken ?? authContext.accessToken;
    const instructor = await saveInstructorProfile(
      formData,
      profileAccessToken,
      authContext.instructorProfileId ?? profileAuth?.user.instructorProfileId,
    );
    if (!instructor) throw new Error("The backend did not return the saved teacher profile.");

    const refreshedAuth = await refreshBackendAuth(authContext.refreshToken);
    if (!refreshedAuth?.accessToken) {
      return actionError("Your teacher profile was created, but we could not refresh your session. Sign in again to continue.");
    }

    const documentState = await getDocumentState("teacher", refreshedAuth.accessToken);
    const ticket = createVerifiedEmailSessionTicket(
      createSessionResponse({
        applicationStatus: "none",
        auth: refreshedAuth,
        instructorProfileId: instructor.id,
        name: instructor.fullName || readFormString(formData, "fullName"),
        role: "teacher",
      }),
    );
    const missingDocuments = missingRequiredDocumentNames(documentState.documentRequirements, documentState);
    const profileOnly = readFormString(formData, "intent") === "profile";

    if (profileOnly || missingDocuments.length > 0) {
      revalidateTag("onboarding", "max");
      return actionOk<OnboardingProgressResult>(
        {
          applicationStatus: "none",
          savedStep: Number(readFormString(formData, "step")) || 2,
          snapshot: {
            applicationStatus: "none",
            documentRequirements: documentState.documentRequirements,
            documents: documentState.documents,
            instructor,
            requirementDocuments: documentState.requirementDocuments,
            role: "teacher",
            user,
          },
          ticket,
        },
        profileOnly && missingDocuments.length === 0
          ? "Profile created. Upload required documents before sending for review."
          : `Upload required document${missingDocuments.length === 1 ? "" : "s"}: ${missingDocuments.join(", ")}.`,
      );
    }

    const submittedInstructor = await submitInstructorProfileForReview(refreshedAuth.accessToken, instructor);
    if (!submittedInstructor || submittedInstructor.status === "none") {
      throw new Error("The backend did not mark your teacher profile as pending review.");
    }

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus: submittedInstructor.status,
        savedStep: Number(readFormString(formData, "step")) || 2,
        snapshot: {
          ...documentState,
          applicationStatus: submittedInstructor.status,
          documentRequirements: documentState.documentRequirements,
          documents: documentState.documents,
          instructor: submittedInstructor,
          requirementDocuments: documentState.requirementDocuments,
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
      "Your teacher profile was submitted for review.",
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
    const profileAuth = await refreshBackendAuth(authContext.refreshToken);
    const profileAccessToken = profileAuth?.accessToken ?? authContext.accessToken;
    const institution = await saveInstitutionProfile(
      formData,
      profileAccessToken,
      authContext.institutionProfileId ?? profileAuth?.user.institutionProfileId,
    );
    if (!institution) throw new Error("The backend did not return the saved institution profile.");

    const refreshedAuth = await refreshBackendAuth(authContext.refreshToken);
    if (!refreshedAuth?.accessToken) {
      return actionError("Your school profile was created, but we could not refresh your session. Sign in again to continue.");
    }

    const documentState = await getDocumentState("institution", refreshedAuth.accessToken);
    const ticket = createVerifiedEmailSessionTicket(
      createSessionResponse({
        applicationStatus: "none",
        auth: refreshedAuth,
        institutionProfileId: institution.id,
        name: institution.name,
        role: "institution",
      }),
    );
    const missingDocuments = missingRequiredDocumentNames(documentState.documentRequirements, documentState);
    const profileOnly = readFormString(formData, "intent") === "profile";

    if (profileOnly || missingDocuments.length > 0) {
      revalidateTag("onboarding", "max");
      return actionOk<OnboardingProgressResult>(
        {
          applicationStatus: "none",
          savedStep: Number(readFormString(formData, "step")) || 4,
          snapshot: {
            applicationStatus: "none",
            documentRequirements: documentState.documentRequirements,
            documents: documentState.documents,
            institution,
            requirementDocuments: documentState.requirementDocuments,
            role: "institution",
            user,
          },
          ticket,
        },
        profileOnly && missingDocuments.length === 0
          ? "Profile created. Upload required documents before sending for review."
          : `Upload required document${missingDocuments.length === 1 ? "" : "s"}: ${missingDocuments.join(", ")}.`,
      );
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
          applicationStatus: submittedInstitution.status,
          documentRequirements: documentState.documentRequirements,
          documents: documentState.documents,
          institution: submittedInstitution,
          requirementDocuments: documentState.requirementDocuments,
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
    const profileAuth = await refreshBackendAuth(authContext.refreshToken);
    const profileAccessToken = profileAuth?.accessToken ?? authContext.accessToken;
    const recruiter = await saveRecruiterProfile(
      formData,
      profileAccessToken,
      authContext.recruiterProfileId ?? profileAuth?.user.recruiterProfileId,
    );
    if (!recruiter) throw new Error("The backend did not return the saved individual profile.");

    const refreshedAuth = await refreshBackendAuth(authContext.refreshToken);
    if (!refreshedAuth?.accessToken) {
      return actionError("Your individual profile was created, but we could not refresh your session. Sign in again to continue.");
    }

    const documentState = await getDocumentState("individual", refreshedAuth.accessToken);
    const ticket = createVerifiedEmailSessionTicket(
      createSessionResponse({
        applicationStatus: "none",
        auth: refreshedAuth,
        name: recruiter.displayName || readFormString(formData, "fullName"),
        recruiterProfileId: recruiter.id,
        role: "individual",
      }),
    );
    const missingDocuments = missingRequiredDocumentNames(documentState.documentRequirements, documentState);
    const profileOnly = readFormString(formData, "intent") === "profile";

    if (profileOnly || missingDocuments.length > 0) {
      revalidateTag("onboarding", "max");
      return actionOk<OnboardingProgressResult>(
        {
          applicationStatus: "none",
          savedStep: Number(readFormString(formData, "step")) || 2,
          snapshot: {
            applicationStatus: "none",
            documentRequirements: documentState.documentRequirements,
            documents: documentState.documents,
            recruiter,
            requirementDocuments: documentState.requirementDocuments,
            role: "individual",
            user,
          },
          ticket,
        },
        profileOnly && missingDocuments.length === 0
          ? "Profile created. Upload required documents before sending for review."
          : `Upload required document${missingDocuments.length === 1 ? "" : "s"}: ${missingDocuments.join(", ")}.`,
      );
    }

    let savedRecruiter = (await getRecruiterSnapshot(refreshedAuth.accessToken)) ?? recruiter;
    if (savedRecruiter.status === "none" || savedRecruiter.status === "rejected") {
      const submitted = normalizeRecruiterSnapshot(await api.patch<BackendRecruiterProfile>("/recruiters/me/status", undefined, {
        auth: false,
        headers: buildBearerHeaders(refreshedAuth.accessToken),
      }));
      if (!submitted || submitted.status !== "pending_review") throw new Error("Your profile could not be submitted for review.");
      savedRecruiter = submitted;
    }
    const applicationStatus = savedRecruiter.status;

    revalidateTag("onboarding", "max");
    return actionOk<OnboardingProgressResult>(
      {
        applicationStatus,
        savedStep: Number(readFormString(formData, "step")) || 4,
        snapshot: {
          applicationStatus,
          documentRequirements: documentState.documentRequirements,
          documents: documentState.documents,
          recruiter: savedRecruiter,
          requirementDocuments: documentState.requirementDocuments,
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
