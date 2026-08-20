import "server-only";

import { revalidateTag } from "next/cache";

import { seedApplications, seedTeachers } from "@/data/supplyed";
import { api } from "@/lib/server/api-client";

import { normalizeApplicationsQuery, normalizePaginatedApplications } from "./schemas";
import type {
  CreateApplicationInput,
  JobApplication,
  JobApplicationsQuery,
  PaginatedApplications,
  UpdateApplicationStatusInput,
} from "./types";

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

export async function listMyApplications(query: JobApplicationsQuery = {}): Promise<PaginatedApplications> {
  const normalized = normalizeApplicationsQuery(query);

  if (backendEnabled()) {
    const result = await api.get<PaginatedApplications>("/applications/me", {
      next: { tags: ["applications", "applications:me"] },
      query: normalized,
    });

    return normalizePaginatedApplications(result);
  }

  return {
    applications: [],
    pagination: {
      hasNextPage: false,
      limit: normalized.limit ?? 20,
      page: normalized.page ?? 1,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function createApplication(input: CreateApplicationInput): Promise<JobApplication> {
  const payload = normalizeCreateApplicationInput(input);

  if (backendEnabled()) {
    const application = await api.post<JobApplication>("/applications", payload);

    revalidateTag("applications", "max");
    revalidateTag("applications:me", "max");
    revalidateTag(`applications:job:${payload.jobId}`, "max");

    return normalizePaginatedApplications({
      applications: [application],
      pagination: {
        hasNextPage: false,
        limit: 1,
        page: 1,
        total: 1,
        totalPages: 1,
      },
    }).applications[0];
  }

  return {
    coverLetter: payload.coverLetter,
    createdAt: new Date().toISOString(),
    id: `local-application-${Date.now()}`,
    instructorId: "local-instructor",
    jobId: payload.jobId,
    status: "APPLIED",
    updatedAt: new Date().toISOString(),
  };
}

export async function updateApplicationStatus(input: UpdateApplicationStatusInput): Promise<JobApplication> {
  const id = input.id.trim();
  if (!id) throw new Error("Choose a valid application.");

  if (backendEnabled()) {
    const application = await api.patch<JobApplication>(`/applications/${id}/status`, { status: input.status });

    revalidateTag("applications", "max");
    revalidateTag("applications:me", "max");
    revalidateTag(`applications:job:${application.jobId}`, "max");

    return normalizePaginatedApplications({
      applications: [application],
      pagination: {
        hasNextPage: false,
        limit: 1,
        page: 1,
        total: 1,
        totalPages: 1,
      },
    }).applications[0];
  }

  return {
    coverLetter: null,
    createdAt: new Date().toISOString(),
    id,
    instructorId: "local-instructor",
    jobId: "local-job",
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCreateApplicationInput(input: CreateApplicationInput) {
  const jobId = input.jobId.trim();
  const coverLetter = input.coverLetter.trim();

  if (!jobId) throw new Error("Choose a valid job before applying.");
  if (coverLetter.length > 2000) throw new Error("Cover letter must be 2,000 characters or less.");

  return {
    coverLetter: coverLetter || undefined,
    jobId,
  };
}
