import type { ReactNode } from "react";

import type {
  OnboardingDocumentDownloadResult,
  OnboardingDocumentUploadResult,
  OnboardingProfileSnapshot,
} from "@/features/onboarding/types";
import type { AppRole } from "@/types/supplyed";

export type SignupRole = Extract<AppRole, "institution" | "teacher" | "individual">;
export type SignupStep = 1 | 2 | 3 | 4;
export type OnboardingPending = "step" | "submit" | null;
export type DocumentUploadField = "dbsCertificateFile" | "identityPhoto" | "qualificationFile" | "rightToWorkFile";

export type OnboardingFinishResult = {
  data?: {
    applicationStatus?: string;
    snapshot?: OnboardingProfileSnapshot;
    ticket?: string;
  };
  message?: string;
  ok: boolean;
};

export type OnboardingDocumentUploadActionResult = {
  data?: OnboardingDocumentUploadResult;
  message?: string;
  ok: boolean;
};

export type OnboardingDocumentDownloadActionResult = {
  data?: OnboardingDocumentDownloadResult;
  message?: string;
  ok: boolean;
};

export type SignupField =
  | "accountRole"
  | "fullName"
  | "email"
  | "phone"
  | "postcode"
  | "password"
  | "confirmPassword"
  | "termsAccepted"
  | "schoolName"
  | "contactRole"
  | "institutionAddress"
  | "institutionCity"
  | "institutionCountryCode"
  | "institutionDomain"
  | "institutionRegistrationId"
  | "localAuthority"
  | "coverTypes"
  | "subjects"
  | "keyStages"
  | "skills"
  | "yearsExperience"
  | "hourlyRate"
  | "dailyRate"
  | "maxTravelDistance"
  | "currency"
  | "bio"
  | "dbsNumber"
  | "dbsCertificateFile"
  | "rightToWorkFile"
  | "identityPhoto"
  | "qualificationFile"
  | "individualRelationship"
  | "learningMode"
  | "preferredSchedule"
  | "budgetRange"
  | "learnerNotes"
  | "individualConsent"
  | "complianceContact"
  | "complianceEmail"
  | "safeguardingConfirmed";

export type SignupErrors = Partial<Record<SignupField, string>>;

export type UploadedFile = {
  file?: File;
  id?: string;
  name: string;
  status?: string | null;
  size: number;
  type: string;
};

export type SignupForm = {
  bio: string;
  budgetRange: string;
  complianceContact: string;
  complianceEmail: string;
  confirmPassword: string;
  contactRole: string;
  coverTypes: string[];
  currency: string;
  dailyRate: string;
  dbsCertificateFile: UploadedFile | null;
  dbsNumber: string;
  email: string;
  fullName: string;
  hourlyRate: string;
  identityPhoto: UploadedFile | null;
  individualConsent: boolean;
  individualRelationship: string;
  institutionAddress: string;
  institutionCity: string;
  institutionCountryCode: string;
  institutionDomain: string;
  institutionProfileId: string;
  institutionRegistrationId: string;
  keyStages: string[];
  learnerNotes: string;
  learningMode: string;
  localAuthority: string;
  maxTravelDistance: string;
  password: string;
  phone: string;
  postcode: string;
  preferredSchedule: string;
  qualificationFile: UploadedFile | null;
  rightToWorkFile: UploadedFile | null;
  safeguardingConfirmed: boolean;
  schoolName: string;
  skills: string[];
  subjects: string[];
  teacherProfileId: string;
  teachingReferenceNumber: string;
  termsAccepted: boolean;
  yearsExperience: string;
};

export type ReviewLine = {
  label: string;
  value: ReactNode;
  wide?: boolean;
};

export type ReviewGroup = {
  description: string;
  editStep: SignupStep;
  icon: string;
  lines: ReviewLine[];
  title: string;
};
