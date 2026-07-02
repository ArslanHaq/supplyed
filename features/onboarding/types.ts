import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type OnboardingSnapshot = {
  applicationStatus: ApplicationStatus;
  completed: boolean;
  role: AppRole | null;
  step: number;
};

export type OnboardingSubmitInput = {
  role: AppRole;
  step: number;
  values: Record<string, unknown>;
};
