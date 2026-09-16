import type { Job, JobCreateInput, JobListFilters, JobUpdateInput, BackendJobResponse } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeJobFilters(filters: JobListFilters = {}): JobListFilters {
  return {
    keyStage: filters.keyStage?.trim() || undefined,
    mode: filters.mode,
    search: filters.search?.trim() || undefined,
    status: filters.status,
    subject: filters.subject?.trim() || undefined,
    urgent: filters.urgent,
  };
}

export function normalizeJobCreateInput(input: JobCreateInput): JobCreateInput {
  return {
    ...input,
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    countryCode: input.countryCode?.trim().toUpperCase() || "GB",
    county: input.county?.trim() || undefined,
    description: input.description.trim(),
    documentRequirementIds: normalizeStringList(input.documentRequirementIds ?? []),
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
    applicants: 0,
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

export function applyJobFilters(jobs: Job[], filters: JobListFilters = {}) {
  const normalized = normalizeJobFilters(filters);

  return jobs.filter((job) => {
    const matchesSearch = normalized.search
      ? `${job.title} ${job.school} ${job.city} ${job.county ?? ""} ${job.postalCode ?? ""} ${job.subject} ${job.requiredSkills.join(" ")}`.toLowerCase().includes(normalized.search.toLowerCase())
      : true;
    const matchesSubject = normalized.subject ? job.subject === normalized.subject : true;
    const matchesKeyStage = normalized.keyStage ? job.keyStages?.includes(normalized.keyStage) || job.keyStage === normalized.keyStage : true;
    const matchesMode = normalized.mode ? job.mode === normalized.mode : true;
    const matchesUrgent = normalized.urgent === undefined ? true : job.urgent === normalized.urgent;
    const matchesStatus = normalized.status ? job.status === normalized.status : true;

    return matchesSearch && matchesSubject && matchesKeyStage && matchesMode && matchesUrgent && matchesStatus;
  });
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
