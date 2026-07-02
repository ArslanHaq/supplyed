import type { AppRole } from "@/types/supplyed";

import type { OnboardingSubmitInput } from "./types";

const roles: AppRole[] = ["admin", "individual", "institution", "teacher"];

export function normalizeOnboardingSubmitInput(input: OnboardingSubmitInput): OnboardingSubmitInput {
  if (!roles.includes(input.role)) {
    throw new Error("Choose a valid SupplyED role.");
  }

  return {
    role: input.role,
    step: Math.max(1, Math.min(4, Number(input.step) || 1)),
    values: input.values,
  };
}
