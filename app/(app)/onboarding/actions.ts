"use server";

import { submitOnboardingAction } from "@/features/onboarding/actions";
import type { OnboardingSubmitInput } from "@/features/onboarding/types";

export async function saveOnboardingAction(input: OnboardingSubmitInput) {
  return submitOnboardingAction(input);
}
