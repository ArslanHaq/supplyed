import "server-only";

import { createHash } from "node:crypto";
import { ApiError } from "./api-error";
import { readUnverifiedJwtExpiresAt, readUnverifiedJwtPayload } from "./jwt";
import type { ServerAuthContext } from "./auth-context";

type RefreshResult = {
  accessToken?: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
};

// Share only the upstream request, never a caller's cookie-writing context.
// A short grace period lets parallel requests and the first client request after
// server rendering persist the same rotated pair. This cache is process-local.
const refreshes = new Map<string, { promise: Promise<RefreshResult | null>; expiresAt: number }>();
const MAX_REFRESHES = 1000;
const REFRESH_GRACE_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readTokenUserId(accessToken?: string) {
  const payload = readUnverifiedJwtPayload(accessToken);
  return readString(payload?.sub);
}

function normalizeExpiryTimestamp(value: number) {
  return value < 10_000_000_000 ? value * 1000 : value;
}

async function updateBackendAuthSession(data: Record<string, unknown>) {
  try {
    const { updateAuthSession } = await import("@/auth");
    await updateAuthSession(data as never);
  } catch (error) {
    // Server Components cannot write cookies. The grace cache keeps the rotated
    // pair available to the next writable request without reusing the old token.
    if (!(error instanceof Error && error.message.includes("Cookies can only be modified"))) {
      console.error(JSON.stringify({ event: "session_persistence_failed", errorType: error instanceof Error ? error.name : "Unknown" }));
    }
  }
}

async function persistBackendTokenRefresh(result: RefreshResult) {
  if (!result.accessToken || !readTokenUserId(result.accessToken)) return;

  await updateBackendAuthSession({
    backendAuthUpdate: {
      type: "refresh",
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshToken: result.refreshToken,
    },
  });
}

export async function markBackendSessionExpired(message = "Your session expired. Sign in again to continue.") {
  await updateBackendAuthSession({
    backendAuthUpdate: {
      type: "expired",
      message,
    },
  });
}

function getApiBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return null;
  return baseUrl;
}

function buildApiPath(basePath: string, path: string) {
  const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");

  return [normalizedBasePath, normalizedPath].filter(Boolean).join("/");
}

function buildApiUrl(path: string) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(baseUrl);
  url.pathname = buildApiPath(url.pathname, path);
  url.search = "";
  return url;
}

function unwrapApiPayload(payload: unknown) {
  if (isRecord(payload) && "data" in payload && ("success" in payload || "message" in payload)) {
    return payload.data;
  }

  return payload;
}

function readAccessTokenExpiresAt(record: Record<string, unknown>, accessToken?: string) {
  const tokens = isRecord(record.tokens) ? record.tokens : {};
  const explicitExpiresAt =
    readNumber(record.accessTokenExpiresAt) ??
    readNumber(record.expiresAt) ??
    readNumber(tokens.accessTokenExpiresAt) ??
    readNumber(tokens.expiresAt);

  if (explicitExpiresAt) return normalizeExpiryTimestamp(explicitExpiresAt);

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

async function requestTokenRefresh(refreshToken: string): Promise<RefreshResult | null> {
  const url = buildApiUrl("/auth/refresh");
  if (!url) return null;

  const response = await fetch(url, {
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) return null;
    throw new ApiError("Your session could not be refreshed right now. Please try again.", 503, undefined, "AUTH_SERVICE_UNAVAILABLE");
  }

  const payload = unwrapApiPayload(await response.json().catch(() => null));
  if (!isRecord(payload)) {
    throw new ApiError("The authentication service returned an invalid response. Please try again.", 502);
  }

  const tokens = isRecord(payload.tokens) ? payload.tokens : {};
  const accessToken = readString(payload.accessToken) ?? readString(tokens.accessToken);
  const nextRefreshToken = readString(payload.refreshToken) ?? readString(tokens.refreshToken);

  if (!accessToken) {
    throw new ApiError("The authentication service returned an incomplete response. Please try again.", 502);
  }

  const result = {
    accessToken,
    accessTokenExpiresAt: readAccessTokenExpiresAt(payload, accessToken),
    refreshToken: nextRefreshToken,
  };

  return result;
}

export async function refreshBackendAccessToken(refreshToken: string): Promise<RefreshResult | null> {
  const now = Date.now();
  for (const [key, entry] of refreshes) {
    if (entry.expiresAt <= now) refreshes.delete(key);
  }
  const key = createHash("sha256").update(refreshToken).digest("hex");
  let entry = refreshes.get(key);
  if (!entry) {
    if (refreshes.size >= MAX_REFRESHES) {
      throw new ApiError("Sign-in is busy. Please try again shortly.", 503);
    }
    entry = { promise: requestTokenRefresh(refreshToken), expiresAt: now + 15_000 + REFRESH_GRACE_MS };
    refreshes.set(key, entry);
    const current = entry;
    void current.promise.then((result) => {
      if (!result) refreshes.delete(key);
      else current.expiresAt = Math.min(Date.now() + REFRESH_GRACE_MS, result.accessTokenExpiresAt ?? Infinity);
    }, () => { refreshes.delete(key); });
  }
  const result = await entry.promise;
  if (result) await persistBackendTokenRefresh(result);
  else await markBackendSessionExpired();
  return result;
}

export async function getValidAccessToken(authContext: ServerAuthContext): Promise<string | null> {
  if (!authContext?.accessToken) return null;

  const expiresAt = authContext.accessTokenExpiresAt ?? readUnverifiedJwtExpiresAt(authContext.accessToken);
  if (!expiresAt || Date.now() <= expiresAt - 60_000) {
    return authContext.accessToken;
  }

  if (!authContext.refreshToken) {
    await markBackendSessionExpired();
    return null;
  }

  const refreshed = await refreshBackendAccessToken(authContext.refreshToken);
  return refreshed?.accessToken ?? null;
}
