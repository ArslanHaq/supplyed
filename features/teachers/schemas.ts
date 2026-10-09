import type {
  TeacherDirectoryFilters,
  TeacherDirectoryItem,
  TeacherDirectoryPage,
  TeacherListFilters,
  TeacherProfileUpdateInput,
} from "./types";

export function normalizeTeacherFilters(filters: TeacherListFilters = {}): TeacherListFilters {
  return {
    keyStage: filters.keyStage?.trim() || undefined,
    search: filters.search?.trim() || undefined,
    subject: filters.subject?.trim() || undefined,
  };
}

export function normalizeTeacherDirectoryFilters(filters: TeacherDirectoryFilters = {}): TeacherDirectoryFilters {
  return {
    availableToday: filters.availableToday,
    city: filters.city?.trim() || undefined,
    dbsVerified: filters.dbsVerified,
    keyStage: filters.keyStage?.trim() || undefined,
    limit: wholeNumber(filters.limit, 20, 1, 100),
    maxDailyRate: nonNegativeNumber(filters.maxDailyRate),
    maxHourlyRate: nonNegativeNumber(filters.maxHourlyRate),
    minExperience: wholeNumber(filters.minExperience, undefined, 0, 100),
    minRating: boundedNumber(filters.minRating, 0, 5),
    page: wholeNumber(filters.page, 1, 1, Number.MAX_SAFE_INTEGER),
    qtsQualified: filters.qtsQualified,
    search: filters.search?.trim().slice(0, 100) || undefined,
    skill: filters.skill?.trim() || undefined,
    subject: filters.subject?.trim() || undefined,
  };
}

export function normalizeTeacherDirectoryPage(value: unknown, filters: TeacherDirectoryFilters = {}): TeacherDirectoryPage {
  const payload = record(value);
  const rawPagination = record(payload.pagination);
  const instructors = Array.isArray(payload.instructors) ? payload.instructors.map(normalizeTeacherDirectoryItem) : [];
  const limit = finiteNumber(rawPagination.limit) ?? filters.limit ?? 20;
  const total = finiteNumber(rawPagination.total) ?? instructors.length;

  return {
    instructors,
    pagination: {
      hasNextPage: Boolean(rawPagination.hasNextPage),
      limit,
      page: finiteNumber(rawPagination.page) ?? filters.page ?? 1,
      total,
      totalPages: finiteNumber(rawPagination.totalPages) ?? Math.ceil(total / Math.max(1, limit)),
    },
  };
}

function normalizeTeacherDirectoryItem(value: unknown): TeacherDirectoryItem {
  const instructor = record(value);
  return {
    availableToday: Boolean(instructor.availableToday),
    bio: textOrNull(instructor.bio),
    city: textOrNull(instructor.city),
    county: textOrNull(instructor.county),
    currency: textOrNull(instructor.currency),
    dailyRate: finiteNumber(instructor.dailyRate),
    dbsVerified: Boolean(instructor.dbsVerified),
    experience: finiteNumber(instructor.experience),
    fullName: textOrNull(instructor.fullName) ?? "Teacher",
    hourlyRate: finiteNumber(instructor.hourlyRate),
    id: textOrNull(instructor.id) ?? "",
    imageUrl: textOrNull(instructor.imageUrl),
    keyStages: stringList(instructor.keyStages),
    memberSince: isoDateOrNull(instructor.memberSince),
    qtsQualified: Boolean(instructor.qtsQualified),
    ratingAverage: finiteNumber(instructor.ratingAverage) ?? 0,
    ratingCount: finiteNumber(instructor.ratingCount) ?? 0,
    skills: stringList(instructor.skills),
    subjects: stringList(instructor.subjects),
  };
}

export function normalizeTeacherProfileUpdate(input: TeacherProfileUpdateInput): TeacherProfileUpdateInput {
  return {
    ...input,
    availability: input.availability?.trim() || undefined,
    city: input.city?.trim() || undefined,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)))
    : [];
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function nonNegativeNumber(value: unknown) {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : undefined;
}

function boundedNumber(value: unknown, min: number, max: number) {
  const number = finiteNumber(value);
  return number !== null && number >= min && number <= max ? number : undefined;
}

function wholeNumber(value: unknown, fallback: number | undefined, min: number, max: number) {
  const number = finiteNumber(value);
  return number !== null && Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function isoDateOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
