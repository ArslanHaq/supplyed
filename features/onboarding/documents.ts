import "server-only";

import { api, ApiError } from "@/lib/server/api-client";
import type { AppRole } from "@/types/supplyed";
import { profileDocumentContext } from "./document-requirements";

import {
  backendProfileRole,
  contentTypeForFile,
  documentFileValidationError,
  isProfileRequirementContext,
  missingRequiredDocuments,
} from "./document-utils";
import type {
  OnboardingDocumentMap,
  OnboardingDocumentRequirement,
  OnboardingDocumentSnapshot,
  OnboardingDocumentState,
} from "./types";

/**
 * Backend client for the profile document flow:
 *
 *   GET  /document-requirements/profile      what the profile must upload
 *   POST /documents                          create an empty document for a requirement
 *   POST /documents/:id/upload-url           presigned PUT for a replacement file
 *   PUT  <signed url>                        the bytes go straight to S3
 *   POST /documents/:id/upload-complete      make the uploaded file current
 *   GET  /documents                          paginated list with current file details
 */

export type DocumentRequestAuth = {
  accessToken?: string | null;
};

type RequestOptions = {
  cache?: RequestCache;
  auth?: boolean;
  headers?: HeadersInit;
  query?: Record<string, number | string | undefined>;
};

type BackendDocumentType = {
  allowedMimes?: unknown;
  code?: string;
  description?: string | null;
  id?: string;
  isActive?: boolean;
  maxSizeBytes?: unknown;
  name?: string;
};

type BackendDocumentRequirement = {
  context?: string;
  documentType?: BackendDocumentType | null;
  documentTypeId?: string;
  id?: string;
  isActive?: boolean;
  isRequired?: boolean;
  requiresReview?: boolean;
};

type BackendDocument = {
  applicationId?: string | null;
  contentType?: string | null;
  createdAt?: Date | string;
  deletedAt?: Date | string | null;
  fileKey?: string | null;
  id?: string;
  originalName?: string | null;
  requirement?: BackendDocumentRequirement | null;
  requirementId?: string;
  sizeBytes?: unknown;
  status?: string;
  uploadedAt?: Date | string | null;
};

type BackendUploadUrl = {
  expiresAt?: string;
  fileKey?: string;
  requiredHeaders?: Record<string, string>;
  url?: string;
};

const documentsPageSize = 100;
const documentsMaxPages = 20;
const localMaxSizeBytes = 10 * 1024 * 1024;
const localAllowedMimes = ["application/pdf", "image/jpeg", "image/png"];

/** Stand-in requirements so the documents step still works with the backend disabled. */
const localInstructorRequirements: OnboardingDocumentRequirement[] = [
  {
    allowedMimes: localAllowedMimes,
    code: "DBS",
    context: "INSTRUCTOR_PROFILE",
    description: "Upload the certificate issued by the Disclosure and Barring Service.",
    id: "local-dbs",
    isRequired: true,
    maxSizeBytes: localMaxSizeBytes,
    name: "Enhanced DBS certificate",
    requiresReview: true,
  },
  {
    allowedMimes: localAllowedMimes,
    code: "ID",
    context: "INSTRUCTOR_PROFILE",
    description: "Upload a clear passport, driving licence, or official photo ID.",
    id: "local-id",
    isRequired: true,
    maxSizeBytes: localMaxSizeBytes,
    name: "Photo ID",
    requiresReview: true,
  },
  {
    allowedMimes: localAllowedMimes,
    code: "QUALIFICATION",
    context: "INSTRUCTOR_PROFILE",
    description: "Upload a certificate or QTS evidence document.",
    id: "local-qualification",
    isRequired: true,
    maxSizeBytes: localMaxSizeBytes,
    name: "Teaching qualification",
    requiresReview: true,
  },
  {
    allowedMimes: localAllowedMimes,
    code: "ADDRESS_PROOF",
    context: "INSTRUCTOR_PROFILE",
    description: "Upload a recent bill, bank statement, or official address evidence.",
    id: "local-address-proof",
    isRequired: true,
    maxSizeBytes: localMaxSizeBytes,
    name: "Proof of address",
    requiresReview: true,
  },
];

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

function readIsoDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  return readString(value);
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

/**
 * Right after the profile is created the session token still carries the USER
 * role, so callers can pass a freshly refreshed token instead.
 */
