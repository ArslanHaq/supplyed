import type {
  EmailVerificationInput,
  ForgotPasswordInput,
  LoginInput,
  PasswordResetInput,
  ResendEmailVerificationInput,
  SignupInput,
  TwoFactorVerificationInput,
} from "./types";
import type { AppRole } from "@/types/supplyed";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPasswordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const passwordRequirementsMessage =
  "Use at least 8 characters, at most 72 UTF-8 bytes, with an uppercase letter, a number, and a special character.";

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
    role: (formData.get("role") as AppRole) || null,
  };
}

export function parseForgotPasswordForm(formData: FormData): ForgotPasswordInput {
  return {
    email: normalizeEmail(formData.get("email")),
  };
}

export function parsePasswordResetForm(formData: FormData): PasswordResetInput {
  return {
    code: String(formData.get("code") ?? "").trim(),
    otpToken: String(formData.get("otpToken") ?? "").trim() || undefined,
    password: String(formData.get("password") ?? ""),
  };
}

export function parseEmailVerificationForm(formData: FormData): EmailVerificationInput {
  return {
    code: String(formData.get("code") ?? "").trim(),
    email: normalizeEmail(formData.get("email")),
    otpToken: String(formData.get("otpToken") ?? "").trim() || undefined,
  };
}

export function parseTwoFactorForm(formData: FormData): TwoFactorVerificationInput {
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    email: normalizeEmail(formData.get("email")),
    twoFactorToken: String(formData.get("twoFactorToken") ?? "").trim() || undefined,
  };
}

export function parseResendEmailVerificationForm(formData: FormData): ResendEmailVerificationInput {
  return {
    email: normalizeEmail(formData.get("email")),
  };
}

export function validateEmail(email: string) {
  return typeof email === "string" && email.length <= 254 && emailPattern.test(email);
}

export function validatePassword(password: string) {
  return typeof password === "string" && new TextEncoder().encode(password).length <= 72 && strongPasswordPattern.test(password);
}
