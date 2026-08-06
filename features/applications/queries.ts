import "server-only";

import { seedApplications, seedTeachers } from "@/data/supplyed";
import { api } from "@/lib/server/api-client";

import { normalizeApplicationsQuery, normalizePaginatedApplications } from "./schemas";
import type { JobApplication, JobApplicationsQuery, PaginatedApplications } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function listApplicationsByJob(jobId: string, query: JobApplicationsQuery = {}): Promise<PaginatedApplications> {
  const normalized = normalizeApplicationsQuery(query);

  if (backendEnabled()) {
    const result = await api.get<PaginatedApplications>(`/applications/job/${jobId}`, {
      next: { tags: ["applications", `applications:job:${jobId}`] },
      query: normalized,
    });

    return normalizePaginatedApplications(result);
  }

  const applications = seedApplications
    .filter((application) => application.jobId === jobId)
    .map<JobApplication>((application) => {
      const teacher = seedTeachers.find((item) => item.id === application.teacherId);

      return {
        coverLetter: application.coverLetter,
        createdAt: application.appliedAt,
        id: application.id,
        instructor: teacher
          ? {
              city: teacher.city,
              county: null,
              dbsVerified: teacher.dbs,
              experience: teacher.yearsExp,
              fullName: teacher.name,
              id: teacher.id,
              imageUrl: null,
              keyStages: teacher.keyStages,
              ratingAverage: teacher.rating,
              ratingCount: teacher.reviews,
              skills: [teacher.role],
              subjects: teacher.subjects,
            }
          : undefined,
        instructorId: application.teacherId,
        jobId: application.jobId,
        status: application.stage.toUpperCase() as JobApplication["status"],
        updatedAt: null,
      };
    });

  return {
    applications,
    pagination: {
      hasNextPage: false,
      limit: normalized.limit ?? 20,
      page: normalized.page ?? 1,
      total: applications.length,
      totalPages: applications.length ? 1 : 0,
    },
  };
}
