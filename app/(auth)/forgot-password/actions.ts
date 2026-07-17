"use server";

import { forgotPasswordAction, resetPasswordAction } from "@/features/auth/actions";

export async function requestPasswordResetAction(previousState: unknown, formData: FormData) {
  return forgotPasswordAction(previousState, formData);
}

export async function confirmPasswordResetAction(previousState: unknown, formData: FormData) {
  return resetPasswordAction(previousState, formData);
}
