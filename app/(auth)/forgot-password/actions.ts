"use server";

import { forgotPasswordAction } from "@/features/auth/actions";

export async function requestPasswordResetAction(previousState: unknown, formData: FormData) {
  return forgotPasswordAction(previousState, formData);
}
