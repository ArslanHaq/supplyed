"use server";

import {
  loginWithEmailAction,
  signInWithGoogleAction,
  signInWithMicrosoftAction,
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
