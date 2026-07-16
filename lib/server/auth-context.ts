import "server-only";

import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";

export type ServerAuthContext = {
  accessToken?: string | null;
  accessTokenExpiresAt?: number | null;
  email?: string | null;
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

export async function getServerAuthContext(): Promise<ServerAuthContext> {
  const { auth } = await import("@/auth");
  const session = await auth();

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
    refreshToken: readString(token?.refreshToken),
    role: session.user.role,
    userId: session.user.id,
  };
}
