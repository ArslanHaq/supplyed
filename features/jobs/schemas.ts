import type { JobStatus } from "@/types/supplyed";

import type {
  BackendJobResponse,
  Job,
  JobCreateInput,
  JobListFilters,
  JobsPagination,
  JobStatusCounts,
  JobUpdateInput,
  MyJobs,
  PaginatedJobs,
} from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const JOB_STATUSES: JobStatus[] = ["DRAFT", "ACTIVE", "EXPIRED", "CLOSED"];

export function normalizeJobFilters(filters: JobListFilters = {}): JobListFilters {
  return {
    keyStage: filters.keyStage?.trim() || undefined,
    limit: wholeNumberBetween(filters.limit, 1, 100),
    page: wholeNumberBetween(filters.page, 1, Number.MAX_SAFE_INTEGER),
    search: filters.search?.trim().slice(0, 100) || undefined,
    status: filters.status && JOB_STATUSES.includes(filters.status) ? filters.status : undefined,
    subject: filters.subject?.trim() || undefined,
    urgent: filters.urgent,
  };
}

/** Reads the job-list paging and filters from a request's query string. */
export function readJobFilters(searchParams: URLSearchParams): JobListFilters {
  const urgent = searchParams.get("urgent");

  return normalizeJobFilters({
    keyStage: searchParams.get("keyStage") ?? undefined,
    limit: Number(searchParams.get("limit")) || undefined,
    page: Number(searchParams.get("page")) || undefined,
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as JobStatus | null) ?? undefined,
    subject: searchParams.get("subject") ?? undefined,
    urgent: urgent === "true" ? true : urgent === "false" ? false : undefined,
  });
}

export function normalizePaginatedJobs(result: { jobs?: BackendJobResponse[]; pagination?: Partial<JobsPagination> } | null | undefined, filters: JobListFilters = {}): PaginatedJobs {
  const jobs = Array.isArray(result?.jobs) ? result.jobs.map(normalizeBackendJob) : [];
  const limit = result?.pagination?.limit ?? filters.limit ?? 20;
  const total = result?.pagination?.total ?? jobs.length;

  return {
    jobs,
    pagination: {
      hasNextPage: Boolean(result?.pagination?.hasNextPage),
      limit,
      page: result?.pagination?.page ?? filters.page ?? 1,
      total,
      totalPages: result?.pagination?.totalPages ?? Math.ceil(total / limit),
    },
  };
}

export function normalizeMyJobs(result: { jobs?: BackendJobResponse[]; pagination?: Partial<JobsPagination>; statusCounts?: Partial<JobStatusCounts> } | null | undefined, filters: JobListFilters = {}): MyJobs {
  const counts = result?.statusCounts ?? {};

  return {
    ...normalizePaginatedJobs(result, filters),
    statusCounts: {
      ACTIVE: counts.ACTIVE ?? 0,
      ALL: counts.ALL ?? 0,
      CLOSED: counts.CLOSED ?? 0,
      DRAFT: counts.DRAFT ?? 0,
      EXPIRED: counts.EXPIRED ?? 0,
    },
  };
}

