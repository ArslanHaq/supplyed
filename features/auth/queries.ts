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

  return null;
}
