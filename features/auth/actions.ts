"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { signIn } from "@/auth";

import { createEmailAccount, loginWithEmail, requestPasswordReset, verifyEmail } from "./backend";
import { parseEmailVerificationForm, parseForgotPasswordForm, parseLoginForm, parseSignupForm, validateEmail } from "./schemas";

export async function loginWithEmailAction(_previousState: unknown, formData: FormData) {
  const input = parseLoginForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (input.password.length < 8) {
    return actionError("Password must be at least 8 characters.", {
      fieldErrors: { password: "Password must be at least 8 characters." },
    });
  }

  return actionOk(await loginWithEmail(input), "Credentials accepted.");
}

export async function signupWithEmailAction(_previousState: unknown, formData: FormData) {
  const input = parseSignupForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (input.password.length < 8) {
    return actionError("Use at least 8 characters.", {
      fieldErrors: { password: "Use at least 8 characters." },
    });
  }

  return actionOk(await createEmailAccount(input), "Account created. Verify your email to continue.");
}

export async function forgotPasswordAction(_previousState: unknown, formData: FormData) {
  const input = parseForgotPasswordForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  await requestPasswordReset(input);

  return actionOk(null, "If the email exists, a reset link will be sent.");
}

export async function verifyEmailAction(_previousState: unknown, formData: FormData) {
  const input = parseEmailVerificationForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (input.code.length !== 6) {
    return actionError("Enter the 6-digit verification code.", {
      fieldErrors: { code: "Enter the 6-digit verification code." },
    });
  }

  return actionOk(await verifyEmail(input), "Email verified.");
}

export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/post-auth" });
}

export async function signInWithMicrosoftAction() {
  await signIn("microsoft-entra-id", { redirectTo: "/post-auth" });
}
