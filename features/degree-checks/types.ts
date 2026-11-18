/** The degree as the university confirmed it; a field it corrected without giving the right value is null. */
export type VerifiedDegree = {
  classification: string | null;
  courseName: string | null;
  institutionName: string;
  qualificationType: string | null;
  yearOfAward: number | null;
};

export type DegreeCheckState = "IN_PROGRESS" | "VERIFIED" | "NOT_VERIFIED";

export type DegreeCheck = {
  classification: string;
  courseName: string;
  createdAt: string;
  degree: VerifiedDegree | null;
  dueDate: string | null;
  id: string;
  institutionName: string;
  notes: string | null;
  qualificationType: string;
  state: DegreeCheckState;
  yearOfAward: number;
};

export type DegreeIdentity = {
  birthSurname: string | null;
  dateOfBirth: string;
  firstNames: string;
  lastName: string;
};

export type MyDegreeCheck = {
  available: boolean;
  canStart: boolean;
  degreeCheck: DegreeCheck | null;
  identity: DegreeIdentity | null;
};

export type DegreeInstitution = { consentFormUrl: string | null; id: number; name: string };

export type DegreeInstitutions = { institutions: DegreeInstitution[]; standardConsentFormUrl: string };

export type DegreeConsentUpload = {
  expiresAt: string;
  fileKey: string;
  requiredHeaders: Record<string, string>;
  url: string;
};

export type DegreeCheckInput = {
  classification: string;
  consentFileKey: string;
  courseName: string;
  institutionId: number;
  lastNameAtStudy?: string;
  qualificationType: string;
  yearOfAward: number;
  /** Dev test accounts only: sent when the backend has no verified identity details for them. */
  dateOfBirth?: string;
  firstNames?: string;
  lastName?: string;
};

/** The consent form types Hedd accepts, up to its 5 MB limit. */
export const CONSENT_FORM_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];
export const MAX_CONSENT_FORM_BYTES = 5 * 1024 * 1024;
