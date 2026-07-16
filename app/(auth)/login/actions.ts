"use server";

import {
  loginWithEmailAction,
  resendEmailVerificationAction,
  signInWithGoogleAction,
  signInWithMicrosoftAction,
  verifyEmailSessionAction,
} from "@/features/auth/actions";

export async function loginAction(previousState: unknown, formData: FormData) {
  return loginWithEmailAction(previousState, formData);
}

export async function googleLoginAction() {
  return signInWithGoogleAction();
}

export async function microsoftLoginAction() {
  return signInWithMicrosoftAction();
}

export async function verifyLoginEmail(previousState: unknown, formData: FormData) {
  return verifyEmailSessionAction(previousState, formData);
}

export async function resendLoginVerification(previousState: unknown, formData: FormData) {
  return resendEmailVerificationAction(previousState, formData);
}
