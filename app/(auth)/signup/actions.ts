"use server";

import {
  signInWithGoogleAction,
  signInWithMicrosoftAction,
  signupWithEmailAction,
  verifyEmailAction,
} from "@/features/auth/actions";

export async function signupAction(previousState: unknown, formData: FormData) {
  return signupWithEmailAction(previousState, formData);
}

export async function googleSignupAction() {
  return signInWithGoogleAction();
}

export async function microsoftSignupAction() {
  return signInWithMicrosoftAction();
}

export async function verifySignupEmail(previousState: unknown, formData: FormData) {
  return verifyEmailAction(previousState, formData);
}
