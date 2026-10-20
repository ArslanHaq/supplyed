import type { ApplicationCreateInput, ApplicationHistoryEntry, JobApplication, JobApplicationsQuery, JobApplicationStatus, PaginatedApplicationHistory, PaginatedApplications } from "./types";

const APPLICATION_STATUSES: JobApplicationStatus[] = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "HIRED",
  "REJECTED",
];

export function normalizeApplicationsQuery(query: JobApplicationsQuery = {}): JobApplicationsQuery {
  return {
    limit: normalizePageSize(query.limit),
    page: normalizePage(query.page),
    status: query.status && APPLICATION_STATUSES.includes(query.status) ? query.status : undefined,
  };
}

export function normalizePaginatedApplications(payload: PaginatedApplications): PaginatedApplications {
  const pagination = payload.pagination ?? { hasNextPage: false, limit: 20, page: 1, total: 0, totalPages: 0 };

  return {
    applications: (payload.applications ?? []).map(normalizeApplication),
    pagination: {
      hasNextPage: Boolean(pagination.hasNextPage),
      limit: pagination.limit,
      page: pagination.page,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  };
}

export function normalizeApplicationHistory(payload: PaginatedApplicationHistory): PaginatedApplicationHistory {
  const pagination = payload.pagination ?? { hasNextPage: false, limit: 20, page: 1, total: 0, totalPages: 0 };
  return {
    history: (payload.history ?? []).map(normalizeHistoryEntry),
    pagination: {
      hasNextPage: Boolean(pagination.hasNextPage), limit: pagination.limit, page: pagination.page,
      total: pagination.total, totalPages: pagination.totalPages,
    },
  };
}

function normalizeHistoryEntry(entry: ApplicationHistoryEntry): ApplicationHistoryEntry {
  return {
    ...entry,
    createdAt: readDateIso(entry.createdAt) ?? entry.createdAt,
    fromStatus: entry.fromStatus === null ? null : normalizeApplicationStatus(entry.fromStatus),
    toStatus: normalizeApplicationStatus(entry.toStatus),
  };
}

export function normalizeApplicationCreateInput(input: ApplicationCreateInput): ApplicationCreateInput {
  const coverLetter = input.coverLetter?.trim();
  return {
    ...(coverLetter ? { coverLetter } : {}),
    jobId: input.jobId.trim(),
  };
}

export function normalizeApplication(application: JobApplication): JobApplication {
  return {
    ...application,
    status: normalizeApplicationStatus(application.status),
    jobName: typeof application.jobName === "string" ? application.jobName.trim() || null : null,
    createdAt: readDateIso(application.createdAt),
    updatedAt: readDateIso(application.updatedAt),
    instructor: application.instructor
      ? {
          ...application.instructor,
          keyStages: normalizeStringList(application.instructor.keyStages),
          skills: normalizeStringList(application.instructor.skills),
          subjects: normalizeStringList(application.instructor.subjects),
        }
      : undefined,
  };
}

export function normalizeApplicationStatus(value: unknown): JobApplicationStatus {
  if (typeof value === "string" && APPLICATION_STATUSES.includes(value as JobApplicationStatus)) return value as JobApplicationStatus;
  throw new Error("The application has an unsupported status.");
}

function normalizePage(value: unknown) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizePageSize(value: unknown) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) return 20;
  return Math.min(limit, 100);
}

function normalizeStringList(value: string[]) {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}

function readDateIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
