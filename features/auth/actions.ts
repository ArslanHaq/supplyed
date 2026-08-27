"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { ApiError } from "@/lib/server/api-client";
import { signIn } from "@/auth";

import { createEmailAccount, loginWithEmail, requestPasswordReset, verifyEmail } from "./backend";
import { parseEmailVerificationForm, parseForgotPasswordForm, parseLoginForm, parseSignupForm, validateEmail } from "./schemas";

function readAuthActionError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid email or password.";
    if (error.status === 403) return "You do not have access to this account yet.";
    if (error.status === 404) return "Authentication is not available at the configured backend URL.";
    if (error.status >= 500) return "The authentication server is unavailable. Please try again shortly.";

    return error.message || "The request could not be completed.";
  }

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return "The authentication server took too long to respond. Please try again.";
    }

    return error.message || "The request could not be completed.";
  }

  return "The request could not be completed.";
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
    return actionError(readAuthActionError(error), {
      fieldErrors: { password: readAuthActionError(error) },
    });
  }
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

  try {
    return actionOk(await createEmailAccount(input), "Account created. Verify your email to continue.");
  } catch (error) {
    return actionError(readAuthActionError(error));
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
    return actionError(readAuthActionError(error));
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
    return actionError(readAuthActionError(error), {
      fieldErrors: { code: readAuthActionError(error) },
    });
  }
}

export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/post-auth" });
}

export async function signInWithMicrosoftAction() {
  await signIn("microsoft-entra-id", { redirectTo: "/post-auth" });
}
