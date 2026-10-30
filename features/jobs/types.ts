import type { Job, JobPayType, JobStatus, JobType } from "@/types/supplyed";

/** Paging and filters, applied by the backend so every page is filtered the same way. */
export type JobListFilters = {
  jobType?: JobType;
  keyStage?: string;
  limit?: number;
  page?: number;
  search?: string;
  /** The poster's own jobs only. */
  status?: JobStatus;
  subject?: string;
  urgent?: boolean;
};

export type JobsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedJobs = {
  jobs: Job[];
  pagination: JobsPagination;
};

/** How many of the poster's jobs are in each status, whatever page or filter is showing. */
export type JobStatusCounts = Record<"ALL" | JobStatus, number>;

export type MyJobs = PaginatedJobs & {
  statusCounts: JobStatusCounts;
};

export type BackendJobResponse = {
  canDelete: boolean;
  termsLocked: boolean;
  hasBeenPublished: boolean;
  id: string;
  institution?: { id: string; imageUrl: string | null; name: string } | null;
  postedByUserId: string;
  title: string;
  description: string;
  jobType?: JobType | string | null;
  mode?: string | null;
  postingMode?: string | null;
  subject?: string | null;
  subjects?: string[];
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
  hours?: number | null;
  days?: number | null;
  payAmount?: number | string | null;
  payType?: JobPayType | string | null;
  status: JobStatus;
  liveFrom?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type JobCreateInput = {
  otherSubjects?: string[]; otherSkills?: string[];
  address?: string;
  city?: string;
  countryCode?: string;
  county?: string;
  description: string;
  endDate?: string;
  expiresAt?: string;
  liveFrom?: string;
  keyStages: string[];
  jobType: JobType;
  latitude?: number;
  longitude?: number;
  minExperienceYears?: number;
  parkingInfo?: string;
  hours?: number | null;
  days?: number | null;
  payAmount?: number;
  payType?: JobPayType;
  postalCode?: string;
  requiredSkills?: string[];
  startDate?: string;
  status?: Extract<JobStatus, "ACTIVE" | "DRAFT">;
  subjects?: string[];
  title: string;
};

export type JobUpdateInput = Partial<Omit<JobCreateInput, "status" | "liveFrom">> & {
  id: string;
  liveFrom?: string | null;
  status?: JobStatus;
};

export type { Job, JobStatus, JobType };
