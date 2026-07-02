import "server-only";

import { seedJobs } from "@/data/supplyed";
import { api } from "@/lib/server/api-client";

import { normalizeJobFilters } from "./schemas";
import type { Job, JobListFilters } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function listJobs(filters: JobListFilters = {}): Promise<Job[]> {
  const normalized = normalizeJobFilters(filters);

  if (backendEnabled()) {
    return api.get<Job[]>("/jobs", {
      next: { tags: ["jobs"] },
      query: normalized,
    });
  }

  return seedJobs.filter((job) => {
    const matchesSearch = normalized.search
      ? job.title.toLowerCase().includes(normalized.search.toLowerCase()) ||
        job.school.toLowerCase().includes(normalized.search.toLowerCase())
      : true;
    const matchesSubject = normalized.subject ? job.subject === normalized.subject : true;
    const matchesKeyStage = normalized.keyStage ? job.keyStage === normalized.keyStage : true;
    const matchesMode = normalized.mode ? job.mode === normalized.mode : true;
    const matchesUrgent = normalized.urgent === undefined ? true : job.urgent === normalized.urgent;

    return matchesSearch && matchesSubject && matchesKeyStage && matchesMode && matchesUrgent;
  });
}

export async function getJob(id: string): Promise<Job | null> {
  if (backendEnabled()) {
    return api.get<Job>(`/jobs/${id}`, {
      next: { tags: ["jobs", `job:${id}`] },
    });
  }

  return seedJobs.find((job) => job.id === id) ?? null;
}
