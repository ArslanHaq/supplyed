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
    description: input.description.trim(),
    endDate: input.endDate?.trim() || undefined,
    expiresAt: input.expiresAt?.trim() || undefined,
    keyStages: normalizeStringList(input.keyStages),
    location: input.location?.trim() || undefined,
    parkingInfo: input.parkingInfo?.trim() || undefined,
    payAmount: normalizePositiveNumber(input.payAmount),
    startDate: input.startDate?.trim() || undefined,
    subject: input.subject?.trim() || undefined,
    title: input.title.trim(),
  };
}

export function normalizeJobUpdateInput(input: JobUpdateInput): JobUpdateInput {
  const normalizedCreate = normalizeJobCreateInput({
    description: input.description ?? "",
    endDate: input.endDate,
    expiresAt: input.expiresAt,
    keyStages: input.keyStages ?? [],
    location: input.location,
    parkingInfo: input.parkingInfo,
    payAmount: input.payAmount,
    payType: input.payType,
    startDate: input.startDate,
    subject: input.subject,
    title: input.title ?? "",
  });

  return {
    ...withoutEmptyJobFields(normalizedCreate),
    id: input.id.trim(),
    status: input.status,
  };
}

export function normalizeBackendJob(job: BackendJobResponse): Job {
  const payAmount = normalizePositiveNumber(readNumber(job.payAmount)) ?? 0;
  const createdAt = readDateIso(job.createdAt);
  const startDate = readDateIso(job.startDate);
  const endDate = readDateIso(job.endDate);
  const expiresAt = readDateIso(job.expiresAt);
  const keyStages = normalizeStringList(job.keyStages ?? []);
  const subject = job.subject?.trim() || "General cover";
  const location = job.location?.trim() || "Location TBC";

  return {
    id: job.id,
    applicants: 0,
    city: location,
    createdAt,
    date: formatDateRange(startDate, endDate),
    description: job.description,
    endDate,
    expiresAt,
    keyStage: keyStages[0] ?? "All stages",
    keyStages,
    location,
    matchScore: deriveMatchScore(job.id),
    mode: derivePostingMode(startDate, endDate),
    parkingInfo: job.parkingInfo ?? null,
    payAmount,
    payType: job.payType ?? null,
    postedAt: formatRelativeTime(createdAt),
    postedByUserId: job.postedByUserId,
    rate: payAmount,
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
      ? `${job.title} ${job.school} ${job.location ?? ""} ${job.subject}`.toLowerCase().includes(normalized.search.toLowerCase())
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

function isUrgent(expiresAt: string | null) {
  if (!expiresAt) return false;
  const msUntilExpiry = new Date(expiresAt).getTime() - Date.now();
  return msUntilExpiry > 0 && msUntilExpiry <= 2 * MS_PER_DAY;
}

function deriveMatchScore(id: string) {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return 76 + (sum % 20);
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
