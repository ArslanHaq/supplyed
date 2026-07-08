import type { EmailVerificationInput, ForgotPasswordInput, LoginInput, SignupInput } from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: FormDataEntryValue | string | null): string {
  return String(email ?? "").trim().toLowerCase();
}

export function parseLoginForm(formData: FormData): LoginInput {
  return {
    email: normalizeEmail(formData.get("email")),
    password: String(formData.get("password") ?? ""),
  };
}

export function parseSignupForm(formData: FormData): SignupInput {
  return {
    email: normalizeEmail(formData.get("email")),
    password: String(formData.get("password") ?? ""),
  };
}

export function parseForgotPasswordForm(formData: FormData): ForgotPasswordInput {
  return {
    email: normalizeEmail(formData.get("email")),
  };
}

export function parseEmailVerificationForm(formData: FormData): EmailVerificationInput {
  return {
    code: String(formData.get("code") ?? "").replace(/\D/g, "").slice(0, 6),
    email: normalizeEmail(formData.get("email")),
  };
}

export function validateEmail(email: string) {
  return emailPattern.test(email);
}
