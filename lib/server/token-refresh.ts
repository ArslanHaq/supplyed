import "server-only";

import { readUnverifiedJwtExpiresAt } from "./jwt";
import type { ServerAuthContext } from "./auth-context";

type RefreshResult = {
  accessToken?: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
};

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

function getApiBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return null;
  return baseUrl;
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

export async function refreshBackendAccessToken(refreshToken: string): Promise<RefreshResult | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;

  const response = await fetch(new URL("/auth/refresh", baseUrl), {
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) return null;

  const payload = unwrapApiPayload(await response.json());
  if (!isRecord(payload)) return null;

  const tokens = isRecord(payload.tokens) ? payload.tokens : {};
  const accessToken = readString(payload.accessToken) ?? readString(tokens.accessToken);
  const nextRefreshToken = readString(payload.refreshToken) ?? readString(tokens.refreshToken);

  return {
    accessToken,
    accessTokenExpiresAt: readAccessTokenExpiresAt(payload, accessToken),
    refreshToken: nextRefreshToken,
  };
}

export async function getValidAccessToken(authContext: ServerAuthContext): Promise<string | null> {
  if (!authContext?.accessToken) return null;

  const expiresAt = authContext.accessTokenExpiresAt ?? readUnverifiedJwtExpiresAt(authContext.accessToken);
  if (!expiresAt || Date.now() <= expiresAt - 60_000) {
    return authContext.accessToken;
  }

  if (!authContext.refreshToken) return authContext.accessToken;

  const refreshed = await refreshBackendAccessToken(authContext.refreshToken);
  return refreshed?.accessToken ?? authContext.accessToken;
}
