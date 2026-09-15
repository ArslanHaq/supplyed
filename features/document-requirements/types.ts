export type ApplicationDocumentRequirement = {
  code: string;
  description: string | null;
  documentTypeId: string;
  id: string;
  name: string;
  requiresReview: boolean;
};

export type BackendApplicationDocumentRequirement = {
  context?: unknown;
  documentType?: {
    code?: unknown;
    description?: unknown;
    id?: unknown;
    isActive?: unknown;
    name?: unknown;
  } | null;
  documentTypeId?: unknown;
  id?: unknown;
  isActive?: unknown;
  requiresReview?: unknown;
};
