export type FoundingSignupType = "school" | "teacher";
export type FoundingSignupRole = "institution" | "teacher";

export type FoundingSignupIntent = {
  availability?: string;
  bio?: string;
  coverTypes?: string[];
  createdAt: number;
  dailyRate?: string;
  email: string;
  hourlyRate?: string;
  institutionAddress?: string;
  institutionCity?: string;
  institutionDomain?: string;
  keyStages?: string[];
  localAuthority?: string;
  maxTravelDistance?: string;
  name?: string;
  organizationName?: string;
  phase?: string;
  phone?: string;
  postcode?: string;
  role?: string;
  schoolType?: string;
  skills?: string[];
  staffingNeeds?: string;
  subjects?: string[];
  tier?: string;
  typicalPupilCount?: string;
  type: FoundingSignupType;
  yearsExperience?: string;
};

const storageKey = "supplyed_founding_signup_intent";
const maxIntentAgeMs = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readFoundingSignupEmail(value: unknown) {
  const email = readString(value)?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function readStringArray(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  const strings = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return strings.length > 0 ? strings : undefined;
}

function readFormString(data: FormData, key: string) {
  return readString(data.get(key));
}

function readFormStringArray(data: FormData, key: string) {
  return readStringArray(data.getAll(key));
}

function readDigits(value: unknown) {
  const digits = readString(value)?.replace(/\D/g, "");
  return digits || undefined;
}

function readDecimal(value: unknown) {
  const numeric = readString(value)?.replace(/[^\d.]/g, "");
  return numeric || undefined;
}

function normalizeDomain(value: unknown) {
  return readString(value)?.replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase();
}

export function readFoundingSignupType(value: unknown): FoundingSignupType | undefined {
  if (value === "school" || value === "SCHOOL") return "school";
  if (value === "teacher" || value === "TEACHER") return "teacher";
  return undefined;
}

export function foundingSignupRole(type: FoundingSignupType): FoundingSignupRole {
  return type === "teacher" ? "teacher" : "institution";
}

export function foundingSignupHref(type: FoundingSignupType, email?: string) {
  const params = new URLSearchParams({ source: "founding", type });
  const signupEmail = readFoundingSignupEmail(email);

  if (signupEmail) {
    params.set("email", signupEmail);
  }

  return `/signup?${params.toString()}`;
}

export function saveFoundingSignupIntent(intent: Omit<FoundingSignupIntent, "createdAt"> & { createdAt?: number }) {
  const type = readFoundingSignupType(intent.type);
  const email = readFoundingSignupEmail(intent.email);

  if (!type || !email || typeof window === "undefined") return undefined;

  const normalizedIntent: FoundingSignupIntent = {
    availability: readString(intent.availability),
    bio: readString(intent.bio),
    coverTypes: readStringArray(intent.coverTypes),
    createdAt: intent.createdAt ?? Date.now(),
    dailyRate: readDecimal(intent.dailyRate),
    email,
    hourlyRate: readDecimal(intent.hourlyRate),
    institutionAddress: readString(intent.institutionAddress),
    institutionCity: readString(intent.institutionCity),
    institutionDomain: normalizeDomain(intent.institutionDomain),
    keyStages: readStringArray(intent.keyStages),
    localAuthority: readString(intent.localAuthority),
    maxTravelDistance: readDecimal(intent.maxTravelDistance),
    name: readString(intent.name),
    organizationName: readString(intent.organizationName),
    phase: readString(intent.phase),
    phone: readString(intent.phone),
    postcode: readString(intent.postcode)?.toUpperCase(),
    role: readString(intent.role),
    schoolType: readString(intent.schoolType),
    skills: readStringArray(intent.skills),
    staffingNeeds: readString(intent.staffingNeeds),
    subjects: readStringArray(intent.subjects),
    tier: readString(intent.tier),
    typicalPupilCount: readDigits(intent.typicalPupilCount),
    type,
    yearsExperience: readDigits(intent.yearsExperience),
  };

  window.sessionStorage.setItem(storageKey, JSON.stringify(normalizedIntent));
  return normalizedIntent;
}

export function saveFoundingSignupIntentFromForm(form: HTMLFormElement, rawType: unknown) {
  const data = new FormData(form);
  const type = readFoundingSignupType(rawType);
  const email = readFoundingSignupEmail(readFormString(data, "email"));
  const coverTypes = readFormStringArray(data, "coverTypes");
  const subjects = readFormStringArray(data, "subjects");
  const keyStages = readFormStringArray(data, "keyStages");
  const skills = readFormStringArray(data, "skills");

  if (!type || !email) return undefined;

  return saveFoundingSignupIntent({
    availability: readFormString(data, "availability"),
    bio: readFormString(data, "bio"),
    coverTypes,
    dailyRate: readFormString(data, "dailyRate"),
    email: email.toLowerCase(),
    hourlyRate: readFormString(data, "hourlyRate"),
    institutionAddress: readFormString(data, "institutionAddress"),
    institutionCity: readFormString(data, "institutionCity"),
    institutionDomain: readFormString(data, "institutionDomain"),
    keyStages,
    localAuthority: readFormString(data, "localAuthority"),
    maxTravelDistance: readFormString(data, "maxTravelDistance"),
    name: readFormString(data, "name"),
    organizationName: readFormString(data, "organizationName"),
    phase: readFormString(data, "phase"),
    phone: readFormString(data, "phone"),
    postcode: readFormString(data, "postcode"),
    role: readFormString(data, "role"),
    schoolType: readFormString(data, "schoolType"),
    skills,
    staffingNeeds: readFormString(data, "staffingNeeds") ?? coverTypes?.join(", "),
    subjects,
    tier: readFormString(data, "tier"),
    typicalPupilCount: readFormString(data, "typicalPupilCount"),
    type,
    yearsExperience: readFormString(data, "yearsExperience"),
  });
}

export function readFoundingSignupIntent(expectedType?: FoundingSignupType) {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) || "null") as unknown;
    if (!isRecord(parsed)) return null;

    const type = readFoundingSignupType(parsed.type);
    const email = readString(parsed.email);
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    const expired = !createdAt || Date.now() - createdAt > maxIntentAgeMs;

    if (!type || !email || expired || (expectedType && type !== expectedType)) {
      if (expired) clearFoundingSignupIntent();
      return null;
    }

    return {
      availability: readString(parsed.availability),
      bio: readString(parsed.bio),
      coverTypes: readStringArray(parsed.coverTypes),
      createdAt,
      dailyRate: readDecimal(parsed.dailyRate),
      email: email.toLowerCase(),
      hourlyRate: readDecimal(parsed.hourlyRate),
      institutionAddress: readString(parsed.institutionAddress),
      institutionCity: readString(parsed.institutionCity),
      institutionDomain: normalizeDomain(parsed.institutionDomain),
      keyStages: readStringArray(parsed.keyStages),
      localAuthority: readString(parsed.localAuthority),
      maxTravelDistance: readDecimal(parsed.maxTravelDistance),
      name: readString(parsed.name),
      organizationName: readString(parsed.organizationName),
      phase: readString(parsed.phase),
      phone: readString(parsed.phone),
      postcode: readString(parsed.postcode),
      role: readString(parsed.role),
      schoolType: readString(parsed.schoolType),
      skills: readStringArray(parsed.skills),
      staffingNeeds: readString(parsed.staffingNeeds),
      subjects: readStringArray(parsed.subjects),
      tier: readString(parsed.tier),
      typicalPupilCount: readDigits(parsed.typicalPupilCount),
      type,
      yearsExperience: readDigits(parsed.yearsExperience),
    } satisfies FoundingSignupIntent;
  } catch {
    clearFoundingSignupIntent();
    return null;
  }
}

export function clearFoundingSignupIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey);
}
