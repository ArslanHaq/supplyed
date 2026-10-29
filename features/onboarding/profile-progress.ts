import { missingRequiredDocuments } from "./document-utils";
import type { OnboardingProfileSnapshot } from "./types";

// Access checks need only status evidence, not editable profile/document details.
export type ProfileEligibilitySnapshot = Pick<OnboardingProfileSnapshot, "role" | "applicationStatus" | "signatoryApproval"> & {
  user?: { emailVerified: boolean; phoneVerified: boolean };
  instructor?: { id: string };
  institution?: { id: string; institutionType: "MAT_SCHOOL" | "SINGLE_SCHOOL" };
  documentRequirements: { id: string; isRequired: boolean; requiresReview: boolean }[];
  requirementDocuments: Record<string, { uploadedAt?: string | null; documentExpiryDate?: string | null; status?: string | null }>;
};

export function hasCreatedRoleProfile(snapshot: ProfileEligibilitySnapshot) {
  if (snapshot.role === "teacher") return Boolean(snapshot.instructor?.id);
  if (snapshot.role === "institution") return Boolean(snapshot.institution?.id);
  return false;
}

function hasRequiredTrustApproval(snapshot: ProfileEligibilitySnapshot) {
  if (snapshot.role !== "institution" || snapshot.institution?.institutionType !== "MAT_SCHOOL") return true;
  return snapshot.signatoryApproval?.status === "APPROVED";
}

export function isProfileVerified(snapshot: ProfileEligibilitySnapshot) {
  if (!snapshot.user?.emailVerified || !snapshot.user.phoneVerified ||
      snapshot.applicationStatus !== "approved" || !hasCreatedRoleProfile(snapshot) || !hasRequiredTrustApproval(snapshot)) return false;

  return snapshot.documentRequirements.every((requirement) => {
    if (!requirement.isRequired) return true;
    const document = snapshot.requirementDocuments[requirement.id];
    if (document?.documentExpiryDate && Date.parse(document.documentExpiryDate) <= Date.now()) return false;
    if (!document?.uploadedAt) return !requirement.isRequired;
    const status = document.status?.toUpperCase();
    return status === "APPROVED" || (status === "NOT_REQUIRED" && !requirement.requiresReview);
  });
}

export function profileEntryStatus(snapshot: ProfileEligibilitySnapshot) {
  if (snapshot.applicationStatus === "suspended") return "suspended";
  if (!hasCreatedRoleProfile(snapshot) || snapshot.applicationStatus === "rejected") return "none";
  if (missingRequiredDocuments(snapshot.documentRequirements, snapshot.requirementDocuments).length > 0) return "none";
  if (!hasRequiredTrustApproval(snapshot)) return "none";
  return snapshot.applicationStatus;
}
