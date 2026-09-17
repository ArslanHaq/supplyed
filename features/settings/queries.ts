import "server-only";

import { normalizeRole, normalizeStatus } from "@/features/auth/backend";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import type {
  SettingsInstitutionProfile,
  SettingsInstructorProfile,
  SettingsProfileSnapshot,
  SettingsRecruiterProfile,
  SettingsUserSnapshot,
} from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nestedRecord(payload: unknown, key: string) {
  return isRecord(payload) && isRecord(payload[key]) ? payload[key] : payload;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function numberString(value: unknown) {
  const number = readNumber(value);
  return number === null ? "" : String(number);
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)))
    : [];
}

function readDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string" || !value.trim()) return null;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function emptyUserSnapshot(role: AppRole | null, userId = "", email = ""): SettingsUserSnapshot {
  return {
    createdAt: null,
    email,
    emailVerified: true,
    id: userId,
    lastLogin: null,
    name: email ? email.split("@")[0] : "",
    phone: "",
    phoneVerified: false,
    role,
    twoFactorEnabled: false,
    updatedAt: null,
  };
}

function normalizeUser(payload: unknown, fallbackRole: AppRole | null, fallbackUserId?: string, fallbackEmail?: string): SettingsUserSnapshot {
  const record = nestedRecord(payload, "user");
  const role = normalizeRole(isRecord(record) ? record.role : undefined) ?? fallbackRole;
  const email = readString(isRecord(record) ? record.email : undefined) || fallbackEmail || "";

  return {
    createdAt: readDate(isRecord(record) ? record.createdAt : undefined),
    email,
    emailVerified: readBoolean(isRecord(record) ? record.emailVerified ?? record.isEmailVerified : undefined),
    id: readString(isRecord(record) ? record.id ?? record.userId ?? record.sub : undefined) || fallbackUserId || "",
    lastLogin: readDate(isRecord(record) ? record.lastLogin : undefined),
    name: readString(isRecord(record) ? record.name ?? record.fullName : undefined) || (email ? email.split("@")[0] : ""),
    phone: readString(isRecord(record) ? record.phone : undefined),
    phoneVerified: readBoolean(isRecord(record) ? record.phoneVerified : undefined),
    role,
    twoFactorEnabled: readBoolean(isRecord(record) ? record.twoFactorEnabled : undefined),
    updatedAt: readDate(isRecord(record) ? record.updatedAt : undefined),
  };
}

function normalizeInstructor(payload: unknown): SettingsInstructorProfile | undefined {
  const record = nestedRecord(payload, "instructor");
  if (!isRecord(record) || !readString(record.id)) return undefined;

  return {
    address: readString(record.address),
    bio: readString(record.bio),
    city: readString(record.city),
    countryCode: readString(record.countryCode) || "GB",
    county: readString(record.county),
    createdAt: readDate(record.createdAt),
    currency: readString(record.currency) || "GBP",
    dailyRate: numberString(record.dailyRate),
    dbsVerified: readBoolean(record.dbsVerified),
    experience: numberString(record.experience),
    fullName: readString(record.fullName),
    hourlyRate: numberString(record.hourlyRate),
    id: readString(record.id),
    imageUrl: readString(record.imageUrl),
    keyStages: readStringArray(record.keyStages),
    maxTravelDistance: numberString(record.maxTravelDistance),
    postalCode: readString(record.postalCode),
    ratingAverage: readNumber(record.ratingAverage),
    ratingCount: readNumber(record.ratingCount) ?? 0,
    skills: readStringArray(record.skills),
    status: normalizeStatus(record.status),
    subjects: readStringArray(record.subjects),
    updatedAt: readDate(record.updatedAt),
    userId: readNullableString(record.userId),
  };
}

function normalizeInstitution(payload: unknown): SettingsInstitutionProfile | undefined {
  const record = nestedRecord(payload, "institution");
  if (!isRecord(record) || !readString(record.id)) return undefined;

  return {
    address: readString(record.address),
    city: readString(record.city),
    complianceContact: readString(record.complianceContact),
    complianceEmail: readString(record.complianceEmail),
    countryCode: readString(record.countryCode) || "GB",
    county: readString(record.county),
    coverTypes: readStringArray(record.coverTypes),
    createdAt: readDate(record.createdAt),
    domain: readString(record.domain),
    id: readString(record.id),
    imageUrl: readString(record.imageUrl),
    name: readString(record.name),
    postalCode: readString(record.postalCode),
    registrationId: readString(record.registrationId),
    safeguardingConfirmed: readBoolean(record.safeguardingConfirmed),
    staffingNeeds: readString(record.staffingNeeds),
    status: normalizeStatus(record.status),
    typicalPupilCount: numberString(record.typicalPupilCount),
    updatedAt: readDate(record.updatedAt),
    userId: readNullableString(record.userId),
    userRole: readString(record.userRole),
    verified: readBoolean(record.verified),
  };
}

