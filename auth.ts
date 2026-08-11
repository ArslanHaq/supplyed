import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { exchangeOAuthAccount, loginWithEmail, normalizeRole, normalizeStatus, verifyEmail } from "@/features/auth/backend";
import { readUnknownSocialAuthErrorMessage } from "@/features/auth/error-messages";
import { validateEmail } from "@/features/auth/schemas";
import { readVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";
import { readUnverifiedJwtExpiresAt, readUnverifiedJwtPayload } from "@/lib/server/jwt";

export const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "production" ? undefined : "supplyed-local-dev-auth-secret-change-before-production");

function readEnv(key: string) {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function readCredential(credentials: Partial<Record<string, unknown>> | undefined, key: string) {
  return String(credentials?.[key] ?? "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toAuthUser(response: BackendAuthResponse) {
  const user = response.user;

  return {
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    appEmailVerified: user.emailVerified,
    applicationStatus: user.applicationStatus,
    email: user.email,
    id: user.id,
    instructorProfileId: user.instructorProfileId,
    institutionProfileId: user.institutionProfileId,
    recruiterProfileId: user.recruiterProfileId,
    name: user.name ?? user.email.split("@")[0],
    refreshToken: response.refreshToken,
    role: normalizeRole(user.role),
  };
}

function assignBackendSession(token: Record<string, unknown>, response: BackendAuthResponse) {
  token.userId = response.user.id;
  token.role = normalizeRole(response.user.role);
  token.applicationStatus = normalizeStatus(response.user.applicationStatus);
  token.appEmailVerified = response.user.emailVerified;
  token.instructorProfileId = response.user.instructorProfileId;
  token.institutionProfileId = response.user.institutionProfileId;
  token.recruiterProfileId = response.user.recruiterProfileId;
  if (response.accessToken) token.accessToken = response.accessToken;
  if (response.refreshToken) token.refreshToken = response.refreshToken;
  if (response.accessTokenExpiresAt) token.accessTokenExpiresAt = response.accessTokenExpiresAt;
  delete token.backendAuthError;
  delete token.backendAuthErrorMessage;
  delete token.backendAuthErrorProvider;
}

function assignBackendAuthError(token: Record<string, unknown>, provider: string, error: unknown) {
  token.backendAuthError = "OAuthBackendExchangeError";
  token.backendAuthErrorMessage = readUnknownSocialAuthErrorMessage(error, "Social sign-in failed. Try again.");
  token.backendAuthErrorProvider = provider;
  token.appEmailVerified = false;
  delete token.accessToken;
  delete token.accessTokenExpiresAt;
  delete token.refreshToken;
  delete token.role;
  delete token.applicationStatus;
  delete token.instructorProfileId;
  delete token.institutionProfileId;
  delete token.recruiterProfileId;
}

function assignRefreshAuthError(token: Record<string, unknown>, message = "Your session expired. Sign in again to continue.") {
  token.backendAuthError = "RefreshAccessTokenError";
  token.backendAuthErrorMessage = message;
  delete token.accessToken;
  delete token.accessTokenExpiresAt;
  delete token.refreshToken;
}

function clearBackendAuthError(token: Record<string, unknown>) {
  delete token.backendAuthError;
  delete token.backendAuthErrorMessage;
  delete token.backendAuthErrorProvider;
}

function canApplyBackendTokenUpdate(token: Record<string, unknown>, accessToken: string, refreshToken?: string) {
  const userId = readString(token.userId) ?? readString(token.sub);
  const accessPayload = readUnverifiedJwtPayload(accessToken);
  const refreshPayload = refreshToken ? readUnverifiedJwtPayload(refreshToken) : undefined;

  if (!userId || accessPayload?.sub !== userId || accessPayload.tokenType !== "access") return false;
  if (refreshToken && (refreshPayload?.sub !== userId || refreshPayload.tokenType !== "refresh")) return false;

  return true;
}

function applyBackendSessionUpdate(token: Record<string, unknown>, session: unknown) {
  const update = isRecord(session) && isRecord(session.backendAuthUpdate) ? session.backendAuthUpdate : null;
  const type = readString(update?.type);

  if (type === "expired") {
    assignRefreshAuthError(token, readString(update?.message));
    return;
  }

  if (type !== "refresh") return;

  const accessToken = readString(update?.accessToken);
  const refreshToken = readString(update?.refreshToken);
  if (!accessToken || !canApplyBackendTokenUpdate(token, accessToken, refreshToken)) return;

  token.accessToken = accessToken;
  if (refreshToken) token.refreshToken = refreshToken;
  token.accessTokenExpiresAt = readNumber(update?.accessTokenExpiresAt) ?? readUnverifiedJwtExpiresAt(accessToken);
  clearBackendAuthError(token);
}

const googleClientId = readEnv("AUTH_GOOGLE_ID");
const googleClientSecret = readEnv("AUTH_GOOGLE_SECRET");
const microsoftClientId = readEnv("AUTH_MICROSOFT_ENTRA_ID_ID");
const microsoftClientSecret = readEnv("AUTH_MICROSOFT_ENTRA_ID_SECRET");
const microsoftIssuer = readEnv("AUTH_MICROSOFT_ENTRA_ID_ISSUER");

const socialProviders = [
  ...(googleClientId && googleClientSecret
    ? [
        Google({
          authorization: {
            params: {
              access_type: "offline",
              prompt: "consent",
              response_type: "code",
            },
          },
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : []),
  ...(microsoftClientId && microsoftClientSecret
    ? [
        MicrosoftEntraID({
          clientId: microsoftClientId,
          clientSecret: microsoftClientSecret,
          issuer: microsoftIssuer,
        }),
      ]
    : []),
];

export const {
  auth,
  handlers: { GET, POST },
  signIn,
  signOut,
  unstable_update: updateAuthSession,
} = NextAuth({
  callbacks: {
    async jwt({ account, session, token, trigger, user }) {
      if (trigger === "update") {
        applyBackendSessionUpdate(token, session);
      }

      if (user) {
        token.userId = user.id;
        token.role = normalizeRole(user.role);
        token.applicationStatus = normalizeStatus(user.applicationStatus);
        token.appEmailVerified = Boolean(user.appEmailVerified);
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpiresAt = user.accessTokenExpiresAt;
        token.instructorProfileId = user.instructorProfileId;
        token.institutionProfileId = user.institutionProfileId;
        token.recruiterProfileId = user.recruiterProfileId;
      }

      if (account && account.provider !== "credentials") {
        const email = String(user?.email ?? token.email ?? "").trim().toLowerCase();
        const provider = account.provider === "microsoft-entra-id" ? "microsoft-entra-id" : "google";

        if (!validateEmail(email)) {
          assignBackendAuthError(token, provider, "The social provider did not return a valid email address.");
          return token;
        }

        try {
          const response = await exchangeOAuthAccount({
            email,
            image: user?.image ?? token.picture ?? null,
            name: user?.name ?? token.name ?? null,
            provider,
            providerAccessToken: account.access_token,
            providerAccountId: account.providerAccountId,
            providerIdToken: account.id_token,
          });

          assignBackendSession(token, response);
        } catch (error) {
          assignBackendAuthError(token, provider, error);
        }
      }

      return token;
    },
    async redirect({ baseUrl, url }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      const nextUrl = new URL(url);
      if (nextUrl.origin === baseUrl) return url;

      return `${baseUrl}/post-auth`;
    },
    async session({ session, token }) {
      session.user.id = String(token.userId ?? token.sub ?? "");
      session.user.role = normalizeRole(token.role);
      session.user.applicationStatus = normalizeStatus(token.applicationStatus);
      session.user.isEmailVerified = Boolean(token.appEmailVerified);
      session.user.instructorProfileId =
        typeof token.instructorProfileId === "string" ? token.instructorProfileId : undefined;
      session.user.institutionProfileId =
        typeof token.institutionProfileId === "string" ? token.institutionProfileId : undefined;
      session.user.recruiterProfileId =
        typeof token.recruiterProfileId === "string" ? token.recruiterProfileId : undefined;
      session.user.authErrorMessage =
        typeof token.backendAuthErrorMessage === "string" ? token.backendAuthErrorMessage : undefined;
      session.user.authErrorProvider =
        typeof token.backendAuthErrorProvider === "string" ? token.backendAuthErrorProvider : undefined;
      return session;
    },
  },
  pages: {
    error: "/login",
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        flow: { label: "Flow", type: "text" },
        code: { label: "Code", type: "text" },
        otpToken: { label: "OTP token", type: "text" },
        password: { label: "Password", type: "password" },
        ticket: { label: "Ticket", type: "text" },
      },
      async authorize(credentials) {
        const email = readCredential(credentials, "email").trim().toLowerCase();
        const flow = readCredential(credentials, "flow") || "password";

        if (flow === "verified-email-session") {
          const response = readVerifiedEmailSessionTicket(readCredential(credentials, "ticket"));
          return response ? toAuthUser(response) : null;
        }

        if (!validateEmail(email)) return null;

        if (flow === "verify-email") {
          const code = readCredential(credentials, "code").replace(/\D/g, "").slice(0, 6);
          const otpToken = readCredential(credentials, "otpToken");
          if (code.length !== 6) return null;
          return toAuthUser(await verifyEmail({ code, email, otpToken }));
        }

        const password = readCredential(credentials, "password");

        if (password.length < 8) return null;

        const response = await loginWithEmail({ email, password });
        if ("twoFactorRequired" in response) return null;
        return response.user.emailVerified ? toAuthUser(response) : null;
      },
    }),
    ...socialProviders,
  ],
  secret: authSecret,
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
