import type { ComplianceApprovalSnapshot, OnboardingInstitutionSnapshot, SignatoryApprovalSnapshot } from "./types";

export function waitingForInstitutionApproval(
  institution: Pick<OnboardingInstitutionSnapshot, "institutionType" | "complianceApprovalRequired"> | undefined,
  signatory?: SignatoryApprovalSnapshot | null,
  compliance?: ComplianceApprovalSnapshot | null,
) {
  if (!institution) return false;
  return institution.institutionType === "MAT_SCHOOL"
    ? signatory?.status !== "APPROVED"
    : institution.complianceApprovalRequired !== false && compliance?.status !== "APPROVED";
}
