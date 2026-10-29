import "server-only";

import type { Session } from "next-auth";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { cache } from "react";

export type ServerAuthContext = {
  accessToken?: string | null;
  accessTokenExpiresAt?: number | null;
  email?: string | null;
  instructorProfileId?: string | null;
  institutionProfileId?: string | null;
  refreshToken?: string | null;
  role?: string | null;
  userId: string;
} | null;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shouldUseSecureAuthCookies() {
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (authUrl) return authUrl.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

function getAuthCookieSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "supplyed-local-dev-auth-secret-change-before-production")
  );
}

const resolveServerAuthContext = cache(async (requestSession?: Session | null): Promise<ServerAuthContext> => {
  const session = requestSession === undefined
    ? await (await import("@/auth")).auth()
    : requestSession;

  if (!session?.user?.id) return null;

  const token = await getToken({
    req: { headers: await headers() },
    secret: getAuthCookieSecret(),
    secureCookie: shouldUseSecureAuthCookies(),
  });

  return {
    accessToken: readString(token?.accessToken),
    accessTokenExpiresAt: readNumber(token?.accessTokenExpiresAt),
    email: session.user.email,
    instructorProfileId: readString(token?.instructorProfileId),
    institutionProfileId: readString(token?.institutionProfileId),
    refreshToken: readString(token?.refreshToken),
    role: session.user.role,
    userId: session.user.id,
  };
});

// React's request-local cache avoids decoding the same private session more
// than once during a server render. Nothing is retained between users or
// requests, and callers can pass a session they already authenticated.
export function getServerAuthContext(requestSession?: Session | null): Promise<ServerAuthContext> {
  return resolveServerAuthContext(requestSession);
}
