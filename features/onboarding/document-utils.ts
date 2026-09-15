import type { AppRole } from "@/types/supplyed";

import type { OnboardingDocumentMap, OnboardingDocumentRequirement } from "./types";

/**
 * Pure helpers shared by the server actions, the API route, and the client
 * form. Nothing here touches the backend or the browser.
 */

export type BackendProfileRole = "INSTITUTION" | "INSTRUCTOR" | "RECRUITER";

type FileLike = { name: string; size: number; type: string };

type RequirementLimits = Pick<OnboardingDocumentRequirement, "allowedMimes" | "maxSizeBytes" | "name">;

const mimeExtensions: Record<string, string[]> = {
  "application/msword": [".doc"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/gif": [".gif"],
  "image/heic": [".heic"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const mimeLabels: Record<string, string> = {
  "application/msword": "DOC",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/gif": "GIF",
  "image/heic": "HEIC",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

/** The `role` query value the backend needs when the caller still has the USER role. */
export function backendProfileRole(role: AppRole | null | undefined): BackendProfileRole | undefined {
  if (role === "teacher") return "INSTRUCTOR";
  if (role === "institution") return "INSTITUTION";
  if (role === "individual") return "RECRUITER";
  return undefined;
}

/** Application-context requirements need an application id, so onboarding only shows profile contexts. */
export function isProfileRequirementContext(context: string | null | undefined) {
  return typeof context === "string" && context.endsWith("_PROFILE");
}

export function normalizeMime(value: string) {
  return value.split(";")[0].trim().toLowerCase();
}

function mimeLabel(mime: string) {
  const normalized = normalizeMime(mime);
  return mimeLabels[normalized] ?? normalized.split("/").pop()?.toUpperCase() ?? normalized;
}

/** Value for the file input's `accept` attribute: MIME types plus the extensions browsers match on. */
export function acceptAttribute(allowedMimes: string[]) {
  const entries = new Set<string>();

  allowedMimes.forEach((mime) => {
    const normalized = normalizeMime(mime);
    if (!normalized) return;
    entries.add(normalized);
    (mimeExtensions[normalized] ?? []).forEach((extension) => entries.add(extension));
  });

  return Array.from(entries).join(",");
}

/** "PDF, JPG or PNG" style label for copy. */
export function describeAllowedMimes(allowedMimes: string[]) {
  const labels = Array.from(new Set(allowedMimes.map(mimeLabel).filter(Boolean)));
  if (labels.length === 0) return "any";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

export function formatByteLimit(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The MIME type to sign the upload with. Browsers sometimes report an empty or
 * generic type, so fall back to the extension when it maps to an allowed type.
 */
export function contentTypeForFile(file: FileLike, allowedMimes: string[]) {
  const explicit = normalizeMime(file.type);
  const allowed = allowedMimes.map(normalizeMime);
  if (explicit && allowed.includes(explicit)) return explicit;

  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const inferred = allowed.find((mime) => (mimeExtensions[mime] ?? []).includes(extension));
  return inferred ?? explicit;
}

export function documentFileValidationError(file: FileLike, requirement: RequirementLimits) {
  if (file.size <= 0) return `${requirement.name} file is empty.`;
  if (file.size > requirement.maxSizeBytes) {
    return `${requirement.name} must be ${formatByteLimit(requirement.maxSizeBytes)} or smaller.`;
  }

  const allowed = requirement.allowedMimes.map(normalizeMime);
  if (allowed.length > 0 && !allowed.includes(contentTypeForFile(file, requirement.allowedMimes))) {
    return `${requirement.name} must be a ${describeAllowedMimes(requirement.allowedMimes)} file.`;
  }

  return undefined;
}

export function isImageRequirement(requirement: Pick<OnboardingDocumentRequirement, "allowedMimes">) {
  const allowed = requirement.allowedMimes.map(normalizeMime);
  return allowed.length > 0 && allowed.every((mime) => mime.startsWith("image/"));
}

export function missingRequiredDocuments(requirements: OnboardingDocumentRequirement[], documents: OnboardingDocumentMap) {
  return requirements.filter((requirement) => requirement.isRequired && !isDocumentReadyForReview(documents[requirement.id]));
}

export function isDocumentReadyForReview(document?: { uploadedAt?: string | null; status?: string | null }) {
  return Boolean(document?.uploadedAt && ["PENDING", "APPROVED", "NOT_REQUIRED"].includes(document.status?.toUpperCase() ?? ""));
}

export function hasRequiredDocuments(requirements: OnboardingDocumentRequirement[], documents: OnboardingDocumentMap) {
  return missingRequiredDocuments(requirements, documents).length === 0;
}
