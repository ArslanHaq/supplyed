import "server-only";

import { api } from "@/lib/server/api-client";
import { readUnverifiedJwtExpiresAt } from "@/lib/server/jwt";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import type {
  AuthUser,
  BackendAuthResponse,
  EmailVerificationChallenge,
  EmailVerificationInput,
  EmailVerificationResendResponse,
  ForgotPasswordInput,
  LoginInput,
  OAuthBackendInput,
  PasswordResetChallenge,
  PasswordResetInput,
  PasswordResetResponse,
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
  oauthGoogle: "/auth/oauth/google",
  refresh: "/auth/refresh",
  register: "/auth/register",
  resetPassword: "/auth/password/reset",
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
    otpToken: payload.otpToken ? "[redacted]" : undefined,
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

function readAccessTokenExpiresAt(record: Record<string, unknown>, accessToken?: string) {
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
    readNumber(record.accessTokenExpiresInSeconds) ??
    readNumber(record.accessTokenExpiresIn) ??
    readNumber(record.expiresIn) ??
    readNumber(tokens.accessTokenExpiresInSeconds) ??
    readNumber(tokens.accessTokenExpiresIn);

  if (expiresInSeconds) return Date.now() + expiresInSeconds * 1000;

  return readUnverifiedJwtExpiresAt(accessToken);
}

function readUserPayload(payload: unknown) {
  if (!isRecord(payload)) throw new Error("Backend auth response was not an object.");
  if (isRecord(payload.user)) return payload.user;
  return payload;
}

function readOptionalUserPayload(payload: unknown) {
  if (!isRecord(payload)) return {};
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
    instructorProfileId:
      readString(user.instructorProfileId) ??
      readString(user.instructorProfileID) ??
      readString(user.instructorId) ??
      (isRecord(user.instructorProfile) ? readString(user.instructorProfile.id) : undefined),
    institutionProfileId:
      readString(user.institutionProfileId) ??
      readString(user.institutionProfileID) ??
      readString(user.institutionId) ??
      (isRecord(user.institutionProfile) ? readString(user.institutionProfile.id) : undefined),
    name: readString(user.name) ?? readString(user.fullName) ?? null,
    role: normalizeRole(user.role),
  };
}

function normalizeAuthResponse(payload: unknown): BackendAuthResponse {
  const response = isRecord(payload) ? payload : {};
  const user = normalizeAuthUser(readUserPayload(response));
  const { accessToken, refreshToken } = readTokenPair(response);
  const expiresInMinutes =
    readNumber(response.expiresInMinutes) ??
    readNumber(response.emailVerificationExpiresInMinutes) ??
    readNumber(response.otpExpiresInMinutes);

  return {
    accessToken,
    accessTokenExpiresAt: readAccessTokenExpiresAt(response, accessToken),
    expiresInMinutes,
    otpToken: readString(response.otpToken),
    refreshToken,
    user,
  };
}

function normalizeEmailVerificationChallenge(payload: unknown, fallbackEmail: string): EmailVerificationChallenge {
  const response = isRecord(payload) ? payload : {};
  const user = readOptionalUserPayload(response);
  const email = readString(response.email) ?? readString(user.email) ?? fallbackEmail;
  const backendCode = readString(response.code);
  const passwordUpdated = readBoolean(response.passwordUpdated);
  const expiresInMinutes =
    readNumber(response.expiresInMinutes) ??
    readNumber(response.emailVerificationExpiresInMinutes) ??
    readNumber(response.otpExpiresInMinutes);

  return {
    code: backendCode === "EMAIL_VERIFICATION_PENDING" ? "EMAIL_VERIFICATION_PENDING" : "EMAIL_VERIFICATION_REQUIRED",
    email,
    emailVerified: false,
    expiresInMinutes,
    message: readString(response.message),
    otpToken: readString(response.otpToken),
    passwordUpdated,
  };
}

function normalizeEmailVerificationResendResponse(
  payload: unknown,
  fallbackEmail: string,
): EmailVerificationResendResponse {
  const response = isRecord(payload) ? payload : {};
  const user = readOptionalUserPayload(response);

  return {
    code: readString(response.code),
    email: readString(response.email) ?? readString(user.email) ?? fallbackEmail,
    emailVerified: readBoolean(response.emailVerified ?? user.emailVerified) ?? false,
    expiresInMinutes:
      readNumber(response.expiresInMinutes) ??
      readNumber(response.emailVerificationExpiresInMinutes) ??
      readNumber(response.otpExpiresInMinutes),
    message: readString(response.message),
    otpToken: readString(response.otpToken),
  };
}

