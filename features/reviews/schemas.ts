import type { ProfileReview, ProfileReviews } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readDateIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readReviewItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.reviews)) return payload.reviews;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function readAverage(payload: unknown, reviews: ProfileReview[]) {
  if (isRecord(payload)) {
    const explicit = readNumber(payload.averageRating) ?? readNumber(payload.ratingAverage) ?? readNumber(payload.average);
    if (explicit !== null) return explicit;
  }

  if (!reviews.length) return null;
  return Math.round((reviews.reduce((total, review) => total + review.rating, 0) / reviews.length) * 10) / 10;
}

function readTotal(payload: unknown, reviews: ProfileReview[]) {
  if (!isRecord(payload)) return reviews.length;
  return readNumber(payload.total) ?? readNumber(payload.count) ?? reviews.length;
}

function readNestedName(record: Record<string, unknown>, key: string) {
  const nested = record[key];
  if (!isRecord(nested)) return null;
  return readString(nested.name) ?? readString(nested.fullName);
}

function readNestedTitle(record: Record<string, unknown>, key: string) {
  const nested = record[key];
  if (!isRecord(nested)) return null;
  return readString(nested.title);
}

function normalizeReview(value: unknown): ProfileReview {
  const record = isRecord(value) ? value : {};
  const rating = readNumber(record.rating) ?? 0;

  return {
    bookingId: readString(record.bookingId),
    comment: readString(record.comment),
    createdAt: readDateIso(record.createdAt),
    id: readString(record.id) ?? readString(record.bookingId) ?? readString(record.createdAt) ?? "review",
    jobTitle: readString(record.jobTitle) ?? readNestedTitle(record, "job"),
    rating: Math.min(5, Math.max(0, rating)),
    reviewerName:
      readString(record.reviewerName) ??
      readString(record.institutionName) ??
      readString(record.schoolName) ??
      readNestedName(record, "reviewer") ??
      readNestedName(record, "institution"),
    reviewerType: readString(record.reviewerType),
    updatedAt: readDateIso(record.updatedAt),
  };
}

export function normalizeProfileReviews(payload: unknown): ProfileReviews {
  const reviews = readReviewItems(payload).map(normalizeReview);

  return {
    averageRating: readAverage(payload, reviews),
    reviews,
    total: readTotal(payload, reviews),
  };
}
