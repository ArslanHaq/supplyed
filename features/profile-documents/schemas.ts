import type { ProfileDocument } from "./types";

function date(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export function normalizeProfileDocument(value: ProfileDocument): ProfileDocument {
  return {
    id: value.id ?? "",
    kind: value.kind === "ACHIEVEMENT" ? "ACHIEVEMENT" : "CERTIFICATE",
    title: value.title?.trim() || "Untitled",
    description: value.description?.trim() || null,
    issueDate: date(value.issueDate),
    originalName: value.originalName?.trim() || null,
    contentType: value.contentType?.trim() || null,
    sizeBytes: Number.isFinite(Number(value.sizeBytes)) ? Number(value.sizeBytes) : null,
    fileUrl: value.fileUrl?.trim() || null,
    fileUrlExpiresAt: date(value.fileUrlExpiresAt),
    createdAt: date(value.createdAt) ?? new Date(0).toISOString(),
    updatedAt: date(value.updatedAt) ?? new Date(0).toISOString(),
  };
}

export const normalizeProfileDocuments = (values: ProfileDocument[]) =>
  Array.isArray(values) ? values.map(normalizeProfileDocument).filter((item) => item.id) : [];
