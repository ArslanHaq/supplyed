import type { InstitutionPublicProfile, InstructorPublicProfile } from "./types";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function normalizeInstructorPublicProfile(profile: InstructorPublicProfile): InstructorPublicProfile {
  return {
    bio: profile.bio ?? null,
    city: profile.city ?? null,
    county: profile.county ?? null,
    currency: profile.currency ?? null,
    dailyRate: numberOrNull(profile.dailyRate),
    dbsVerified: Boolean(profile.dbsVerified),
    experience: numberOrNull(profile.experience),
    fullName: profile.fullName || "Teacher",
    hourlyRate: numberOrNull(profile.hourlyRate),
    id: profile.id ?? "",
    imageUrl: profile.imageUrl ?? null,
    keyStages: strings(profile.keyStages),
    memberSince: dateOrNull(profile.memberSince),
    ratingAverage: numberOrNull(profile.ratingAverage) ?? 0,
    ratingCount: numberOrNull(profile.ratingCount) ?? 0,
    skills: strings(profile.skills),
    subjects: strings(profile.subjects),
  };
}

export function normalizeInstitutionPublicProfile(profile: InstitutionPublicProfile): InstitutionPublicProfile {
  return {
    address: profile.address ?? "",
    city: profile.city ?? "",
    county: profile.county ?? null,
    coverTypes: strings(profile.coverTypes),
    id: profile.id ?? "",
    imageUrl: profile.imageUrl ?? null,
    institutionType: profile.institutionType === "MAT_SCHOOL" ? "MAT_SCHOOL" : "SINGLE_SCHOOL",
    memberSince: dateOrNull(profile.memberSince),
    name: profile.name || "School",
    postalCode: profile.postalCode ?? null,
    staffingNeeds: profile.staffingNeeds ?? null,
    trust: profile.trust?.name ? { name: profile.trust.name } : null,
    typicalPupilCount: numberOrNull(profile.typicalPupilCount),
    verified: Boolean(profile.verified),
  };
}
