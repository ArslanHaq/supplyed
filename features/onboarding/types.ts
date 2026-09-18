import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type OnboardingSnapshot = {
  applicationStatus: ApplicationStatus;
  completed: boolean;
  verified: boolean;
  role: AppRole | null;
  step: number;
};

export type OnboardingSubmitInput = {
  role: AppRole;
  step: number;
  values: Record<string, unknown>;
};

export type OnboardingSubmitResult = {
  applicationStatus: ApplicationStatus;
  snapshot?: OnboardingProfileSnapshot;
  ticket?: string;
};

export type OnboardingDocumentKind = "addressProof" | "dbs" | "id" | "qualification";
export type OnboardingDocumentContext =
  | "APPLICATION"
  | "INSTRUCTOR_PROFILE"
  | "INSTITUTION_PROFILE"
  | "RECRUITER_PROFILE";

export type OnboardingDocumentSnapshot = {
  code?: string | null;
  dbsNumber?: string | null;
  id: string;
  name: string;
  rejectionComment?: string | null;
  requirementId?: string | null;
  size: number;
  status?: string | null;
  type: string;
  uploadedAt?: string | null;
  versionId?: string | null;
  versionNumber?: number | null;
};

export type OnboardingDocumentRequirementSnapshot = {
  context: OnboardingDocumentContext | string;
  documentType: {
    allowedMimes: string[];
    code: string;
    id?: string;
    maxSizeBytes: number;
    name: string;
  };
  documentTypeId?: string;
  id: string;
  isRequired: boolean;
  requiresReview: boolean;
};

export type OnboardingDocumentRequirement = {
  allowedMimes: string[];
  code: string;
  context: OnboardingDocumentContext | string;
  description?: string | null;
  id: string;
  isRequired: boolean;
  maxSizeBytes: number;
  name: string;
  requiresReview: boolean;
};

export type OnboardingDocumentMap = Record<string, OnboardingDocumentSnapshot>;

export type OnboardingDocumentState = {
  documentRequirements: OnboardingDocumentRequirement[];
  documents: OnboardingDocumentMap;
};

export type OnboardingUserSnapshot = {
  isFullyVerified?: boolean;
  email: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullName: string;
  phone: string;
  postcode: string;
};

export type OnboardingInstructorSnapshot = {
  bio: string;
  city: string;
  countryCode: string;
  currency: string;
  dailyRate: string;
  fullName: string;
  hourlyRate: string;
  id: string;
  keyStages: string[];
  maxTravelDistance: string;
  postalCode: string;
  skills: string[];
  status: ApplicationStatus;
  subjects: string[];
  yearsExperience: string;
};

export type OnboardingInstitutionSnapshot = {
  address: string;
  city: string;
  complianceContact: string;
  complianceEmail: string;
  countryCode: string;
  coverTypes: string[];
  county: string;
  domain: string;
  id: string;
  name: string;
  postalCode: string;
  registrationId: string;
  safeguardingConfirmed: boolean;
  status: ApplicationStatus;
  staffingNeeds: string;
  typicalPupilCount: string;
  userRole: string;
  verified: boolean;
};

export type OnboardingRecruiterSnapshot = {
  address: string;
  bio: string;
  city: string;
  countryCode: string;
  county: string;
  displayName: string;
  id: string;
  imageUrl: string;
  postalCode: string;
  status: ApplicationStatus;
};

export type OnboardingProfileSnapshot = {
  applicationStatus: ApplicationStatus;
  documentRequirements: OnboardingDocumentRequirementSnapshot[];
  documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>>;
  institution?: OnboardingInstitutionSnapshot;
  instructor?: OnboardingInstructorSnapshot;
  requirementDocuments: Record<string, OnboardingDocumentSnapshot>;
  recruiter?: OnboardingRecruiterSnapshot;
  role: AppRole | null;
  user?: OnboardingUserSnapshot;
};

export type OnboardingProgressResult = OnboardingSubmitResult & {
  savedStep: number;
  snapshot: OnboardingProfileSnapshot;
};

export type OnboardingDocumentUploadResult = {
  document: OnboardingDocumentSnapshot;
  documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>>;
  requirementDocuments: Record<string, OnboardingDocumentSnapshot>;
};

export type OnboardingDocumentDownloadResult = {
  expiresAt?: string;
  url: string;
};
