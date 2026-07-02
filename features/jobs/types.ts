import type { Job } from "@/types/supplyed";

export type JobListFilters = {
  keyStage?: string;
  mode?: Job["mode"];
  search?: string;
  subject?: string;
  urgent?: boolean;
};

export type JobCreateInput = Pick<Job, "date" | "keyStage" | "mode" | "rate" | "subject" | "title" | "urgent"> & {
  description?: string;
};

export type JobUpdateInput = Partial<JobCreateInput> & {
  id: string;
};

export type { Job };
