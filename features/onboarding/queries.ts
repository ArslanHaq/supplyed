import "server-only";

import { api } from "@/lib/server/api-client";

import type { OnboardingSnapshot } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function getOnboardingSnapshot(): Promise<OnboardingSnapshot> {
  if (backendEnabled()) {
    return api.get<OnboardingSnapshot>("/onboarding/me", {
      next: { tags: ["onboarding"] },
    });
  }

  return {
    applicationStatus: "none",
    completed: false,
    role: null,
    step: 1,
  };
}
