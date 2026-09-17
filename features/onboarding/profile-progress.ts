import { missingRequiredDocuments } from "./document-utils";
import type { OnboardingProfileSnapshot } from "./types";

export function hasCreatedRoleProfile(snapshot: OnboardingProfileSnapshot) {
  if (snapshot.role === "teacher") return Boolean(snapshot.instructor?.id);
  if (snapshot.role === "institution") return Boolean(snapshot.institution?.id);
  if (snapshot.role === "individual") return Boolean(snapshot.recruiter?.id);
  return false;
}

export function isProfileVerified(snapshot: OnboardingProfileSnapshot) {
  if (!snapshot.user?.emailVerified || !snapshot.user.phoneVerified ||
      snapshot.applicationStatus !== "approved" || !hasCreatedRoleProfile(snapshot)) return false;

  return snapshot.documentRequirements.every((requirement) => {
    const document = snapshot.requirementDocuments[requirement.id];
    if (!document?.uploadedAt) return !requirement.isRequired;
    const status = document.status?.toUpperCase();
    return status === "APPROVED" || (status === "NOT_REQUIRED" && !requirement.requiresReview);
  });
}

export function profileEntryStatus(snapshot: OnboardingProfileSnapshot) {
  if (snapshot.applicationStatus === "suspended") return "suspended";
  if (!hasCreatedRoleProfile(snapshot) || snapshot.applicationStatus === "rejected") return "none";
  if (missingRequiredDocuments(snapshot.documentRequirements, snapshot.requirementDocuments).length > 0) return "none";
  return snapshot.applicationStatus;
}
