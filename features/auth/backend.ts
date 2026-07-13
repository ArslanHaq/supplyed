import "server-only";

import { api } from "@/lib/server/api-client";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import type {
  AuthUser,
  BackendAuthResponse,
  EmailVerificationInput,
  ForgotPasswordInput,
  LoginInput,
  OAuthBackendInput,
  ResendEmailVerificationInput,
  SignupInput,
} from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function backendOAuthExchangeEnabled() {
  return process.env.AUTH_BACKEND_OAUTH_ENABLED === "true";
}

const backendAuthEndpoints = {
  forgotPassword: "/auth/password/forgot",
  login: "/auth/login",
  oauth: "/auth/oauth",
  refresh: "/auth/refresh",
  register: "/auth/register",
  resendEmailVerification: "/auth/email/otp/resend",
  verifyEmail: "/auth/email/otp/verify",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function redacted(value: string | undefined) {
  if (!value) return undefined;
  return `[redacted:${value.length} chars]`;
}

function safeConsolePayload(payload: Record<string, unknown>) {
  return {
    ...payload,
    code: payload.code ? "[redacted]" : undefined,
    otp: payload.otp ? "[redacted]" : undefined,
    password: redacted(typeof payload.password === "string" ? payload.password : undefined),
    providerAccessToken: payload.providerAccessToken ? "[redacted]" : undefined,
    providerIdToken: payload.providerIdToken ? "[redacted]" : undefined,
    refreshToken: payload.refreshToken ? "[redacted]" : undefined,
  };
}

function logBackendPayload(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[SupplyED backend payload] ${event}\n${JSON.stringify(safeConsolePayload(payload), null, 2)}`);
}

function mockUser(email: string, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    applicationStatus: "none",
    email,
    emailVerified: true,
    id: `mock-${email.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
    role: null,
    ...overrides,
  };
}

function readTokenPair(record: Record<string, unknown>) {
  const tokens = isRecord(record.tokens) ? record.tokens : {};

  return {
    accessToken: readString(record.accessToken) ?? readString(tokens.accessToken),
    refreshToken: readString(record.refreshToken) ?? readString(tokens.refreshToken),
  };
}

function readAccessTokenExpiresAt(record: Record<string, unknown>) {
  const tokens = isRecord(record.tokens) ? record.tokens : {};
  const explicitExpiresAt =
    readNumber(record.accessTokenExpiresAt) ??
    readNumber(record.expiresAt) ??
    readNumber(tokens.accessTokenExpiresAt) ??
    readNumber(tokens.expiresAt);

  if (explicitExpiresAt) return explicitExpiresAt;

  const expiresAtIso = readString(record.accessTokenExpiresAt) ?? readString(record.expiresAt) ?? readString(tokens.expiresAt);
  if (expiresAtIso) {
    const parsed = Date.parse(expiresAtIso);
    if (Number.isFinite(parsed)) return parsed;
  }

  const expiresInSeconds =
    readNumber(record.accessTokenExpiresIn) ?? readNumber(record.expiresIn) ?? readNumber(tokens.accessTokenExpiresIn);

  return expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : undefined;
}

function readUserPayload(payload: unknown) {
  if (!isRecord(payload)) throw new Error("Backend auth response was not an object.");
  if (isRecord(payload.user)) return payload.user;
  return payload;
}

export function normalizeRole(role: unknown): AppRole | null {
  const value = readString(role)?.trim();
  if (!value) return null;

  const normalized = value.replace(/-/g, "_").toUpperCase();

  if (normalized === "INSTITUTION" || normalized === "SCHOOL") return "institution";
  if (normalized === "INSTRUCTOR" || normalized === "TEACHER") return "teacher";
  if (normalized === "INDIVIDUAL" || normalized === "GUARDIAN" || normalized === "PARENT") return "individual";
  if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") return "admin";

  return null;
}

export function normalizeStatus(status: unknown): ApplicationStatus {
  const value = readString(status)?.replace(/-/g, "_").toLowerCase();

  if (!value || value === "none" || value === "not_started") return "none";
  if (value === "pending" || value === "pending_review" || value === "requires_info" || value === "under_review") {
    return "pending_review";
  }
  if (value === "approved" || value === "verified" || value === "active") return "approved";
  if (value === "rejected" || value === "declined") return "rejected";
  if (value === "suspended" || value === "disabled") return "suspended";

  return "none";
}

export function normalizeAuthUser(payload: unknown): AuthUser {
  const user = readUserPayload(payload);
  const email = readString(user.email);
  const id = readString(user.id) ?? readString(user.userId) ?? readString(user.sub);

  if (!id || !email) {
    throw new Error("Backend auth user is missing id or email.");
  }

  return {
    applicationStatus: normalizeStatus(
      user.accountStatus ?? user.applicationStatus ?? user.verificationStatus ?? user.onboardingStatus,
    ),
    email,
    emailVerified: readBoolean(user.emailVerified ?? user.isEmailVerified) ?? false,
    id,
    name: readString(user.name) ?? readString(user.fullName) ?? null,
    role: normalizeRole(user.role),
  };
}

function normalizeAuthResponse(payload: unknown): BackendAuthResponse {
  const response = isRecord(payload) ? payload : {};
  const user = normalizeAuthUser(readUserPayload(response));
  const { accessToken, refreshToken } = readTokenPair(response);

  return {
    accessToken,
    accessTokenExpiresAt: readAccessTokenExpiresAt(response),
    refreshToken,
    user,
  };
}

export async function createEmailAccount(input: SignupInput): Promise<BackendAuthResponse> {
  logBackendPayload(`POST ${backendAuthEndpoints.register}`, {
    email: input.email,
    password: input.password,
  });

  if (backendEnabled()) {
    return normalizeAuthResponse(await api.post<unknown>(backendAuthEndpoints.register, input, { auth: false }));
  }

  return {
    user: mockUser(input.email, {
      emailVerified: false,
    }),
  };
}

export async function loginWithEmail(input: LoginInput): Promise<BackendAuthResponse> {
  logBackendPayload(`POST ${backendAuthEndpoints.login}`, {
    email: input.email,
    password: input.password,
  });

  if (backendEnabled()) {
    return normalizeAuthResponse(await api.post<unknown>(backendAuthEndpoints.login, input, { auth: false }));
  }

  return {
    user: mockUser(input.email),
  };
}

export async function verifyEmail(input: EmailVerificationInput): Promise<BackendAuthResponse> {
  const payload = {
    email: input.email,
    otp: input.code,
  };

  logBackendPayload(`POST ${backendAuthEndpoints.verifyEmail}`, payload);

  if (backendEnabled()) {
    return normalizeAuthResponse(await api.post<unknown>(backendAuthEndpoints.verifyEmail, payload, { auth: false }));
  }

  return {
    user: mockUser(input.email),
  };
}

export async function resendEmailVerification(input: ResendEmailVerificationInput) {
  logBackendPayload(`POST ${backendAuthEndpoints.resendEmailVerification}`, {
    email: input.email,
  });

  if (backendEnabled()) {
    await api.post<unknown>(backendAuthEndpoints.resendEmailVerification, input, { auth: false });
  }
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  logBackendPayload(`POST ${backendAuthEndpoints.forgotPassword}`, {
    email: input.email,
  });

  if (backendEnabled()) {
    await api.post<unknown>(backendAuthEndpoints.forgotPassword, input, { auth: false });
  }
}

export async function exchangeOAuthAccount(input: OAuthBackendInput): Promise<BackendAuthResponse> {
  logBackendPayload(`POST ${backendAuthEndpoints.oauth}`, {
    email: input.email,
    image: input.image,
    name: input.name,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    providerAccessToken: input.providerAccessToken,
    providerIdToken: input.providerIdToken,
  });

  if (backendEnabled() && backendOAuthExchangeEnabled()) {
    return normalizeAuthResponse(await api.post<unknown>(backendAuthEndpoints.oauth, input, { auth: false }));
  }

  return {
    user: mockUser(input.email, {
      emailVerified: true,
    }),
  };
}

export async function refreshBackendAuth(refreshToken: string): Promise<BackendAuthResponse | null> {
  logBackendPayload(`POST ${backendAuthEndpoints.refresh}`, {
    refreshToken,
  });

  if (!backendEnabled()) return null;

  return normalizeAuthResponse(await api.post<unknown>(backendAuthEndpoints.refresh, { refreshToken }, { auth: false }));
}
