export type JobApplicationStatus = "APPLIED" | "COMPLETED" | "HIRED" | "INTERVIEW" | "REJECTED" | "SHORTLISTED" | "VIEWED";

export type ApplicantSummary = {
  city?: string | null;
  county?: string | null;
  dbsVerified: boolean;
  experience?: number | null;
  fullName: string;
  id: string;
  imageUrl?: string | null;
  keyStages: string[];
  ratingAverage: number;
  ratingCount: number;
  skills: string[];
  subjects: string[];
};

export type ApplicationJobSummary = {
  endDate?: string | null;
  id: string;
  location?: string | null;
  payAmount?: number | string | null;
  payType?: string | null;
  postedByUserId: string;
  startDate?: string | null;
  status: string;
  subject?: string | null;
  title: string;
};

export type JobApplication = {
  coverLetter?: string | null;
  createdAt?: string | null;
  id: string;
  instructor?: ApplicantSummary;
  instructorId: string;
  job?: ApplicationJobSummary;
  jobId: string;
  status: JobApplicationStatus;
  updatedAt?: string | null;
};

export type ApplicationsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedApplications = {
  applications: JobApplication[];
  pagination: ApplicationsPagination;
};

export type JobApplicationsQuery = {
  limit?: number;
  page?: number;
  status?: JobApplicationStatus;
};

export type CreateApplicationInput = {
  coverLetter: string;
  jobId: string;
};

export type UpdateApplicationStatusInput = {
  id: string;
  status: JobApplicationStatus;
};
