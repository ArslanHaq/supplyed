import "server-only";
import { api } from "@/lib/server/api-client";
import type { OnboardingDocumentRequirement } from "@/features/onboarding/types";
import type { DocumentWorkspace, OwnedDocument } from "./types";

type Requirement = {
  id: string;
  context: string;
  isActive?: boolean;
  isRequired: boolean;
  requiresReview: boolean;
  documentType: {
    name: string;
    code: string;
    description?: string;
    allowedMimes: string[];
    maxSizeBytes: number;
    isActive?: boolean;
  };
};
export async function getDocumentWorkspace(applicationId?: string): Promise<DocumentWorkspace> {
  if (applicationId) await api.get(`/applications/${applicationId}`, { cache: "no-store" });
  const catalogue = await api.get<Requirement[]>("/document-requirements/profile", { cache: "no-store" });
  const requirements: OnboardingDocumentRequirement[] = catalogue
    .filter(
      (item) =>
        item.isActive !== false &&
        item.documentType.isActive !== false &&
        (applicationId ? item.context === "APPLICATION" : item.context !== "APPLICATION"),
    )
    .map((item) => ({
      ...item.documentType,
      id: item.id,
      context: item.context,
      isRequired: item.isRequired,
      requiresReview: item.requiresReview,
    }));
  const documents: OwnedDocument[] = [];
  for (let page = 1; ; page++) {
    const response = await api.get<{ documents: OwnedDocument[]; pagination: { hasNextPage: boolean } }>("/documents", {
      cache: "no-store",
      query: { page, limit: 100 },
    });
    documents.push(
      ...response.documents.filter(
        (item) => !item.deletedAt && (applicationId ? item.applicationId === applicationId : !item.applicationId),
      ),
    );
    if (!response.pagination.hasNextPage) break;
  }
  return { requirements, documents };
}
