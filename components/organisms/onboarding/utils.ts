import { cn } from "@/lib/cn";
import {
  acceptAttribute,
  describeAllowedMimes,
  documentFileValidationError,
  formatByteLimit,
  isImageRequirement,
} from "@/features/onboarding/document-utils";
import type {
  OnboardingDocumentMap,
  OnboardingDocumentRequirement,
  OnboardingDocumentSnapshot,
  OnboardingProfileSnapshot,
} from "@/features/onboarding/types";

import { initialForm } from "./constants";
import type { SignupForm, UploadedFile } from "./types";

export function roleLabel(role: string) {
  if (role === "teacher") return "Supply teacher";
  if (role === "individual") return "Individual hirer";
  return "School / MAT";
}

export function signupHeroTitle(role: string) {
  if (role === "teacher") return "Build your trusted teacher profile.";
  if (role === "individual") return "Find trusted support for a learner.";
  return "Create your school staffing workspace.";
}

export function signupHeroCopy(role: string) {
  if (role === "teacher") {
    return "Complete your teaching profile once, then use it for matching, messaging, bookings, and compliance checks.";
  }

  if (role === "individual") {
    return "Create a safe request, browse verified teachers, and keep every conversation under the verified hiring account.";
  }

  return "Set up a verified workspace for posting cover, reviewing ranked matches, and keeping compliance visible.";
}

export function signupStepTitle(role: string, step: number) {
  if (step === 1) return role === "teacher" ? "Complete your teacher profile" : "Complete profile basics";
  if (step === 2) {
    if (role === "teacher") return "Upload required documents";
    if (role === "individual") return "Add learner needs";
    return "Add school details";
  }
  if (step === 3) return role === "teacher" ? "Review and submit" : role === "individual" ? "Set safeguarding preferences" : "Complete compliance";
  return "Review and submit";
}

export function signupSubmitLabel(role: string) {
  if (role === "individual") return "Create profile";
  return "Submit for review";
}

export function fieldClass(error?: string) {
  return cn("input", error ? "border-danger bg-danger-tint" : null);
}

export function areaClass(error?: string) {
  return cn("textarea min-h-[132px]", error ? "border-danger bg-danger-tint" : null);
}

export function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export type DocumentStatusTone = "" | "amber" | "ghost" | "green" | "red";

/** Maps the backend DocumentVerificationStatus onto a card badge. */
export function documentStatusTag(status?: string | null): { label: string; tone: DocumentStatusTone } | null {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":
      return { label: "Approved", tone: "green" };
    case "PENDING":
      return { label: "Pending review", tone: "amber" };
    case "REJECTED":
      return { label: "Rejected", tone: "red" };
    case "REQUIRES_INFO":
      return { label: "Info needed", tone: "red" };
    case "NOT_REQUIRED":
      return { label: "Uploaded", tone: "ghost" };
    default:
      return null;
  }
}

export function requirementAccept(requirement: OnboardingDocumentRequirement) {
  return acceptAttribute(requirement.allowedMimes);
}

export function requirementIcon(requirement: OnboardingDocumentRequirement) {
  return isImageRequirement(requirement) ? "image" : "file";
}

export function requirementDescription(requirement: OnboardingDocumentRequirement) {
  return requirement.description || `Upload your ${requirement.name.toLowerCase()} as a ${describeAllowedMimes(requirement.allowedMimes)} file.`;
}

export function requirementLimits(requirement: OnboardingDocumentRequirement) {
  return `${describeAllowedMimes(requirement.allowedMimes)} · up to ${formatByteLimit(requirement.maxSizeBytes)}`;
}

export function documentFileError(file: UploadedFile | null, requirement: OnboardingDocumentRequirement) {
  if (!file) return requirement.isRequired ? `${requirement.name} is required.` : undefined;
  if (!file.file && file.id) return undefined;
  if (!file.file) return `${requirement.name} must be uploaded again before continuing.`;

  const validationError = documentFileValidationError(file, requirement);
  if (validationError) return validationError;
  if (!file.id) return `${requirement.name} must finish uploading before continuing.`;

  return undefined;
}

