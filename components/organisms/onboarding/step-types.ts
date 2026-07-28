import type { OnboardingFormController } from "./useOnboardingForm";
import type { SignupRole } from "./types";

export type StepComponentProps = {
  controller: OnboardingFormController;
};

export type AccountStepProps = StepComponentProps & {
  accountEmail?: string;
  roleSelected: boolean;
  setRole: (role: SignupRole) => void;
};
