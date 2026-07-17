import { passwordRequirementsMessage, validatePassword } from "@/features/auth/schemas";

import { Icon } from "../atoms";

export const passwordMismatchMessage = "Passwords do not match.";

export function hasConfirmPasswordMismatch(password: string, confirmPassword: string) {
  return Boolean(password && confirmPassword && password !== confirmPassword);
}

export function PasswordRequirementHint({ password }: { password: string }) {
  if (!password || validatePassword(password)) return null;

  return (
    <div className="mt-2 flex gap-2 rounded-lg border border-brand/20 bg-brand-tint px-3 py-2 text-xs font-medium leading-5 text-brand-dark">
      <Icon className="mt-0.5 text-brand" name="shield" size={14} />
      <span>{passwordRequirementsMessage}</span>
    </div>
  );
}

export function ConfirmPasswordMismatch({ confirmPassword, password }: { confirmPassword: string; password: string }) {
  if (!hasConfirmPasswordMismatch(password, confirmPassword)) return null;

  return (
    <div className="mt-2 flex gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-xs font-medium leading-5 text-danger">
      <Icon className="mt-0.5" name="x" size={14} />
      <span>{passwordMismatchMessage}</span>
    </div>
  );
}
