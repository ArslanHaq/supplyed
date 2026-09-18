import type { Job, JobPayType, JobStatus } from "@/types/supplyed";

export type JobListFilters = {
  keyStage?: string;
  mode?: Job["mode"];
  search?: string;
  status?: JobStatus;
  subject?: string;
  urgent?: boolean;
};

export type BackendJobResponse = {
  id: string;
  postedByUserId: string;
  title: string;
  description: string;
  jobType?: string | null;
  mode?: string | null;
  postingMode?: string | null;
  subject?: string | null;
  requiredSkills?: string[];
  minExperienceYears?: number | string | null;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
  keyStages?: string[];
  parkingInfo?: string | null;
  payAmount?: number | string | null;
  payType?: JobPayType | string | null;
  status: JobStatus;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type JobCreateInput = {
  address?: string;
  city?: string;
  countryCode?: string;
  county?: string;
  description: string;
  documentRequirementIds?: string[];
  endDate?: string;
  expiresAt?: string;
  keyStages?: string[];
  latitude?: number;
  longitude?: number;
  minExperienceYears?: number;
  parkingInfo?: string;
  payAmount?: number;
  payType?: JobPayType;
  postalCode?: string;
  requiredSkills?: string[];
  startDate?: string;
  status?: Extract<JobStatus, "ACTIVE" | "DRAFT">;
  subject?: string;
  title: string;
};

export type JobUpdateInput = Partial<Omit<JobCreateInput, "documentRequirementIds" | "status">> & {
  id: string;
  status?: JobStatus;
};

export type { Job, JobStatus };
