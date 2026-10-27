import "server-only";

import { backendEnabled } from "@/lib/server/backend-config";

import { seedApplications, seedTeachers } from "@/data/supplyed";
import { listMyJobs } from "@/features/jobs/queries";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeApplication, normalizeApplicationHistory, normalizeApplicationsQuery, normalizePaginatedApplications } from "./schemas";
import type { JobApplication, JobApplicationsQuery, PaginatedApplicationHistory, PaginatedApplications } from "./types";


export async function getApplicationById(applicationId: string): Promise<JobApplication | null> {
  if (backendEnabled()) {
    return normalizeApplication(await api.get<JobApplication>(`/applications/${applicationId}`, {
      cache: "no-store",
    }));
  }

  const application = seedApplications.find((item) => item.id === applicationId);
  return application ? toJobApplication(application) : null;
}

export async function listApplicationHistory(applicationId: string, query: { limit?: number; page?: number } = {}): Promise<PaginatedApplicationHistory> {
  const page = Number.isInteger(query.page) && Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number.isInteger(query.limit) && Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const result = await api.get<PaginatedApplicationHistory>(`/applications/${applicationId}/history`, {
    cache: "no-store",
    query: { page, limit },
  });
  return normalizeApplicationHistory(result);
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

/** Total application records across every active job owned by the signed-in institution. */
export async function countApplicationsForActiveJobs(): Promise<{ total: number }> {
  const jobIds: string[] = [];
  let page = 1;
  let hasNextPage = true;
  const seen = new Set<string>();
  const deadline = Date.now() + 30_000;
  const checkBudget = () => {
    if (Date.now() >= deadline) {
      throw new ApiError("The application count took too long to load. Please try again.", 503);
    }
  };

  while (hasNextPage) {
    checkBudget();
    if (page > 100) throw new ApiError("The application count is too large to load. Please try again.", 503);
    const jobsPage = await listMyJobs({ limit: 100, page, status: "ACTIVE" });
    const freshIds = Array.from(new Set(jobsPage.jobs.map((job) => job.id))).filter((id) => !seen.has(id));
    freshIds.forEach((id) => seen.add(id));
    jobIds.push(...freshIds);
    hasNextPage = jobsPage.pagination.hasNextPage;
    if (hasNextPage && freshIds.length === 0) {
      throw new ApiError("The complete application count could not be verified. Please try again.", 502);
    }
    page += 1;
  }

  let total = 0;
  const batchSize = 10;

  for (let index = 0; index < jobIds.length; index += batchSize) {
    checkBudget();
    const applicationPages = await Promise.all(
      jobIds.slice(index, index + batchSize).map((jobId) => listApplicationsByJob(jobId, { limit: 1, page: 1 })),
    );
    total += applicationPages.reduce((sum, applications) => sum + applications.pagination.total, 0);
  }

  return { total };
}

function toJobApplication(application: (typeof seedApplications)[number]): JobApplication {
  const teacher = seedTeachers.find((item) => item.id === application.teacherId);

  return {
    coverLetter: application.coverLetter,
    agreedTerms: null,
    termsStatus: "LEGACY_UNVERIFIED",
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
