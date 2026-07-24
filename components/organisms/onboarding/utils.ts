import { cn } from "@/lib/cn";

import { allowedDocumentContentTypes, initialForm, maxDocumentSizeBytes } from "./constants";
import type { SignupForm, UploadedFile } from "./types";
import type { OnboardingDocumentSnapshot, OnboardingProfileSnapshot } from "@/features/onboarding/types";

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
  if (role === "individual") return "Create learner request";
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

export function contentTypeFromFile(file: UploadedFile) {
  const explicitType = file.type.toLowerCase();
  if (allowedDocumentContentTypes.has(explicitType)) return explicitType;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";

  return explicitType;
}

export function documentFileError(file: UploadedFile | null, label: string) {
  if (!file) return `${label} is required.`;
  if (!file.file && file.id) return undefined;
  if (!file.file) return `${label} must be uploaded again before continuing.`;
  if (file.size > maxDocumentSizeBytes) return `${label} must be 10 MB or smaller.`;
  if (!allowedDocumentContentTypes.has(contentTypeFromFile(file))) return `${label} must be a PDF, JPG, or PNG file.`;
  if (!file.id) return `${label} must finish uploading before continuing.`;
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
    size: document.size,
    status: document.status,
    type: document.type,
  };
}

export function createInitialForm(accountEmail?: string, snapshot?: OnboardingProfileSnapshot): SignupForm {
  const user = snapshot?.user;
  const instructor = snapshot?.instructor;
  const institution = snapshot?.institution;
  const documents = snapshot?.documents ?? {};
  const dbsDocument = documents.dbs;
  const idDocument = documents.id;
  const addressDocument = documents.addressProof;
  const qualificationDocument = documents.qualification;

  return {
    ...initialForm,
    bio: instructor?.bio ?? "",
    contactRole: institution?.userRole ?? "",
    coverTypes: institution?.staffingNeeds ?? [],
    currency: instructor?.currency || "GBP",
    dailyRate: instructor?.dailyRate ?? "",
    dbsCertificateFile: dbsDocument
      ? { id: dbsDocument.id, name: dbsDocument.name, size: dbsDocument.size, status: dbsDocument.status, type: dbsDocument.type }
      : null,
    dbsNumber: dbsDocument?.dbsNumber ?? "",
    email: user?.email || accountEmail || "",
    fullName: instructor?.fullName || user?.fullName || "",
    hourlyRate: instructor?.hourlyRate ?? "",
    identityPhoto: idDocument
      ? { id: idDocument.id, name: idDocument.name, size: idDocument.size, status: idDocument.status, type: idDocument.type }
      : null,
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
    postcode: institution?.postalCode || user?.postcode || "",
    qualificationFile: qualificationDocument
      ? {
          id: qualificationDocument.id,
          name: qualificationDocument.name,
          size: qualificationDocument.size,
          status: qualificationDocument.status,
          type: qualificationDocument.type,
        }
      : null,
    rightToWorkFile: addressDocument
      ? { id: addressDocument.id, name: addressDocument.name, size: addressDocument.size, status: addressDocument.status, type: addressDocument.type }
      : null,
    schoolName: institution?.name ?? "",
    skills: instructor?.skills ?? [],
    subjects: instructor?.subjects ?? [],
    teacherProfileId: instructor?.id ?? "",
    yearsExperience: instructor?.yearsExperience ?? "",
  };
}

export function appendFile(data: FormData, key: string, file: UploadedFile | null) {
  if (file?.file) data.set(key, file.file, file.name);
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
  data.set("schoolName", form.schoolName.trim());
  data.set("contactRole", form.contactRole.trim());
  data.set("institutionAddress", form.institutionAddress.trim());
  data.set("institutionCity", form.institutionCity.trim());
  data.set("institutionCountryCode", form.institutionCountryCode || "GB");
  data.set("institutionDomain", form.institutionDomain.trim());
  data.set("institutionRegistrationId", form.institutionRegistrationId.trim());
  data.set("localAuthority", form.localAuthority.trim());
  data.set("coverTypes", JSON.stringify(form.coverTypes));
  data.set("subjects", JSON.stringify(form.subjects));
  data.set("keyStages", JSON.stringify(form.keyStages));
  data.set("skills", JSON.stringify(form.skills));
  data.set("yearsExperience", form.yearsExperience.trim());
  data.set("hourlyRate", form.hourlyRate.trim());
  data.set("dailyRate", form.dailyRate.trim());
  data.set("maxTravelDistance", form.maxTravelDistance.trim());
  data.set("currency", form.currency || "GBP");
  data.set("bio", form.bio.trim());
  data.set("dbsNumber", form.dbsNumber.trim());
  data.set("dbsDocumentId", form.dbsCertificateFile?.id ?? "");
  data.set("idDocumentId", form.identityPhoto?.id ?? "");
  data.set("addressProofDocumentId", form.rightToWorkFile?.id ?? "");
  data.set("qualificationDocumentId", form.qualificationFile?.id ?? "");
  data.set("teachingReferenceNumber", form.teachingReferenceNumber.trim());
  appendFile(data, "dbsCertificateFile", form.dbsCertificateFile);
  appendFile(data, "identityPhoto", form.identityPhoto);
  appendFile(data, "rightToWorkFile", form.rightToWorkFile);
  appendFile(data, "qualificationFile", form.qualificationFile);
  return data;
}
