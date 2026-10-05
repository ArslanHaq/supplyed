"use server";

import { revalidateTag } from "next/cache";

import { normalizeAuthUser, normalizeRole, normalizeStatus } from "@/features/auth/backend";
import { createVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";
import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { getValidAccessToken } from "@/lib/server/token-refresh";
import { readUnverifiedJwtExpiresAt } from "@/lib/server/jwt";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { missingRequiredDocuments } from "./document-utils";
import {
  getDocumentSnapshots,
  getProfileDocumentRequirements as loadProfileDocumentRequirements,
  uploadProfileDocument,
} from "./documents";
import { hasCreatedRoleProfile } from "./profile-progress";
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
  SignatoryApprovalSnapshot,
  OnboardingSubmitResult,
  OnboardingUserSnapshot,
} from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
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

type InstructorProfilePayload = {
  bio?: string;
  city?: string;
  countryCode?: string;
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
  institutionType: "MAT_SCHOOL" | "SINGLE_SCHOOL";
  name: string;
  postalCode?: string;
  registrationId?: string;
  safeguardingConfirmed?: boolean;
  staffingNeeds?: string;
  typicalPupilCount?: number;
  trust?: {
    companyNumber?: string;
    name: string;
  };
  userRole?: string;
};

type BackendDocumentType = "ADDRESS_PROOF" | "DBS" | "ID" | "QUALIFICATION";

type DownloadDocumentResponse = {
  downloadUrl?: string;
  expiresAt?: string;
  url?: string;
};

type BackendUserProfile = {
  email?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  id?: string;
  name?: string | null;
  phone?: string | null;
  postCode?: string | null;
  role?: unknown;
};

type BackendInstructorProfile = {
  bio?: string | null;
  city?: string | null;
  countryCode?: string;
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
  institutionType?: "MAT_SCHOOL" | "SINGLE_SCHOOL";
  name?: string;
  postalCode?: string | null;
  registrationId?: string | null;
  safeguardingConfirmed?: boolean | null;
  status?: unknown;
  staffingNeeds?: string | null;
  typicalPupilCount?: unknown;
  trust?: {
    companyNumber?: string | null;
    id?: string;
    name?: string;
  } | null;
  userRole?: string | null;
  verified?: boolean;
};

type DocumentSnapshotData = {
  documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>>;
  requirementDocuments: Record<string, OnboardingDocumentSnapshot>;
};

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
    emailVerified: user.emailVerified === true,
    phoneVerified: user.phoneVerified === true,
    fullName: user.name || "",
    phone: user.phone || "",
    postcode: user.postCode || postcodeFallback,
  };
}

