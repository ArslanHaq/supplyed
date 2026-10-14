import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeProfileReviews } from "./schemas";
import type { ProfileReviews } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function emptyReviews(): ProfileReviews {
  return {
    averageRating: null,
    reviews: [],
    total: 0,
  };
}

export async function listInstructorReviews(instructorId: string): Promise<ProfileReviews> {
  if (!backendEnabled()) return emptyReviews();

  const payload = await api.get<unknown>(`/reviews/instructor/${encodeURIComponent(instructorId)}`, {
    cache: "no-store",
    next: { tags: ["reviews"] },
  });

  return normalizeProfileReviews(payload);
}

export async function listInstitutionReviews(institutionId: string): Promise<ProfileReviews> {
  if (!backendEnabled()) return emptyReviews();

  const payload = await api.get<unknown>(`/reviews/institution/${encodeURIComponent(institutionId)}`, {
    cache: "no-store",
    next: { tags: ["reviews"] },
  });

  return normalizeProfileReviews(payload);
}
