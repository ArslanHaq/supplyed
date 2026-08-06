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
  subject?: string | null;
  location?: string | null;
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
  description: string;
  endDate?: string;
  expiresAt?: string;
  keyStages: string[];
  location?: string;
  parkingInfo?: string;
  payAmount?: number;
  payType?: JobPayType;
  startDate?: string;
  status?: Extract<JobStatus, "ACTIVE" | "DRAFT">;
  subject?: string;
  title: string;
};

export type JobUpdateInput = Partial<Omit<JobCreateInput, "status">> & {
  id: string;
  status?: JobStatus;
};

export type { Job, JobStatus };