function normalizeInstructorSnapshot(profile: BackendInstructorProfile): OnboardingInstructorSnapshot | undefined {
  if (!profile.id) return undefined;

  return {
    bio: profile.bio || "",
    city: profile.city || "",
    countryCode: profile.countryCode || "GB",
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
    institutionType: profile.institutionType === "MAT_SCHOOL" ? "MAT_SCHOOL" : "SINGLE_SCHOOL",
    name: profile.name || "",
    postalCode: profile.postalCode || "",
    registrationId: profile.registrationId || "",
    safeguardingConfirmed: Boolean(profile.safeguardingConfirmed),
    status: normalizeStatus(profile.status),
    staffingNeeds: profile.staffingNeeds || "",
    trust: profile.trust?.id && profile.trust.name
      ? { companyNumber: profile.trust.companyNumber ?? null, id: profile.trust.id, name: profile.trust.name }
      : null,
    typicalPupilCount: numberString(profile.typicalPupilCount),
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

function emptyDocumentSnapshotData(): DocumentSnapshotData {
  return { documents: {}, requirementDocuments: {} };
}

function missingRequiredDocumentNames(
  requirements: OnboardingDocumentRequirementSnapshot[],
  data: DocumentSnapshotData,
) {
  return missingRequiredDocuments(requirements, data.requirementDocuments)
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
      emailVerified: false,
      phoneVerified: false,
      fullName: "",
      phone: "",
      postcode: "",
    },
  };
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

function buildInstructorProfilePayload(formData: FormData): InstructorProfilePayload {
  const postalCode = readFormString(formData, "postcode");
  const profile: InstructorProfilePayload = {
    bio: readFormString(formData, "bio") || undefined,
    city: readFormString(formData, "profileCity") || undefined,
    countryCode: readFormString(formData, "profileCountryCode") || "GB",
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
  const institutionType = readFormString(formData, "institutionType") === "MAT_SCHOOL" ? "MAT_SCHOOL" : "SINGLE_SCHOOL";
  const trustName = readFormString(formData, "trustName");
  const trustCompanyNumber = readFormString(formData, "trustCompanyNumber").replace(/\s+/g, "").toUpperCase();

  return {
    address: readFormString(formData, "institutionAddress"),
    city: readFormString(formData, "institutionCity"),
    countryCode: readFormString(formData, "institutionCountryCode") || "GB",
    complianceContact: readFormString(formData, "complianceContact") || undefined,
    complianceEmail: readFormString(formData, "complianceEmail") || undefined,
    coverTypes: readFormStringArray(formData, "coverTypes"),
    county: readFormString(formData, "localAuthority") || undefined,
    domain: normalizeDomain(readFormString(formData, "institutionDomain")),
    institutionType,
    name: readFormString(formData, "schoolName"),
    postalCode: readFormString(formData, "postcode") || undefined,
    registrationId: readFormString(formData, "institutionRegistrationId") || undefined,
    safeguardingConfirmed: readFormBoolean(formData, "safeguardingConfirmed"),
    staffingNeeds: readFormString(formData, "staffingNeeds") || undefined,
    typicalPupilCount: readFormNumber(formData, "typicalPupilCount"),
    trust: institutionType === "MAT_SCHOOL"
      ? { name: trustName, ...(trustCompanyNumber ? { companyNumber: trustCompanyNumber } : {}) }
      : undefined,
    userRole: readFormString(formData, "contactRole") || undefined,
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

async function getCurrentInstructorSnapshot(accessToken?: string) {
  try {
    return normalizeInstructorSnapshot(
      await api.get<BackendInstructorProfile>(
        "/instructors/me",
        {
          cache: "no-store",
          ...(accessToken ? { auth: false, headers: buildBearerHeaders(accessToken) } : {}),
        },
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
        {
          cache: "no-store",
          ...(accessToken ? { auth: false, headers: buildBearerHeaders(accessToken) } : {}),
        },
      ),
    );
  } catch (error) {
    if (notFoundOrForbidden(error)) return undefined;
    throw error;
  }
}


async function getSignatoryApproval(accessToken?: string): Promise<SignatoryApprovalSnapshot | null> {
  return api.get<SignatoryApprovalSnapshot | null>("/institutions/me/signatory-approval", {
    cache: "no-store",
    ...(accessToken ? { auth: false, headers: buildBearerHeaders(accessToken) } : {}),
  });
}

async function ensureSignatoryApproval(formData: FormData, accessToken: string, forceResend = false) {
  const requested = {
    signatoryEmail: readFormString(formData, "signatoryEmail").toLowerCase(),
    signatoryJobTitle: readFormString(formData, "signatoryJobTitle"),
    signatoryName: readFormString(formData, "signatoryName"),
  };
  const current = await getSignatoryApproval(accessToken);

  if (current?.status === "APPROVED") return current;
  if (
    !forceResend &&
    current?.status === "PENDING" &&
    current.signatoryEmail.toLowerCase() === requested.signatoryEmail &&
    current.signatoryJobTitle === requested.signatoryJobTitle &&
    current.signatoryName === requested.signatoryName
  ) {
    return current;
  }

  return api.post<SignatoryApprovalSnapshot>("/institutions/me/signatory-approval", requested, {
    auth: false,
    headers: buildBearerHeaders(accessToken),
  });
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
    requiresReview: requirement.requiresReview,
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
      snapshot.signatoryApproval = snapshot.institution?.institutionType === "MAT_SCHOOL"
        ? await getSignatoryApproval()
        : null;
    }


    return snapshot;
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

async function getOnboardingAuth(): Promise<BackendAuthResponse & { accessToken: string }> {
  const context = await getServerAuthContext();
  const accessToken = await getValidAccessToken(context);
  if (!context || !accessToken) throw new Error("Your session expired. Sign in again to continue.");

  const user = normalizeAuthUser(await api.get("/auth/me", {
    auth: false,
    cache: "no-store",
    headers: buildBearerHeaders(accessToken),
  }));
  if (!user.emailVerified) throw new Error("Verify your email before creating a profile.");

  // The backend reads the current role from the database on every request.
  return {
    accessToken,
    accessTokenExpiresAt: readUnverifiedJwtExpiresAt(accessToken),
    refreshToken: context.refreshToken ?? undefined,
    user,
  };
}

async function saveUserBasics(formData: FormData, postcodeFallback = "") {
  let currentPhone = "";
  let currentPhoneVerified = false;
  if (backendEnabled()) {
    const current = await api.get<BackendUserProfile>("/auth/me", { cache: "no-store" });
    if (normalizeRole(current.role)) return normalizeUserSnapshot(current, current.email, postcodeFallback);
    currentPhone = current.phone?.trim() ?? "";
    currentPhoneVerified = current.phoneVerified === true;
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

  if (currentPhoneVerified && phone !== currentPhone) {
    throw new Error("Verify your new phone number before creating this profile.");
  }

  if (name || phone) {
    await api.patch("/users/me", {
      name: name || undefined,
      phone: phone && phone !== currentPhone ? phone : undefined,
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

async function saveInstructorProfile(formData: FormData, accessToken: string) {
  const existing = await getCurrentInstructorSnapshot(accessToken);
  if (existing) return existing;

  try {
    return normalizeInstructorSnapshot(await api.post<BackendInstructorProfile>("/instructors", buildInstructorProfilePayload(formData), {
      auth: false,
      headers: buildBearerHeaders(accessToken),
    }));
  } catch (error) {
    // A previous attempt may have saved the profile before its response was lost.
    const saved = await getCurrentInstructorSnapshot(accessToken);
    if (saved) return saved;
    throw error;
  }
}

async function saveInstitutionProfile(formData: FormData, accessToken: string) {
  const existing = await getInstitutionSnapshot(accessToken);
  if (existing) return existing;

  try {
    return normalizeInstitutionSnapshot(await api.post<BackendInstitutionProfile>("/institutions", buildInstitutionProfilePayload(formData), {
      auth: false,
      headers: buildBearerHeaders(accessToken),
    }));
  } catch (error) {
    // A previous attempt may have saved the profile before its response was lost.
    const saved = await getInstitutionSnapshot(accessToken);
    if (saved) return saved;
    throw error;
  }
}

async function submitInstructorProfileForReview(accessToken: string, current?: OnboardingInstructorSnapshot) {
  if (current && ["pending_review", "approved"].includes(current.status)) return current;
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

async function submitInstitutionProfileForReview(accessToken: string, current?: OnboardingInstitutionSnapshot) {
  if (current && ["pending_review", "approved"].includes(current.status)) return current;
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
  const file = readFormFile(formData, "file");
  if (!file) return actionError("Choose a non-empty document to upload.");
  if (!requirementId && !backendDocumentType(kind)) return actionError("Choose a valid document requirement.");

  try {
    const auth = await getOnboardingAuth();
    const role = auth.user.role;
    if (!role) return actionError("Create your profile before uploading documents.");

    const requirements = await loadProfileDocumentRequirements(role, { accessToken: auth.accessToken });
    const requirement = requirementId
      ? requirements.find((item) => item.id === requirementId)
      : requirements.find((item) => item.code === backendDocumentType(kind));
    if (!requirement) return actionError("This document is not required for your profile.");

    const document = await uploadProfileDocument({
      auth: { accessToken: auth.accessToken },
      file,
      requirement,
    });
    const documentKindValue = documentKind(document.code);
    revalidateTag("onboarding", "max");
    return actionOk<OnboardingDocumentUploadResult>({
      document,
      documents: documentKindValue ? { [documentKindValue]: document } : {},
      requirementDocuments: { [requirement.id]: document },
    }, "Document uploaded.");
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
    const savedUser = await getCurrentUserSnapshot(postcode);
    const stepUser = {
      ...user,
      emailVerified: savedUser?.emailVerified === true,
      phoneVerified: savedUser?.phoneVerified === true && savedUser.phone === user.phone,
    };
    const documentState = normalizeRole(authContext.role)
      ? await getDocumentState(role)
      : {
          documentRequirements: await getProfileDocumentRequirements(role),
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
          user: stepUser,
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
    if (readFormString(formData, "intent") === "review") {
      const sessionAuth = await getOnboardingAuth();
      const [instructor, documentState] = await Promise.all([
        getCurrentInstructorSnapshot(sessionAuth.accessToken),
        getDocumentState("teacher", sessionAuth.accessToken),
      ]);
      if (!instructor) throw new Error("Create your teacher profile before sending it for review.");

      const user = normalizeUserSnapshot(sessionAuth.user, sessionAuth.user.email, readFormString(formData, "postcode"));
      const missingDocuments = missingRequiredDocumentNames(documentState.documentRequirements, documentState);
      if (missingDocuments.length > 0) {
        return actionOk<OnboardingProgressResult>(
          {
            applicationStatus: "none",
            savedStep: Number(readFormString(formData, "step")) || 2,
            snapshot: {
              ...documentState,
              applicationStatus: "none",
              instructor,
              role: "teacher",
              user,
            },
          },
          `Upload required document${missingDocuments.length === 1 ? "" : "s"}: ${missingDocuments.join(", ")}.`,
        );
      }

      const submittedInstructor = await submitInstructorProfileForReview(sessionAuth.accessToken, instructor);
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
            instructor: submittedInstructor,
            role: "teacher",
            user,
          },
          ticket: createVerifiedEmailSessionTicket(
            createSessionResponse({
              applicationStatus: submittedInstructor.status,
              auth: sessionAuth,
              instructorProfileId: submittedInstructor.id,
              name: submittedInstructor.fullName,
              role: "teacher",
            }),
          ),
        },
        "Your teacher profile was submitted for review.",
      );
    }

    const postcode = readFormString(formData, "postcode");
    const user = await saveUserBasics(formData, postcode);
    const sessionAuth = await getOnboardingAuth();
    if (sessionAuth.user.role && sessionAuth.user.role !== "teacher") {
      return actionError("This account already has a different profile. Refresh the page to continue.");
    }
    const instructor = await saveInstructorProfile(formData, sessionAuth.accessToken);
    if (!instructor) throw new Error("The backend did not return the saved teacher profile.");

    const documentState = await getDocumentState("teacher", sessionAuth.accessToken);
    const ticket = createVerifiedEmailSessionTicket(
      createSessionResponse({
        applicationStatus: "none",
        auth: sessionAuth,
        instructorProfileId: instructor.id,
        name: instructor.fullName || readFormString(formData, "fullName"),
        role: "teacher",
      }),
    );
    const missingDocuments = missingRequiredDocumentNames(documentState.documentRequirements, documentState);
    if (missingDocuments.length > 0) {
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
        `Upload required document${missingDocuments.length === 1 ? "" : "s"}: ${missingDocuments.join(", ")}.`,
      );
    }

    const submittedInstructor = await submitInstructorProfileForReview(sessionAuth.accessToken, instructor);
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
            auth: sessionAuth,
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
    if (readFormString(formData, "intent") === "review") {
      const sessionAuth = await getOnboardingAuth();
      const [institution, documentState, signatoryApproval] = await Promise.all([
        getInstitutionSnapshot(sessionAuth.accessToken),
        getDocumentState("institution", sessionAuth.accessToken),
        getSignatoryApproval(sessionAuth.accessToken),
      ]);
      if (!institution) throw new Error("Create your school profile before sending it for review.");

      const user = normalizeUserSnapshot(sessionAuth.user, sessionAuth.user.email, readFormString(formData, "postcode"));
      const missingDocuments = missingRequiredDocumentNames(documentState.documentRequirements, documentState);
      if (missingDocuments.length > 0 || (institution.institutionType === "MAT_SCHOOL" && signatoryApproval?.status !== "APPROVED")) {
        return actionOk<OnboardingProgressResult>(
          {
            applicationStatus: "none",
            savedStep: Number(readFormString(formData, "step")) || 4,
            snapshot: {
              ...documentState,
              applicationStatus: "none",
              institution,
              role: "institution",
              signatoryApproval,
              user,
            },
          },
          missingDocuments.length > 0
            ? `Upload required document${missingDocuments.length === 1 ? "" : "s"}: ${missingDocuments.join(", ")}.`
            : "Waiting for the trust signatory to approve this school before it can be submitted for review.",
        );
      }

      const submittedInstitution = await submitInstitutionProfileForReview(sessionAuth.accessToken, institution);
      if (!submittedInstitution || submittedInstitution.status === "none") {
        throw new Error("The backend did not mark your school profile as pending review.");
      }

      revalidateTag("onboarding", "max");
      return actionOk<OnboardingProgressResult>(
        {
          applicationStatus: submittedInstitution.status,
          savedStep: Number(readFormString(formData, "step")) || 4,
          snapshot: {
            ...documentState,
            applicationStatus: submittedInstitution.status,
            institution: submittedInstitution,
            role: "institution",
            signatoryApproval,
            user,
          },
          ticket: createVerifiedEmailSessionTicket(
            createSessionResponse({
              applicationStatus: submittedInstitution.status,
              auth: sessionAuth,
              institutionProfileId: submittedInstitution.id,
              name: submittedInstitution.name,
              role: "institution",
            }),
          ),
        },
        "Your school profile was submitted for review.",
      );
    }

    const postcode = readFormString(formData, "postcode");
    const user = await saveUserBasics(formData, postcode);
    const sessionAuth = await getOnboardingAuth();
    if (sessionAuth.user.role && sessionAuth.user.role !== "institution") {
      return actionError("This account already has a different profile. Refresh the page to continue.");
    }
    const institution = await saveInstitutionProfile(formData, sessionAuth.accessToken);
    if (!institution) throw new Error("The backend did not return the saved institution profile.");
    const signatoryApproval = institution.institutionType === "MAT_SCHOOL"
      ? await ensureSignatoryApproval(formData, sessionAuth.accessToken, readFormString(formData, "intent") === "signatory")
      : null;

    const documentState = await getDocumentState("institution", sessionAuth.accessToken);
    const ticket = createVerifiedEmailSessionTicket(
      createSessionResponse({
        applicationStatus: "none",
        auth: sessionAuth,
        institutionProfileId: institution.id,
        name: institution.name,
        role: "institution",
      }),
    );
    const missingDocuments = missingRequiredDocumentNames(documentState.documentRequirements, documentState);
    if (missingDocuments.length > 0 || (institution.institutionType === "MAT_SCHOOL" && signatoryApproval?.status !== "APPROVED")) {
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
            signatoryApproval,
            user,
          },
          ticket,
        },
        missingDocuments.length > 0
          ? `Upload required document${missingDocuments.length === 1 ? "" : "s"}: ${missingDocuments.join(", ")}.`
          : "Waiting for the trust signatory to approve this school before it can be submitted for review.",
      );
    }

    if (institution.institutionType === "MAT_SCHOOL" && signatoryApproval?.status !== "APPROVED") {
      revalidateTag("onboarding", "max");
      return actionOk<OnboardingProgressResult>(
        {
          applicationStatus: "none",
          savedStep: Number(readFormString(formData, "step")) || 4,
          snapshot: {
            ...documentState,
            applicationStatus: "none",
            institution,
            role: "institution",
            signatoryApproval,
            user,
          },
          ticket,
        },
        signatoryApproval?.status === "DECLINED"
          ? signatoryApproval.declineReason || "The trust signatory declined this request. Update the details and send a new request."
          : "Waiting for the trust signatory to approve this school before it can be submitted for review.",
      );
    }

    const submittedInstitution = await submitInstitutionProfileForReview(sessionAuth.accessToken, institution);
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
          signatoryApproval,
          user,
        },
        ticket: createVerifiedEmailSessionTicket(
          createSessionResponse({
            applicationStatus: submittedInstitution.status,
            auth: sessionAuth,
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

export async function submitOnboardingAction(formData: FormData) {
  const role = readFormString(formData, "role");
  if (role === "teacher") return submitInstructorOnboarding(formData);
  if (role === "institution") return submitInstitutionOnboarding(formData);

  return actionError("Choose a valid account type before creating your profile.");
}
