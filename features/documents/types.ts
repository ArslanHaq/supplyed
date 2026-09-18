import type { OnboardingDocumentRequirement } from "@/features/onboarding/types";
export type OwnedDocument = {
  id: string;
  requirementId: string;
  applicationId: string | null;
  status: string;
  fileKey: string | null;
  originalName: string | null;
  uploadedAt: string | null;
  deletedAt?: string | null;
  rejectionComment?: string | null;
};
export type DocumentWorkspace = { requirements: OnboardingDocumentRequirement[]; documents: OwnedDocument[] };
