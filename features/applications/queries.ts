import "server-only";

import { seedApplications, seedTeachers } from "@/data/supplyed";
import { api } from "@/lib/server/api-client";

import { normalizeApplication, normalizeApplicationsQuery, normalizePaginatedApplications } from "./schemas";
import type { JobApplication, JobApplicationsQuery, PaginatedApplications } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function getApplicationById(applicationId: string): Promise<JobApplication | null> {
  if (backendEnabled()) {
    return normalizeApplication(await api.get<JobApplication>(`/applications/${applicationId}`, {
      cache: "no-store",
    }));
  }

  const application = seedApplications.find((item) => item.id === applicationId);
  return application ? toJobApplication(application) : null;
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
    .filter((application) => !normalized.status || application.stage.toUpperCase() === normalized.status)
    .map(toJobApplication);

  return paginateApplications(applications, normalized);
}

export async function listMyApplications(query: JobApplicationsQuery = {}): Promise<PaginatedApplications> {
  const normalized = normalizeApplicationsQuery(query);

  if (backendEnabled()) {
    const result = await api.get<PaginatedApplications>("/applications/me", {
      next: { tags: ["applications", "applications:me"] },
      query: normalized,
    });

    return normalizePaginatedApplications(result);
  }

  const applications = seedApplications
    .filter((application) => application.teacherId === "t-sarah")
    .filter((application) => !normalized.status || application.stage.toUpperCase() === normalized.status)
    .map(toJobApplication);

  return paginateApplications(applications, normalized);
}

function toJobApplication(application: (typeof seedApplications)[number]): JobApplication {
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
}

function paginateApplications(applications: JobApplication[], query: JobApplicationsQuery): PaginatedApplications {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const start = (page - 1) * limit;
  const pagedApplications = applications.slice(start, start + limit);
  const totalPages = Math.ceil(applications.length / limit);

  return {
    applications: pagedApplications,
    pagination: {
      hasNextPage: page < totalPages,
      limit,
      page,
      total: applications.length,
      totalPages,
    },
  };
}
