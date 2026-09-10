import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type OnboardingSnapshot = {
  applicationStatus: ApplicationStatus;
  completed: boolean;
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

/** A profile document requirement from GET /document-requirements/profile, flattened with its document type. */
export type OnboardingDocumentRequirement = {
  allowedMimes: string[];
  code: string;
  context: string;
  description: string | null;
  id: string;
  isRequired: boolean;
  maxSizeBytes: number;
  name: string;
  requiresReview: boolean;
};

/** The current file version of one of the user's documents, keyed to the requirement it satisfies. */
export type OnboardingDocumentSnapshot = {
  code?: string | null;
  id: string;
  name: string;
  requirementId: string;
  size: number;
  status?: string | null;
  type: string;
  uploadedAt?: string | null;
  versionId?: string | null;
  versionNumber?: number | null;
};

/** Documents keyed by requirement id. */
export type OnboardingDocumentMap = Record<string, OnboardingDocumentSnapshot>;

export type OnboardingDocumentState = {
  documentRequirements: OnboardingDocumentRequirement[];
  documents: OnboardingDocumentMap;
};

export type OnboardingUserSnapshot = {
  email: string;
  fullName: string;
  phone: string;
  postcode: string;
};

export type OnboardingInstructorSnapshot = {
  bio: string;
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

export type OnboardingProfileSnapshot = OnboardingDocumentState & {
  applicationStatus: ApplicationStatus;
  institution?: OnboardingInstitutionSnapshot;
  instructor?: OnboardingInstructorSnapshot;
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
  documents: OnboardingDocumentMap;
};

export type OnboardingDocumentDownloadResult = {
  expiresAt?: string;
  url: string;
};
