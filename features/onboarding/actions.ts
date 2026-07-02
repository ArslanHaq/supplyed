"use server";

import { revalidateTag } from "next/cache";

import { actionOk } from "@/lib/server/action-response";
import { api } from "@/lib/server/api-client";

import { normalizeOnboardingSubmitInput } from "./schemas";
import type { OnboardingSubmitInput } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function submitOnboardingAction(input: OnboardingSubmitInput) {
  const normalizedInput = normalizeOnboardingSubmitInput(input);

  if (backendEnabled()) {
    const result = await api.post<{ applicationStatus: "pending_review" }>("/onboarding/submit", normalizedInput);
    revalidateTag("onboarding", "max");
    return actionOk(result, "Onboarding submitted.");
  }

  revalidateTag("onboarding", "max");
  return actionOk({ applicationStatus: "pending_review" as const }, "Onboarding submission is ready for NestJS integration.");
}
