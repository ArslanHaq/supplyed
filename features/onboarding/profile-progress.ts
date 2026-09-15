import { isDocumentReadyForReview } from "./document-utils";
import type { OnboardingProfileSnapshot } from "./types";

export function hasCreatedRoleProfile(snapshot: OnboardingProfileSnapshot) {
  if (snapshot.role === "teacher") return Boolean(snapshot.instructor?.id);
  if (snapshot.role === "institution") return Boolean(snapshot.institution?.id);
  if (snapshot.role === "individual") return Boolean(snapshot.recruiter?.id);
  return false;
}

export function profileEntryStatus(snapshot: OnboardingProfileSnapshot) {
  if (snapshot.applicationStatus === "suspended") return "suspended";
  if (!hasCreatedRoleProfile(snapshot) || snapshot.applicationStatus === "rejected") return "none";
  if (snapshot.documentRequirements.some((requirement) =>
    requirement.isRequired && !isDocumentReadyForReview(snapshot.requirementDocuments[requirement.id])
  )) return "none";
  return snapshot.applicationStatus;
}