function requestOptions(auth: DocumentRequestAuth, extra: RequestOptions = {}): RequestOptions {
  if (!auth.accessToken) return extra;
  return { ...extra, auth: false, headers: { Authorization: `Bearer ${auth.accessToken}` } };
}

function notFoundOrForbidden(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

function normalizeRequirement(requirement: BackendDocumentRequirement): OnboardingDocumentRequirement | undefined {
  const documentType = requirement.documentType;
  if (!requirement.id || !documentType?.id) return undefined;
  if (requirement.isActive === false || documentType.isActive === false) return undefined;

  return {
    allowedMimes: readStringArray(documentType.allowedMimes),
    code: readString(documentType.code) ?? "",
    context: readString(requirement.context) ?? "",
    description: readString(documentType.description) ?? null,
    id: requirement.id,
    isRequired: requirement.isRequired !== false,
    maxSizeBytes: readNumber(documentType.maxSizeBytes) ?? localMaxSizeBytes,
    name: readString(documentType.name) ?? readString(documentType.code) ?? "Document",
    requiresReview: Boolean(requirement.requiresReview),
  };
}

function normalizeDocument(document: BackendDocument): OnboardingDocumentSnapshot | undefined {
  if (!document.id || !document.requirementId) return undefined;

  return {
    code: readString(document.requirement?.documentType?.code) ?? null,
    id: document.id,
    name: readString(document.originalName) ?? "",
    requirementId: document.requirementId,
    size: readNumber(document.sizeBytes) ?? 0,
    status: readString(document.status) ?? null,
    type: readString(document.contentType) ?? "",
    uploadedAt: readString(document.fileKey) ? (readIsoDate(document.uploadedAt) ?? null) : null,
  };
}

export async function getProfileDocumentRequirements(
  role: AppRole | null | undefined,
  auth: DocumentRequestAuth = {},
): Promise<OnboardingDocumentRequirement[]> {
  const profileRole = backendProfileRole(role);
  if (!profileRole) return [];
  if (!backendEnabled()) return role === "teacher" ? localInstructorRequirements : [];

  const response = await api.get<unknown>(
    "/document-requirements/profile",
    requestOptions(auth, { cache: "no-store", query: { role: profileRole } }),
  );
  if (!Array.isArray(response)) throw new Error("Document requirements could not be verified. Try again.");
  if (response.some((item) => !isRecord(item) || !item.id || !isRecord(item.documentType) || !item.documentType.id)) {
    throw new Error("Document requirements are incomplete. Try again.");
  }
  console.log("getProfileDocumentRequirements", { role, profileRole, response });
  if (response.some((item) => item.context !== profileDocumentContext(role))) {
    throw new Error("Document requirements do not match your profile. Retry the check.");
  }

  return response
    .filter(isRecord)
    .map((item) => normalizeRequirement(item as BackendDocumentRequirement))
    .filter(
      (item): item is OnboardingDocumentRequirement => Boolean(item) && item?.context === profileDocumentContext(role),
    );
}

/** Every non-deleted profile document the user owns, across all pages. */
async function listProfileDocuments(auth: DocumentRequestAuth): Promise<BackendDocument[]> {
  if (!backendEnabled()) return [];

  const documents: BackendDocument[] = [];

  try {
    for (let page = 1; page <= documentsMaxPages; page += 1) {
      const response = await api.get<unknown>(
        "/documents",
        requestOptions(auth, { cache: "no-store", query: { limit: documentsPageSize, page } }),
      );
      const batch = Array.isArray(response)
        ? response
        : isRecord(response) && Array.isArray(response.documents)
          ? response.documents
          : [];
      if (!Array.isArray(response) && !(isRecord(response) && Array.isArray(response.documents))) {
        throw new Error("Your uploaded documents could not be verified. Try again.");
      }

      documents.push(...(batch.filter(isRecord) as BackendDocument[]));

      const hasNextPage = isRecord(response) && isRecord(response.pagination) && response.pagination.hasNextPage === true;
      if (!hasNextPage) break;
      if (page === documentsMaxPages) throw new Error("Your complete document list could not be verified.");
    }
  } catch (error) {
    throw error;
  }

  return documents.filter(
    (document) => document.id && document.requirementId && !document.applicationId && !document.deletedAt,
  );
}

/** Documents that have a file, keyed by requirement. The newest file wins if a requirement has duplicates. */
export async function getDocumentSnapshots(auth: DocumentRequestAuth = {}): Promise<OnboardingDocumentMap> {
  const documents: OnboardingDocumentMap = {};

  (await listProfileDocuments(auth)).forEach((document) => {
    const snapshot = normalizeDocument(document);
    if (!snapshot?.uploadedAt || !snapshot.requirementId) return;

    const current = documents[snapshot.requirementId];
    if (!current || snapshot.uploadedAt > (current.uploadedAt ?? "")) {
      documents[snapshot.requirementId] = snapshot;
    }
  });

  return documents;
}

export async function getDocumentState(
  role: AppRole | null | undefined,
  auth: DocumentRequestAuth = {},
): Promise<OnboardingDocumentState> {
  const [documentRequirements, documents] = await Promise.all([
    getProfileDocumentRequirements(role, auth),
    getDocumentSnapshots(auth),
  ]);

  return { documentRequirements, documents };
}

export function emptyDocumentState(): OnboardingDocumentState {
  return { documentRequirements: [], documents: {} };
}

export function validateDocumentFile(file: File, requirement: OnboardingDocumentRequirement) {
  return documentFileValidationError(file, requirement);
}

export function assertRequiredDocumentsUploaded(state: OnboardingDocumentState) {
  const missing = missingRequiredDocuments(state.documentRequirements, state.documents);
  if (missing.length === 0) return;

  throw new Error(`Upload the required documents before continuing: ${missing.map((item) => item.name).join(", ")}.`);
}

/** The backend rejects path separators and line breaks in the stored file name. */
function safeOriginalName(name: string) {
  return name.replace(/[\r\n/\\]/g, "").trim().slice(0, 255) || "document";
}

/**
 * Reuse the document row for a requirement so a replacement updates its current
 * file rather than creating a second document. A row created by an earlier
 * attempt that never completed its upload is picked up here too.
 */
async function findExistingDocument(requirementId: string, auth: DocumentRequestAuth) {
  const candidates = (await listProfileDocuments(auth)).filter((document) => document.requirementId === requirementId);
  const withFile = candidates.filter((document) => Boolean(document.fileKey));
  const pool = withFile.length > 0 ? withFile : candidates;

  return pool.sort((left, right) => (readIsoDate(right.createdAt) ?? "").localeCompare(readIsoDate(left.createdAt) ?? ""))[0];
}

async function createDocument(requirementId: string, auth: DocumentRequestAuth) {
  const created = await api.post<BackendDocument>("/documents", { requirementId }, requestOptions(auth));
  const id = readString(created?.id);

  if (!id) {
    throw new Error("The backend did not return the created document.");
  }

  return id;
}

export async function uploadProfileDocument({
  auth,
  file,
  requirement,
}: {
  auth: DocumentRequestAuth;
  file: File;
  requirement: OnboardingDocumentRequirement;
}): Promise<OnboardingDocumentSnapshot> {
  const contentType = contentTypeForFile(file, requirement.allowedMimes);
  const existing = await findExistingDocument(requirement.id, auth);
  const documentId = existing?.id ?? (await createDocument(requirement.id, auth));

  const upload = await api.post<BackendUploadUrl>(
    `/documents/${documentId}/upload-url`,
    { contentType, sizeBytes: file.size },
    requestOptions(auth),
  );
  const uploadUrl = readString(upload?.url);
  const fileKey = readString(upload?.fileKey);

  if (!uploadUrl || !fileKey) {
    throw new Error("The backend did not return a signed upload URL.");
  }

  // The URL is signed over these headers, so send them exactly as returned.
  const uploadResponse = await fetch(uploadUrl, {
    body: file,
    headers: { "Content-Type": contentType, ...(upload.requiredHeaders ?? {}) },
    method: "PUT",
  });

  if (!uploadResponse.ok) {
    throw new Error(`Unable to upload ${file.name}. The signed upload failed with status ${uploadResponse.status}.`);
  }

  const completed = await api.post<BackendDocument>(
    `/documents/${documentId}/upload-complete`,
    { fileKey, originalName: safeOriginalName(file.name) },
    requestOptions(auth),
  );
  const snapshot = normalizeDocument(completed ?? {});

  if (!snapshot) {
    throw new Error("The backend did not return the uploaded document.");
  }

  return snapshot;
}