function normalizeRecruiter(payload: unknown): SettingsRecruiterProfile | undefined {
  const record = nestedRecord(payload, "recruiter");
  if (!isRecord(record) || !readString(record.id)) return undefined;

  const status = normalizeStatus(record.status);

  return {
    address: readString(record.address),
    bio: readString(record.bio),
    city: readString(record.city),
    countryCode: readString(record.countryCode) || "GB",
    county: readString(record.county),
    createdAt: readDate(record.createdAt),
    displayName: readString(record.displayName),
    id: readString(record.id),
    imageUrl: readString(record.imageUrl),
    postalCode: readString(record.postalCode),
    status: status === "none" ? "approved" : status,
    updatedAt: readDate(record.updatedAt),
    userId: readNullableString(record.userId),
  };
}

type BackendProfileImageResponse = {
  expiresAt?: string | Date | null;
  imageUrl?: string | null;
};

async function getSignedProfileImageUrl(role: AppRole | null) {
  if (!role) return undefined;

  const response = await optionalApiGet<BackendProfileImageResponse>("/users/me/profile-image", { cache: "no-store" });
  if (response === undefined) return undefined;

  return readString(response.imageUrl);
}

function applySignedProfileImageUrl(
  role: AppRole | null,
  profile: {
    institution?: SettingsInstitutionProfile;
    instructor?: SettingsInstructorProfile;
    recruiter?: SettingsRecruiterProfile;
  },
  imageUrl: string | undefined,
) {
  if (imageUrl === undefined) return;

  if (role === "teacher" && profile.instructor) {
    profile.instructor = { ...profile.instructor, imageUrl };
  }

  if (role === "institution" && profile.institution) {
    profile.institution = { ...profile.institution, imageUrl };
  }

  if (role === "individual" && profile.recruiter) {
    profile.recruiter = { ...profile.recruiter, imageUrl };
  }
}

async function optionalApiGet<Data>(path: string, options: Parameters<typeof api.get<Data>>[1] = {}) {
  try {
    return await api.get<Data>(path, options);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return undefined;
    throw error;
  }
}

function applicationStatusForRole(
  role: AppRole | null,
  profile: {
    institution?: SettingsInstitutionProfile;
    instructor?: SettingsInstructorProfile;
    recruiter?: SettingsRecruiterProfile;
  },
): ApplicationStatus {
  if (role === "teacher") return profile.instructor?.status ?? "none";
  if (role === "institution") return profile.institution?.status ?? "none";
  if (role === "individual") return profile.recruiter?.status ?? "none";
  return "none";
}

export async function getSettingsProfileSnapshot(): Promise<SettingsProfileSnapshot> {
  const authContext = await getServerAuthContext();
  const fallbackRole = normalizeRole(authContext?.role);

  if (!backendEnabled()) {
    const { auth } = await import("@/auth");
    const session = await auth();
    const role = normalizeRole(session?.user.role) ?? fallbackRole;

    return {
      applicationStatus: session?.user.applicationStatus ?? "none",
      role,
      user: {
        ...emptyUserSnapshot(role, session?.user.id ?? authContext?.userId ?? "", session?.user.email ?? authContext?.email ?? ""),
        name: session?.user.name ?? authContext?.email?.split("@")[0] ?? "",
      },
    };
  }

  if (!authContext?.userId) {
    throw new ApiError("Your session expired. Sign in again to continue.", 401, {
      code: "SESSION_EXPIRED",
      message: "Your session expired. Sign in again to continue.",
    }, "SESSION_EXPIRED");
  }

  const user = normalizeUser(
    await api.get<unknown>("/auth/me", { cache: "no-store" }),
    fallbackRole,
    authContext.userId,
    authContext.email ?? undefined,
  );
  const role = user.role ?? fallbackRole;
  const profile: {
    institution?: SettingsInstitutionProfile;
    instructor?: SettingsInstructorProfile;
    recruiter?: SettingsRecruiterProfile;
  } = {};

  if (role === "teacher") {
    const instructor =
      (await optionalApiGet<unknown>("/instructors/me", {
        next: { tags: ["settings", "instructors:me"] },
      })) ??
      (authContext.instructorProfileId
        ? await optionalApiGet<unknown>(`/instructors/${authContext.instructorProfileId}`, {
            next: { tags: ["settings", `instructor:${authContext.instructorProfileId}`] },
          })
        : undefined);
    profile.instructor = normalizeInstructor(instructor);
  }

  if (role === "institution") {
    profile.institution = normalizeInstitution(
      await optionalApiGet<unknown>("/institutions/me", {
        next: { tags: ["settings", "institutions:me"] },
      }),
    );
  }

  if (role === "individual") {
    profile.recruiter = normalizeRecruiter(
      await optionalApiGet<unknown>("/recruiters/me", {
        next: { tags: ["settings", "recruiters:me"] },
      }),
    );
  }

  applySignedProfileImageUrl(role, profile, await getSignedProfileImageUrl(role));

  return {
    applicationStatus: applicationStatusForRole(role, profile),
    ...profile,
    role,
    user: {
      ...user,
      role,
    },
  };
}
