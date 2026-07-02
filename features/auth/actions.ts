"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api } from "@/lib/server/api-client";

import { parseForgotPasswordForm, parseLoginForm, parseSignupForm, validateEmail } from "./schemas";
import type { AuthUser } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
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

  if (backendEnabled()) {
    const user = await api.post<AuthUser>("/auth/login", input, { auth: false });
    return actionOk(user, "Signed in.");
  }

  return actionOk(null, "Email login action is ready for NestJS/Auth.js integration.");
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

  if (backendEnabled()) {
    const user = await api.post<AuthUser>("/auth/signup", input, { auth: false });
    return actionOk(user, "Account created.");
  }

  return actionOk(null, "Signup action is ready for NestJS/Auth.js integration.");
}

export async function forgotPasswordAction(_previousState: unknown, formData: FormData) {
  const input = parseForgotPasswordForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (backendEnabled()) {
    await api.post("/auth/forgot-password", input, { auth: false });
  }

  return actionOk(null, "If the email exists, a reset link will be sent.");
}

export async function signInWithGoogleAction() {
  return actionOk(null, "Google OAuth action is ready for Auth.js integration.");
}

export async function signInWithMicrosoftAction() {
  return actionOk(null, "Microsoft OAuth action is ready for Auth.js integration.");
}