function normalizePasswordResetChallenge(payload: unknown): PasswordResetChallenge {
  const response = isRecord(payload) ? payload : {};

  return {
    expiresInMinutes:
      readNumber(response.expiresInMinutes) ??
      readNumber(response.passwordResetExpiresInMinutes) ??
      readNumber(response.otpExpiresInMinutes),
    otpToken: readString(response.otpToken),
  };
}

export async function createEmailAccount(input: SignupInput): Promise<EmailVerificationChallenge> {
  logBackendPayload(`POST ${backendAuthEndpoints.register}`, {
    email: input.email,
    password: input.password,
  });

  if (backendEnabled()) {
    return normalizeEmailVerificationChallenge(
      await api.post<unknown>(backendAuthEndpoints.register, input, { auth: false }),
      input.email,
    );
  }

  return {
    code: "EMAIL_VERIFICATION_REQUIRED",
    email: input.email,
    emailVerified: false,
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
    otp: input.code,
  };

  logBackendPayload(`POST ${backendAuthEndpoints.verifyEmail}`, {
    ...payload,
    otpToken: input.otpToken,
  });

  if (backendEnabled()) {
    if (!input.otpToken) {
      throw new Error("Request a new verification code before verifying this email.");
    }

    return normalizeAuthResponse(
      await api.post<unknown>(backendAuthEndpoints.verifyEmail, payload, {
        auth: false,
        headers: { Authorization: `Bearer ${input.otpToken}` },
      }),
    );
  }

  return {
    user: mockUser(input.email),
  };
}

export async function resendEmailVerification(input: ResendEmailVerificationInput): Promise<EmailVerificationResendResponse> {
  logBackendPayload(`POST ${backendAuthEndpoints.resendEmailVerification}`, {
    email: input.email,
  });

  if (backendEnabled()) {
    return normalizeEmailVerificationResendResponse(
      await api.post<unknown>(backendAuthEndpoints.resendEmailVerification, input, { auth: false }),
      input.email,
    );
  }

  return {
    email: input.email,
    emailVerified: false,
  };
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<PasswordResetChallenge> {
  logBackendPayload(`POST ${backendAuthEndpoints.forgotPassword}`, {
    email: input.email,
  });

  if (backendEnabled()) {
    return normalizePasswordResetChallenge(
      await api.post<unknown>(backendAuthEndpoints.forgotPassword, input, { auth: false }),
    );
  }

  return {
    expiresInMinutes: 10,
    otpToken: "local-password-reset-token",
  };
}

export async function resetPassword(input: PasswordResetInput): Promise<PasswordResetResponse> {
  const payload = {
    otp: input.code,
    password: input.password,
  };

  logBackendPayload(`POST ${backendAuthEndpoints.resetPassword}`, {
    ...payload,
    otpToken: input.otpToken,
  });

  if (backendEnabled()) {
    if (!input.otpToken) {
      throw new Error("Request a new reset code before changing your password.");
    }

    const response = await api.post<unknown>(backendAuthEndpoints.resetPassword, payload, {
      auth: false,
      headers: { Authorization: `Bearer ${input.otpToken}` },
    });

    const record = isRecord(response) ? response : {};

    return {
      passwordReset: readBoolean(record.passwordReset) ?? true,
    };
  }

  return { passwordReset: true };
}

export async function exchangeOAuthAccount(input: OAuthBackendInput): Promise<BackendAuthResponse> {
  logBackendPayload(`POST ${backendAuthEndpoints.oauthGoogle}`, {
    email: input.email,
    image: input.image,
    name: input.name,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    providerAccessToken: input.providerAccessToken,
    providerIdToken: input.providerIdToken,
  });

  if (backendEnabled()) {
    if (!backendOAuthExchangeEnabled()) {
      throw new Error("Social sign-in is not available yet. Use email and password while we finish connecting Google sign-in.");
    }

    if (input.provider !== "google") {
      throw new Error("Microsoft sign-in is not connected to the SupplyED backend yet.");
    }

    if (!input.providerIdToken) {
      throw new Error("Google did not return an ID token for backend sign-in.");
    }

    return normalizeAuthResponse(
      await api.post<unknown>(backendAuthEndpoints.oauthGoogle, { credential: input.providerIdToken }, { auth: false }),
    );
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
