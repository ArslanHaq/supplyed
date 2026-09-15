import type {
  ApplicationDocumentRequirement,
  BackendApplicationDocumentRequirement,
} from "./types";

export function normalizeApplicationDocumentRequirements(
  response: unknown,
): ApplicationDocumentRequirement[] {
  if (!Array.isArray(response)) return [];

  return response
    .map((item) => normalizeApplicationDocumentRequirement(item))
    .filter((item): item is ApplicationDocumentRequirement => Boolean(item));
}

function normalizeApplicationDocumentRequirement(
  value: unknown,
): ApplicationDocumentRequirement | undefined {
  if (!isRecord(value)) return undefined;

  const requirement = value as BackendApplicationDocumentRequirement;
  const documentType = requirement.documentType;
  const id = readString(requirement.id);
  const documentTypeId = readString(documentType?.id) ?? readString(requirement.documentTypeId);
  const name = readString(documentType?.name) ?? readString(documentType?.code);

  if (!id || !documentTypeId || !name) return undefined;
  if (requirement.isActive === false || documentType?.isActive === false) return undefined;
  if (readString(requirement.context)?.toUpperCase() !== "APPLICATION") return undefined;

  return {
    code: readString(documentType?.code) ?? "",
    description: readString(documentType?.description) ?? null,
    documentTypeId,
    id,
    name,
    requiresReview: requirement.requiresReview === true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
