import "server-only";

import { api } from "@/lib/server/api-client";

import type { AuthUser } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (backendEnabled()) {
    return api.get<AuthUser>("/auth/me", {
      next: { tags: ["auth", "auth:me"] },
    });
  }

  const { auth } = await import("@/auth");
  const session = await auth();

  if (!session?.user) return null;

  return {
    applicationStatus: session.user.applicationStatus,
    email: session.user.email ?? "",
    emailVerified: session.user.isEmailVerified,
    id: session.user.id,
    role: session.user.role,
  };
}
