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

/** Per-card upload errors keyed by document requirement id. */
export type DocumentErrors = Record<string, string | undefined>;

export type DocumentPreview = {
  expiresAt?: string;
  file: UploadedFile;
  url: string;
};

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
  | "recruiterProfileId"
  | "phone"
  | "postcode"
  | "password"
  | "confirmPassword"
  | "termsAccepted"
  | "schoolName"
  | "contactRole"
  | "complianceContact"
  | "complianceEmail"
  | "coverTypes"
  | "localAuthority"
  | "typicalPupilCount"
  | "institutionAddress"
  | "institutionCity"
  | "institutionCountryCode"
  | "institutionDomain"
  | "institutionRegistrationId"
  | "staffingNeeds"
  | "subjects"
  | "keyStages"
  | "skills"
  | "yearsExperience"
  | "hourlyRate"
  | "dailyRate"
  | "maxTravelDistance"
  | "currency"
  | "bio"
  | "documents"
  | "safeguardingConfirmed";

export type SignupErrors = Partial<Record<SignupField, string>>;

export type UploadedFile = {
  file?: File;
  id?: string;
  name: string;
  requirementId?: string;
  status?: string | null;
  size: number;
  type: string;
  uploadedAt?: string | null;
};

export type SignupForm = {
  bio: string;
  confirmPassword: string;
  contactRole: string;
  complianceContact: string;
  complianceEmail: string;
  coverTypes: string[];
  currency: string;
  dailyRate: string;
  /** Uploaded or in-flight files keyed by document requirement id. */
  documents: Record<string, UploadedFile | null>;
  email: string;
  fullName: string;
  hourlyRate: string;
  institutionAddress: string;
  institutionCity: string;
  institutionCountryCode: string;
  institutionDomain: string;
  institutionProfileId: string;
  institutionRegistrationId: string;
  keyStages: string[];
  localAuthority: string;
  maxTravelDistance: string;
  password: string;
  phone: string;
  postcode: string;
  recruiterProfileId: string;
  safeguardingConfirmed: boolean;
  schoolName: string;
  skills: string[];
  staffingNeeds: string;
  subjects: string[];
  teacherProfileId: string;
  teachingReferenceNumber: string;
  termsAccepted: boolean;
  typicalPupilCount: string;
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
