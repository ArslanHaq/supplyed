"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { signIn } from "@/auth";
import { ApiError } from "@/lib/server/api-client";

import { createEmailAccount, loginWithEmail, requestPasswordReset, resendEmailVerification, verifyEmail } from "./backend";
import {
  parseEmailVerificationForm,
  parseForgotPasswordForm,
  parseLoginForm,
  parseResendEmailVerificationForm,
  parseSignupForm,
  passwordRequirementsMessage,
  validateEmail,
  validatePassword,
} from "./schemas";

function toAuthActionError(error: unknown, fallback = "We could not complete that auth request.") {
  if (error instanceof ApiError) {
    return actionError(error.message || fallback);
  }

  if (error instanceof Error && error.message) {
    return actionError(error.message);
  }

  return actionError(fallback);
}

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

  try {
    return actionOk(await loginWithEmail(input), "Credentials accepted.");
  } catch (error) {
    return toAuthActionError(error, "We could not sign you in with those details.");
  }
}

export async function signupWithEmailAction(_previousState: unknown, formData: FormData) {
  const input = parseSignupForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (!validatePassword(input.password)) {
    return actionError(passwordRequirementsMessage, {
      fieldErrors: { password: passwordRequirementsMessage },
    });
  }

  try {
    return actionOk(await createEmailAccount(input), "Account created. Verify your email to continue.");
  } catch (error) {
    return toAuthActionError(error, "We could not create this account.");
  }
}

export async function forgotPasswordAction(_previousState: unknown, formData: FormData) {
  const input = parseForgotPasswordForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  try {
    await requestPasswordReset(input);
  } catch (error) {
    return toAuthActionError(error, "We could not request a password reset.");
  }

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

  try {
    return actionOk(await verifyEmail(input), "Email verified.");
  } catch (error) {
    return toAuthActionError(error, "We could not verify that code.");
  }
}

export async function resendEmailVerificationAction(_previousState: unknown, formData: FormData) {
  const input = parseResendEmailVerificationForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  try {
    await resendEmailVerification(input);
  } catch (error) {
    return toAuthActionError(error, "We could not resend the verification code.");
  }

  return actionOk(null, "If this account needs verification, a new code will be sent.");
}

export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/post-auth" });
}

export async function signInWithMicrosoftAction() {
  await signIn("microsoft-entra-id", { redirectTo: "/post-auth" });
}