function wholeNumberBetween(value: number | undefined, min: number, max: number) {
  return value !== undefined && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

export function normalizeJobCreateInput(input: JobCreateInput): JobCreateInput {
  return {
    ...input,
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    countryCode: input.countryCode?.trim().toUpperCase() || "GB",
    county: input.county?.trim() || undefined,
    description: input.description.trim(),
    endDate: input.endDate?.trim() || undefined,
    expiresAt: input.expiresAt?.trim() || undefined,
    keyStages: normalizeStringList(input.keyStages),
    minExperienceYears: normalizeNonNegativeInteger(input.minExperienceYears),
    parkingInfo: input.parkingInfo?.trim() || undefined,
    payAmount: normalizePositiveNumber(input.payAmount),
    postalCode: input.postalCode?.trim().toUpperCase() || undefined,
    requiredSkills: normalizeStringList(input.requiredSkills ?? []),
    startDate: input.startDate?.trim() || undefined,
    subject: input.subject?.trim() || undefined,
    title: input.title.trim(),
  };
}

export function normalizeJobUpdateInput(input: JobUpdateInput): JobUpdateInput {
  return withoutEmptyJobFields({
    ...input,
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    countryCode: input.countryCode?.trim().toUpperCase() || undefined,
    county: input.county?.trim() || undefined,
    description: input.description?.trim() || undefined,
    endDate: input.endDate?.trim() || undefined,
    expiresAt: input.expiresAt?.trim() || undefined,
    id: input.id.trim(),
    keyStages: input.keyStages ? normalizeStringList(input.keyStages) : undefined,
    minExperienceYears: normalizeNonNegativeInteger(input.minExperienceYears),
    parkingInfo: input.parkingInfo?.trim() || undefined,
    payAmount: normalizePositiveNumber(input.payAmount),
    postalCode: input.postalCode?.trim().toUpperCase() || undefined,
    requiredSkills: input.requiredSkills ? normalizeStringList(input.requiredSkills) : undefined,
    startDate: input.startDate?.trim() || undefined,
    subject: input.subject?.trim() || undefined,
    title: input.title?.trim() || undefined,
  }) as JobUpdateInput;
}

export function normalizeBackendJob(job: BackendJobResponse): Job {
  const payAmount = normalizePositiveNumber(readNumber(job.payAmount)) ?? 0;
  const createdAt = readDateIso(job.createdAt);
  const startDate = readDateIso(job.startDate);
  const endDate = readDateIso(job.endDate);
  const expiresAt = readDateIso(job.expiresAt);
  const keyStages = normalizeStringList(job.keyStages ?? []);
  const requiredSkills = normalizeStringList(job.requiredSkills ?? []);
  const subject = job.subject?.trim() || "General cover";
  const city = job.city?.trim() || job.county?.trim() || job.postalCode?.trim() || "Location TBC";

  return {
    id: job.id,
    address: job.address?.trim() || null,
    city,
    countryCode: job.countryCode?.trim() || "GB",
    county: job.county?.trim() || null,
    createdAt,
    date: formatDateRange(startDate, endDate),
    description: job.description,
    endDate,
    expiresAt,
    keyStage: keyStages[0] ?? "All stages",
    keyStages,
    latitude: readNumber(job.latitude) ?? null,
    longitude: readNumber(job.longitude) ?? null,
    minExperienceYears: normalizeNonNegativeInteger(job.minExperienceYears) ?? null,
    mode:
      readPostingMode(job.mode) ??
      readPostingMode(job.postingMode) ??
      readPostingMode(job.jobType) ??
      readPostingModeFromDescription(job.description) ??
      derivePostingMode(startDate, endDate),
    parkingInfo: job.parkingInfo ?? null,
    payAmount,
    payType: job.payType ?? null,
    postedAt: formatRelativeTime(createdAt),
    postedByUserId: job.postedByUserId,
    postalCode: job.postalCode?.trim() || null,
    rate: payAmount,
    requiredSkills,
    school: "Hiring account",
    startDate,
    status: job.status,
    subject,
    title: job.title,
    updatedAt: readDateIso(job.updatedAt),
    urgent: isUrgent(expiresAt),
  };
}

export function toCreateJobPayload(input: JobCreateInput) {
  const { status: _status, ...payload } = normalizeJobCreateInput(input);
  return withoutEmptyJobFields(payload);
}

export function toUpdateJobPayload(input: JobUpdateInput) {
  const { id: _id, ...payload } = normalizeJobUpdateInput(input);
  return withoutEmptyJobFields(payload);
}

function normalizeStringList(value: string[]) {
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function normalizePositiveNumber(value: unknown) {
  const number = readNumber(value);
  return number === undefined || number < 0 ? undefined : number;
}

function normalizeNonNegativeInteger(value: unknown) {
  const number = readNumber(value);
  return number === undefined || number < 0 || !Number.isInteger(number) ? undefined : number;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readDateIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "Date TBC";
  if (startDate && !endDate) return formatDisplayDate(startDate);
  if (!startDate && endDate) return `Until ${formatDisplayDate(endDate)}`;

  const start = formatDisplayDate(startDate);
  const end = formatDisplayDate(endDate);
  return start === end ? start : `${start} - ${end}`;
}

function formatDisplayDate(value: string | null) {
  if (!value) return "Date TBC";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short" }).format(new Date(value));
}

function formatRelativeTime(value: string | null) {
  if (!value) return "recently";
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "recently";

  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function derivePostingMode(startDate: string | null, endDate: string | null): Job["mode"] {
  if (!startDate || !endDate) return "instant";
  const durationDays = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / MS_PER_DAY);
  return durationDays > 7 ? "brief" : "instant";
}

function readPostingMode(value: unknown): Job["mode"] | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (!normalized) return null;
  if (normalized.includes("brief")) return "brief";
  if (normalized.includes("instant")) return "instant";

  return null;
}

function readPostingModeFromDescription(description: string): Job["mode"] | null {
  const matches = Array.from(description.matchAll(/(?:^|\n)\s*Posting route:\s*(Instant matching|Open brief)\.\s*(?=\n|$)/gi));
  const match = matches.at(-1);
  return readPostingMode(match?.[1]);
}

function isUrgent(expiresAt: string | null) {
  if (!expiresAt) return false;
  const msUntilExpiry = new Date(expiresAt).getTime() - Date.now();
  return msUntilExpiry > 0 && msUntilExpiry <= 2 * MS_PER_DAY;
}

function withoutEmptyJobFields<Input extends Record<string, unknown>>(input: Input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && !value.trim()) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  ) as Partial<Input>;
}
