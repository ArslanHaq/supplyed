import { normalizeWorkUnits } from "@/features/jobs/work-units";
import { cleanOtherSubjects, jobSubjects } from "@/features/teaching-catalogue/selection";
import { validateUkCity, validateUkCountry, validateUkPostcode, validateUkRegion } from "@/lib/uk-validation";
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

export const jobStatuses = ["DRAFT", "ACTIVE", "RESERVED", "EXPIRED", "FILLED", "CLOSED", "SUSPENDED"] as const satisfies readonly JobStatus[];

export function normalizeJobFilters(filters: JobListFilters = {}): JobListFilters {
  return {
    keyStage: filters.keyStage?.trim() || undefined,
    limit: wholeNumberBetween(filters.limit, 1, 100),
    page: wholeNumberBetween(filters.page, 1, Number.MAX_SAFE_INTEGER),
    search: filters.search?.trim().slice(0, 100) || undefined,
    status: filters.status && jobStatuses.includes(filters.status) ? filters.status : undefined,
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
      RESERVED: counts.RESERVED ?? 0,
      ALL: counts.ALL ?? 0,
      CLOSED: counts.CLOSED ?? 0,
      DRAFT: counts.DRAFT ?? 0,
      EXPIRED: counts.EXPIRED ?? 0,
      FILLED: counts.FILLED ?? 0,
      SUSPENDED: counts.SUSPENDED ?? 0,
    },
  };
}

function wholeNumberBetween(value: number | undefined, min: number, max: number) {
  return value !== undefined && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

export function normalizeJobCreateInput(input: JobCreateInput): JobCreateInput {
  return {
    ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== "subject")),
    address: input.address?.trim() || undefined,
    city: validateUkCity(input.city).value || undefined,
    countryCode: validateUkCountry(input.countryCode).value || "GB",
    county: validateUkRegion(input.county).value || undefined,
    description: input.description.trim(),
    endDate: input.endDate?.trim() || undefined,
    expiresAt: input.expiresAt?.trim() || undefined,
    liveFrom: input.liveFrom?.trim() || undefined,
    keyStages: normalizeStringList(input.keyStages ?? []),
    minExperienceYears: normalizeNonNegativeInteger(input.minExperienceYears),
    parkingInfo: input.parkingInfo?.trim() || undefined,
    payAmount: normalizePositiveNumber(input.payAmount),
    postalCode: validateUkPostcode(input.postalCode).value || undefined,
    requiredSkills: normalizeStringList(input.requiredSkills ?? []),
    startDate: input.startDate?.trim() || undefined,
    otherSubjects: input.otherSubjects === undefined ? undefined : cleanOtherSubjects(input.otherSubjects),
    otherSkills: input.otherSkills === undefined ? undefined : cleanOtherSubjects(input.otherSkills),
    subjects: input.subjects === undefined ? undefined : normalizeStringList(input.subjects),
    title: input.title.trim(),
  };
}

export function normalizeJobUpdateInput(input: JobUpdateInput): JobUpdateInput {
  const normalized = withoutEmptyJobFields({
    ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== "subject")),
    address: input.address?.trim() || undefined,
    city: validateUkCity(input.city).value || undefined,
    countryCode: validateUkCountry(input.countryCode).value || undefined,
    county: validateUkRegion(input.county).value || undefined,
    description: input.description?.trim() || undefined,
    endDate: input.endDate?.trim() || undefined,
    expiresAt: input.expiresAt?.trim() || undefined,
    id: input.id.trim(),
    liveFrom: input.liveFrom === null ? null : input.liveFrom?.trim() || undefined,
    keyStages: input.keyStages ? normalizeStringList(input.keyStages) : undefined,
    minExperienceYears: normalizeNonNegativeInteger(input.minExperienceYears),
    parkingInfo: input.parkingInfo?.trim() || undefined,
    payAmount: normalizePositiveNumber(input.payAmount),
    postalCode: validateUkPostcode(input.postalCode).value || undefined,
    requiredSkills: input.requiredSkills ? normalizeStringList(input.requiredSkills) : undefined,
    startDate: input.startDate?.trim() || undefined,
    otherSubjects: input.otherSubjects === undefined ? undefined : cleanOtherSubjects(input.otherSubjects),
    otherSkills: input.otherSkills === undefined ? undefined : cleanOtherSubjects(input.otherSkills),
    subjects: input.subjects === undefined ? undefined : normalizeStringList(input.subjects),
    title: input.title?.trim() || undefined,
  }) as JobUpdateInput;
  return input.liveFrom === null ? { ...normalized, liveFrom: null } : normalized;
}

export function normalizeBackendJob(job: BackendJobResponse): Job {
  const payAmount = normalizePositiveNumber(readNumber(job.payAmount)) ?? 0;
  const createdAt = readDateIso(job.createdAt);
  const startDate = readDateIso(job.startDate);
  const endDate = readDateIso(job.endDate);
  const expiresAt = readDateIso(job.expiresAt);
  const liveFrom = readDateIso(job.liveFrom);
  const keyStages = normalizeStringList(job.keyStages ?? []);
  const requiredSkills = normalizeStringList(job.requiredSkills ?? []);
  const subjects = jobSubjects(job);
  const subject = subjects.join(", ") || "General cover";
  const city = job.city?.trim() || "Location TBC";

  return {
    id: job.id,
    canDelete: job.canDelete === true,
    termsLocked: job.termsLocked !== false,
    hasBeenPublished: job.hasBeenPublished === true,
    address: job.address?.trim() || null,
    city,
    countryCode: job.countryCode?.trim() || "GB",
    county: job.county?.trim() || null,
    createdAt,
    date: formatDateRange(startDate, endDate),
    description: job.description,
    endDate,
    expiresAt,
    liveFrom,
    keyStage: keyStages[0] ?? "All stages",
    keyStages,
    institution: job.institution?.id
      ? {
          id: job.institution.id,
          imageUrl: job.institution.imageUrl ?? null,
          name: job.institution.name || "Hiring school",
        }
      : null,
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
    ...normalizeWorkUnits(job),
    payAmount,
    payType: job.payType ?? null,
    postedAt: formatRelativeTime(createdAt),
    postedByUserId: job.postedByUserId,
    postalCode: job.postalCode?.trim() || null,
    rate: payAmount,
    requiredSkills,
    school: job.institution?.name || "Hiring account",
    startDate,
    status: job.status,
    subject,
    subjects,
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
  const normalized = withoutEmptyJobFields(payload);
  if (input.liveFrom === null) return { ...normalized, liveFrom: null };
  return normalized;
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
    Object.entries(input).filter(([key, value]) => {
      if (value === null && (key === "hours" || key === "days")) return true;
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && !value.trim()) return false;

      return true;
    }),
  ) as Partial<Input>;
}