export function toUploadedFile(file: File): UploadedFile {
  return {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export function toUploadedFileFromDocument(document: OnboardingDocumentSnapshot): UploadedFile {
  return {
    id: document.id,
    name: document.name,
    requirementId: document.requirementId,
    size: document.size,
    status: document.status,
    type: document.type,
    uploadedAt: document.uploadedAt,
  };
}

export function uploadedFilesFromSnapshot(documents: OnboardingDocumentMap = {}) {
  const files: Record<string, UploadedFile | null> = {};

  Object.values(documents).forEach((document) => {
    if (document?.uploadedAt) files[document.requirementId] = toUploadedFileFromDocument(document);
  });

  return files;
}

export function createInitialForm(accountEmail?: string, snapshot?: OnboardingProfileSnapshot): SignupForm {
  const user = snapshot?.user;
  const instructor = snapshot?.instructor;
  const institution = snapshot?.institution;
  const recruiter = snapshot?.recruiter;

  return {
    ...initialForm,
    bio: instructor?.bio ?? recruiter?.bio ?? "",
    complianceContact: institution?.complianceContact ?? "",
    complianceEmail: institution?.complianceEmail ?? "",
    contactRole: institution?.userRole ?? "",
    coverTypes: institution?.coverTypes ?? [],
    currency: instructor?.currency || "GBP",
    dailyRate: instructor?.dailyRate ?? "",
    documents: uploadedFilesFromSnapshot(snapshot?.documents),
    email: user?.email || accountEmail || "",
    fullName: instructor?.fullName || recruiter?.displayName || user?.fullName || "",
    hourlyRate: instructor?.hourlyRate ?? "",
    institutionAddress: institution?.address ?? "",
    institutionCity: institution?.city ?? "",
    institutionCountryCode: institution?.countryCode || "GB",
    institutionDomain: institution?.domain ?? "",
    institutionProfileId: institution?.id ?? "",
    institutionRegistrationId: institution?.registrationId ?? "",
    keyStages: instructor?.keyStages ?? [],
    localAuthority: institution?.county ?? "",
    maxTravelDistance: instructor?.maxTravelDistance ?? "",
    phone: user?.phone ?? "",
    postcode: instructor?.postalCode || institution?.postalCode || recruiter?.postalCode || user?.postcode || "",
    recruiterProfileId: recruiter?.id ?? "",
    safeguardingConfirmed: institution?.safeguardingConfirmed ?? false,
    schoolName: institution?.name ?? "",
    skills: instructor?.skills ?? [],
    staffingNeeds: institution?.staffingNeeds ?? "",
    subjects: instructor?.subjects ?? [],
    teacherProfileId: instructor?.id ?? "",
    typicalPupilCount: institution?.typicalPupilCount ?? "",
    yearsExperience: instructor?.yearsExperience ?? "",
  };
}

export function buildOnboardingPayload(form: SignupForm, role: string, step: number, accountEmail?: string) {
  const data = new FormData();
  data.set("role", role);
  data.set("step", String(step));
  data.set("fullName", form.fullName.trim());
  data.set("email", form.email || accountEmail || "");
  data.set("phone", form.phone.trim());
  data.set("postcode", form.postcode.trim());
  data.set("teacherProfileId", form.teacherProfileId);
  data.set("institutionProfileId", form.institutionProfileId);
  data.set("recruiterProfileId", form.recruiterProfileId);
  data.set("schoolName", form.schoolName.trim());
  data.set("contactRole", form.contactRole.trim());
  data.set("institutionAddress", form.institutionAddress.trim());
  data.set("institutionCity", form.institutionCity.trim());
  data.set("institutionCountryCode", form.institutionCountryCode || "GB");
  data.set("institutionDomain", form.institutionDomain.trim());
  data.set("institutionRegistrationId", form.institutionRegistrationId.trim());
  data.set("localAuthority", form.localAuthority.trim());
  data.set("staffingNeeds", form.staffingNeeds.trim());
  data.set("coverTypes", JSON.stringify(form.coverTypes));
  data.set("typicalPupilCount", form.typicalPupilCount.trim());
  data.set("complianceContact", form.complianceContact.trim());
  data.set("complianceEmail", form.complianceEmail.trim());
  data.set("safeguardingConfirmed", String(form.safeguardingConfirmed));
  data.set("subjects", JSON.stringify(form.subjects));
  data.set("keyStages", JSON.stringify(form.keyStages));
  data.set("skills", JSON.stringify(form.skills));
  data.set("yearsExperience", form.yearsExperience.trim());
  data.set("hourlyRate", form.hourlyRate.trim());
  data.set("dailyRate", form.dailyRate.trim());
  data.set("maxTravelDistance", form.maxTravelDistance.trim());
  data.set("currency", form.currency || "GBP");
  data.set("bio", form.bio.trim());
  data.set("teachingReferenceNumber", form.teachingReferenceNumber.trim());
  return data;
}
