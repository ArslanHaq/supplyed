import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeInstitutionPublicProfile, normalizeInstructorPublicProfile } from "./schemas";
import type { InstitutionPublicProfile, InstructorPublicProfile } from "./types";

export async function getInstructorPublicProfile(id: string): Promise<InstructorPublicProfile | null> {
  if (!process.env.API_BASE_URL) return null;
  const profile = await api.get<InstructorPublicProfile>(`/instructors/profile/${encodeURIComponent(id)}`, { cache: "no-store" });
  return normalizeInstructorPublicProfile(profile);
}

export async function getInstitutionPublicProfile(id: string): Promise<InstitutionPublicProfile | null> {
  if (!process.env.API_BASE_URL) return null;
  const profile = await api.get<InstitutionPublicProfile>(`/institutions/profile/${encodeURIComponent(id)}`, { cache: "no-store" });
  return normalizeInstitutionPublicProfile(profile);
}
