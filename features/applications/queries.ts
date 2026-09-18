import "server-only";
import { api } from "@/lib/server/api-client";
import { normalizeApplicationsQuery, normalizePaginatedApplications } from "./schemas";
import type { ApplicantSummary, JobApplicationsQuery, PaginatedApplications } from "./types";

export async function listApplicationsByJob(
  jobId: string,
  query: JobApplicationsQuery = {},
): Promise<PaginatedApplications> {
  const result = normalizePaginatedApplications(
    await api.get<PaginatedApplications>(`/applications/job/${jobId}`, {
      cache: "no-store",
      query: normalizeApplicationsQuery(query),
    }),
  );
  // Application DTOs contain profile IDs only. Resolve names with the instructor endpoint.
  const instructors = new Map(
    await Promise.all(
      [...new Set(result.applications.map((item) => item.instructorId))].map(async (id) => {
        try {
          return [id, await api.get<ApplicantSummary>(`/instructors/${id}`, { cache: "no-store" })] as const;
        } catch {
          return [id, undefined] as const;
        }
      }),
    ),
  );
  return {
    ...result,
    applications: result.applications.map((item) => ({ ...item, instructor: instructors.get(item.instructorId) })),
  };
}
export async function listMyApplications(query: JobApplicationsQuery = {}) {
  return normalizePaginatedApplications(
    await api.get<PaginatedApplications>("/applications/me", {
      cache: "no-store",
      query: normalizeApplicationsQuery(query),
    }),
  );
}
