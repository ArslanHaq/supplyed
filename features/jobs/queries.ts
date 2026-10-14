import "server-only";

import { api, ApiError } from "@/lib/server/api-client";

import { normalizeBackendJob, normalizeJobFilters, normalizeMyJobs, normalizePaginatedJobs } from "./schemas";
import type { BackendJobResponse, Job, JobListFilters, JobsPagination, JobStatusCounts, MyJobs, PaginatedJobs } from "./types";

type BackendPage = { jobs?: BackendJobResponse[]; pagination?: Partial<JobsPagination> };

/** One page of the public job board, filtered by the backend. */
export async function listJobs(filters: JobListFilters = {}): Promise<PaginatedJobs> {
  const normalized = normalizeJobFilters(filters);
  const result = await api.get<BackendPage>("/jobs", {
    next: { tags: ["jobs"] },
    query: normalized,
  });

  return normalizePaginatedJobs(result, normalized);
}

/** One page of the signed-in poster's own jobs, with how many are in each status. */
export async function listMyJobs(filters: JobListFilters = {}): Promise<MyJobs> {
  const normalized = normalizeJobFilters(filters);
  const result = await api.get<BackendPage & { statusCounts?: Partial<JobStatusCounts> }>("/jobs/mine", {
    next: { tags: ["jobs", "jobs:mine"] },
    query: normalized,
  });

  return normalizeMyJobs(result, normalized);
}

export async function getJob(id: string): Promise<Job | null> {
  try {
    const job = await api.get<BackendJobResponse>(`/jobs/${id}`, {
      next: { tags: ["jobs", `job:${id}`] },
    });

    return normalizeBackendJob(job);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** One of the signed-in poster's own jobs in any status (drafts included); null when it is not theirs. */
export async function getMyJob(id: string): Promise<Job | null> {
  try {
    const job = await api.get<BackendJobResponse>(`/jobs/mine/${encodeURIComponent(id)}`, {
      next: { tags: ["jobs", "jobs:mine", `job:${id}`] },
    });

    return normalizeBackendJob(job);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}
