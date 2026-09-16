import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type SettingsUserSnapshot = {
  createdAt: string | null;
  email: string;
  emailVerified: boolean;
  id: string;
  lastLogin: string | null;
  name: string;
  phone: string;
  phoneVerified: boolean;
  role: AppRole | null;
  twoFactorEnabled: boolean;
  updatedAt: string | null;
};

export type SettingsInstructorProfile = {
  address: string;
  bio: string;
  city: string;
  countryCode: string;
  county: string;
  createdAt: string | null;
  currency: string;
  dailyRate: string;
  dbsVerified: boolean;
  experience: string;
  fullName: string;
  hourlyRate: string;
  id: string;
  imageUrl: string;
  keyStages: string[];
  maxTravelDistance: string;
  postalCode: string;
  ratingAverage: number | null;
  ratingCount: number;
  skills: string[];
  status: ApplicationStatus;
  subjects: string[];
  updatedAt: string | null;
  userId: string | null;
};

export type SettingsInstitutionProfile = {
  address: string;
  city: string;
  complianceContact: string;
  complianceEmail: string;
  countryCode: string;
  county: string;
  coverTypes: string[];
  createdAt: string | null;
  domain: string;
  id: string;
  imageUrl: string;
  name: string;
  postalCode: string;
  registrationId: string;
  safeguardingConfirmed: boolean;
  staffingNeeds: string;
  status: ApplicationStatus;
  typicalPupilCount: string;
  updatedAt: string | null;
  userId: string | null;
  userRole: string;
  verified: boolean;
};

export type SettingsRecruiterProfile = {
  address: string;
  bio: string;
  city: string;
  countryCode: string;
  county: string;
  createdAt: string | null;
  displayName: string;
  id: string;
  imageUrl: string;
  postalCode: string;
  status: ApplicationStatus;
  updatedAt: string | null;
  userId: string | null;
};

export type SettingsProfileSnapshot = {
  applicationStatus: ApplicationStatus;
  institution?: SettingsInstitutionProfile;
  instructor?: SettingsInstructorProfile;
  recruiter?: SettingsRecruiterProfile;
  role: AppRole | null;
  user: SettingsUserSnapshot;
};

export type SettingsUserUpdateInput = {
  name: string;
  phone: string;
};

export type SettingsInstructorUpdateInput = {
  address: string;
  bio: string;
  city: string;
  countryCode: string;
  county: string;
  currency: string;
  dailyRate: string;
  experience: string;
  fullName: string;
  hourlyRate: string;
  id?: string;
  imageUrl: string;
  keyStages: string[];
  maxTravelDistance: string;
  postalCode: string;
  skills: string[];
  subjects: string[];
};

export type SettingsInstitutionUpdateInput = {
  address: string;
  city: string;
  complianceContact: string;
  complianceEmail: string;
  countryCode: string;
  county: string;
  coverTypes: string[];
  domain: string;
  id?: string;
  imageUrl: string;
  name: string;
  postalCode: string;
  registrationId: string;
  safeguardingConfirmed: boolean;
  staffingNeeds: string;
  typicalPupilCount: string;
  userRole: string;
};

export type SettingsRecruiterUpdateInput = {
  address: string;
  bio: string;
  city: string;
  countryCode: string;
  county: string;
  displayName: string;
  id?: string;
  imageUrl: string;
  postalCode: string;
};

export type SettingsUpdateInput = {
  institution?: SettingsInstitutionUpdateInput;
  instructor?: SettingsInstructorUpdateInput;
  recruiter?: SettingsRecruiterUpdateInput;
  role: AppRole;
  user: SettingsUserUpdateInput;
};
