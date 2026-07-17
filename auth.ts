import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { exchangeOAuthAccount, loginWithEmail, normalizeRole, normalizeStatus, refreshBackendAuth, verifyEmail } from "@/features/auth/backend";
import { readUnknownSocialAuthErrorMessage } from "@/features/auth/error-messages";
import { validateEmail } from "@/features/auth/schemas";
import { readVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";

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

function toAuthUser(response: BackendAuthResponse) {
  const user = response.user;

  return {
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    appEmailVerified: user.emailVerified,
    applicationStatus: user.applicationStatus,
    email: user.email,
    id: user.id,
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
} = NextAuth({
  callbacks: {
    async jwt({ account, token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = normalizeRole(user.role);
        token.applicationStatus = normalizeStatus(user.applicationStatus);
        token.appEmailVerified = Boolean(user.appEmailVerified);
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpiresAt = user.accessTokenExpiresAt;
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

      const expiresAt = typeof token.accessTokenExpiresAt === "number" ? token.accessTokenExpiresAt : null;
      const refreshToken = typeof token.refreshToken === "string" ? token.refreshToken : null;

      if (expiresAt && refreshToken && Date.now() > expiresAt - 60_000) {
        try {
          const refreshed = await refreshBackendAuth(refreshToken);
          if (refreshed) assignBackendSession(token, refreshed);
        } catch {
          token.backendAuthError = "RefreshAccessTokenError";
          delete token.accessToken;
          delete token.accessTokenExpiresAt;
          delete token.refreshToken;
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
