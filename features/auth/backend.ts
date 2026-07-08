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
  SignupInput,
} from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function redacted(value: string | undefined) {
  if (!value) return undefined;
  return `[redacted:${value.length} chars]`;
}

function safeConsolePayload(payload: Record<string, unknown>) {
  return {
    ...payload,
    password: redacted(typeof payload.password === "string" ? payload.password : undefined),
    providerAccessToken: payload.providerAccessToken ? "[redacted]" : undefined,
    providerIdToken: payload.providerIdToken ? "[redacted]" : undefined,
    refreshToken: payload.refreshToken ? "[redacted]" : undefined,
  };
}

function logBackendPayload(event: string, payload: Record<string, unknown>) {
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

function normalizeAuthResponse(response: AuthUser | BackendAuthResponse): BackendAuthResponse {
  if ("user" in response) return response;
  return { user: response };
}

export async function createEmailAccount(input: SignupInput): Promise<BackendAuthResponse> {
  logBackendPayload("POST /auth/signup", {
    email: input.email,
    password: input.password,
  });

  if (backendEnabled()) {
    return normalizeAuthResponse(await api.post<AuthUser | BackendAuthResponse>("/auth/signup", input, { auth: false }));
  }

  return {
    user: mockUser(input.email, {
      emailVerified: false,
    }),
  };
}

export async function loginWithEmail(input: LoginInput): Promise<BackendAuthResponse> {
  logBackendPayload("POST /auth/login", {
    email: input.email,
    password: input.password,
  });

  if (backendEnabled()) {
    return normalizeAuthResponse(await api.post<AuthUser | BackendAuthResponse>("/auth/login", input, { auth: false }));
  }

  return {
    user: mockUser(input.email),
  };
}

export async function verifyEmail(input: EmailVerificationInput): Promise<BackendAuthResponse> {
  logBackendPayload("POST /auth/verify-email", {
    code: input.code,
    email: input.email,
  });

  if (backendEnabled()) {
    return normalizeAuthResponse(
      await api.post<AuthUser | BackendAuthResponse>("/auth/verify-email", input, { auth: false }),
    );
  }

  return {
    user: mockUser(input.email),
  };
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  logBackendPayload("POST /auth/forgot-password", {
    email: input.email,
  });

  if (backendEnabled()) {
    await api.post("/auth/forgot-password", input, { auth: false });
  }
}

export async function exchangeOAuthAccount(input: OAuthBackendInput): Promise<BackendAuthResponse> {
  logBackendPayload("POST /auth/oauth", {
    email: input.email,
    image: input.image,
    name: input.name,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    providerAccessToken: input.providerAccessToken,
    providerIdToken: input.providerIdToken,
  });

  if (backendEnabled()) {
    return normalizeAuthResponse(await api.post<AuthUser | BackendAuthResponse>("/auth/oauth", input, { auth: false }));
  }

  return {
    user: mockUser(input.email, {
      emailVerified: true,
    }),
  };
}

export async function refreshBackendAuth(refreshToken: string): Promise<BackendAuthResponse | null> {
  logBackendPayload("POST /auth/refresh", {
    refreshToken,
  });

  if (!backendEnabled()) return null;

  return normalizeAuthResponse(
    await api.post<AuthUser | BackendAuthResponse>("/auth/refresh", { refreshToken }, { auth: false }),
  );
}

export function normalizeRole(role: unknown): AppRole | null {
  return role === "institution" || role === "teacher" || role === "individual" || role === "admin" ? role : null;
}

export function normalizeStatus(status: unknown): ApplicationStatus {
  return status === "pending_review" || status === "approved" || status === "rejected" || status === "suspended"
    ? status
    : "none";
}
