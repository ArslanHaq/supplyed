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

export type OnboardingDocumentKind = "addressProof" | "dbs" | "id" | "qualification";

export type OnboardingDocumentSnapshot = {
  dbsNumber?: string | null;
  id: string;
  name: string;
  size: number;
  status?: string | null;
  type: string;
  uploadedAt?: string | null;
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
  skills: string[];
  status: ApplicationStatus;
  subjects: string[];
  yearsExperience: string;
};

export type OnboardingInstitutionSnapshot = {
  address: string;
  city: string;
  countryCode: string;
  county: string;
  domain: string;
  id: string;
  name: string;
  postalCode: string;
  registrationId: string;
  staffingNeeds: string[];
  userRole: string;
  verified: boolean;
};

export type OnboardingProfileSnapshot = {
  applicationStatus: ApplicationStatus;
  documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>>;
  institution?: OnboardingInstitutionSnapshot;
  instructor?: OnboardingInstructorSnapshot;
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
};

export type OnboardingDocumentDownloadResult = {
  expiresAt?: string;
  url: string;
};
