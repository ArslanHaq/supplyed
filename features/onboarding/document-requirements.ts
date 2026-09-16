import type { AppRole } from "@/types/supplyed";

import type { OnboardingDocumentRequirementSnapshot } from "./types";

export function profileDocumentContext(role?: AppRole | null) {
  if (role === "teacher") return "INSTRUCTOR_PROFILE";
  if (role === "institution") return "INSTITUTION_PROFILE";
  if (role === "individual") return "RECRUITER_PROFILE";
  return undefined;
}

export function filterProfileDocumentRequirements(
  requirements: OnboardingDocumentRequirementSnapshot[],
  role?: AppRole | null,
) {
  const context = profileDocumentContext(role);
  if (!context) return [];

  const requirementsByType = new Map<string, OnboardingDocumentRequirementSnapshot>();

  for (const requirement of requirements) {
    if (requirement.context !== context) continue;

    const documentTypeKey =
      requirement.documentType.id ?? requirement.documentTypeId ?? requirement.documentType.code.toUpperCase();
    const current = requirementsByType.get(documentTypeKey);

    if (!current || (!current.isRequired && requirement.isRequired)) {
      requirementsByType.set(documentTypeKey, requirement);
    }
  }

  return Array.from(requirementsByType.values());
}