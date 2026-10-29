import "server-only";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { authSecret } from "@/auth";

export async function getOAuthChallenge() {
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  const token = await getToken({ req: { headers: await headers() }, secret: authSecret,
    secureCookie: authUrl ? authUrl.startsWith("https://") : process.env.NODE_ENV === "production" });
  if (typeof token?.oauthTwoFactorToken !== "string" || typeof token.oauthTwoFactorExpiresAt !== "number" || token.oauthTwoFactorExpiresAt <= Date.now()) return null;
  return { token: token.oauthTwoFactorToken, expiresAt: token.oauthTwoFactorExpiresAt, email: String(token.email ?? "") };
}
