import "server-only";

import { api, ApiError } from "@/lib/server/api-client";

import { applyJobFilters, normalizeBackendJob, normalizeJobFilters } from "./schemas";
import type { BackendJobResponse, Job, JobListFilters } from "./types";

export async function listJobs(filters: JobListFilters = {}): Promise<Job[]> {
  const normalized = normalizeJobFilters(filters);
  const jobs = await api.get<BackendJobResponse[]>("/jobs", {
    next: { tags: ["jobs"] },
  });

  return applyJobFilters(jobs.map(normalizeBackendJob), normalized);
}

export async function listMyJobs(filters: JobListFilters = {}): Promise<Job[]> {
  const normalized = normalizeJobFilters(filters);
  const jobs = await api.get<BackendJobResponse[]>("/jobs/mine", {
    next: { tags: ["jobs", "jobs:mine"] },
  });

  return applyJobFilters(jobs.map(normalizeBackendJob), normalized);
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

export async function getMyJob(id: string): Promise<Job | null> {
  const jobs = await listMyJobs();
  return jobs.find((job) => job.id === id) ?? null;
}
