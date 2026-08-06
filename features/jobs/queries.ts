import "server-only";

import { seedJobs } from "@/data/supplyed";
import { api, ApiError } from "@/lib/server/api-client";

import { applyJobFilters, normalizeBackendJob, normalizeJobFilters } from "./schemas";
import type { BackendJobResponse, Job, JobListFilters } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function listJobs(filters: JobListFilters = {}): Promise<Job[]> {
  const normalized = normalizeJobFilters(filters);

  if (backendEnabled()) {
    const jobs = await api.get<BackendJobResponse[]>("/jobs", {
      next: { tags: ["jobs"] },
      query: normalized,
    });

    return applyJobFilters(jobs.map(normalizeBackendJob), normalized);
  }

  return applyJobFilters(seedJobs, normalized);
}

export async function listMyJobs(filters: JobListFilters = {}): Promise<Job[]> {
  const normalized = normalizeJobFilters(filters);

  if (backendEnabled()) {
    const jobs = await api.get<BackendJobResponse[]>("/jobs/mine", {
      next: { tags: ["jobs", "jobs:mine"] },
    });

    return applyJobFilters(jobs.map(normalizeBackendJob), normalized);
  }

  return applyJobFilters(seedJobs, normalized);
}

export async function getJob(id: string): Promise<Job | null> {
  if (backendEnabled()) {
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

  return seedJobs.find((job) => job.id === id) ?? null;
}
