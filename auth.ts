import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { exchangeOAuthAccount, loginWithEmail, normalizeRole, normalizeStatus, refreshBackendAuth } from "@/features/auth/backend";
import { validateEmail } from "@/features/auth/schemas";
import type { BackendAuthResponse } from "@/features/auth/types";

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "production" ? undefined : "supplyed-local-dev-auth-secret-change-before-production");

function toAuthUser(response: BackendAuthResponse) {
  const user = response.user;

  return {
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    appEmailVerified: user.emailVerified,
    applicationStatus: user.applicationStatus,
    email: user.email,
    id: user.id,
    name: user.email.split("@")[0],
    refreshToken: response.refreshToken,
    role: user.role,
  };
}

function assignBackendSession(token: Record<string, unknown>, response: BackendAuthResponse) {
  token.userId = response.user.id;
  token.role = normalizeRole(response.user.role);
  token.applicationStatus = normalizeStatus(response.user.applicationStatus);
  token.appEmailVerified = response.user.emailVerified;
  token.accessToken = response.accessToken;
  token.refreshToken = response.refreshToken ?? token.refreshToken;
  token.accessTokenExpiresAt = response.accessTokenExpiresAt;
}

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
        const response = await exchangeOAuthAccount({
          email: user.email ?? token.email ?? "",
          image: user.image ?? token.picture ?? null,
          name: user.name ?? token.name ?? null,
          provider: account.provider === "microsoft-entra-id" ? "microsoft-entra-id" : "google",
          providerAccessToken: account.access_token,
          providerAccountId: account.providerAccountId,
          providerIdToken: account.id_token,
        });

        assignBackendSession(token, response);
      }

      const expiresAt = typeof token.accessTokenExpiresAt === "number" ? token.accessTokenExpiresAt : null;
      const refreshToken = typeof token.refreshToken === "string" ? token.refreshToken : null;

      if (expiresAt && refreshToken && Date.now() > expiresAt - 60_000) {
        const refreshed = await refreshBackendAuth(refreshToken);
        if (refreshed) assignBackendSession(token, refreshed);
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
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!validateEmail(email) || password.length < 8) return null;

        return toAuthUser(await loginWithEmail({ email, password }));
      },
    }),
    Google({
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
        },
      },
    }),
    MicrosoftEntraID,
  ],
  secret: authSecret,
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
