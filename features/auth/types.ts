import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type AuthUser = {
  applicationStatus: ApplicationStatus;
  email: string;
  emailVerified: boolean;
  id: string;
  name?: string | null;
  role: AppRole | null;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type SignupInput = {
  email: string;
  password: string;
};

export type EmailVerificationChallenge = {
  code: "EMAIL_VERIFICATION_PENDING" | "EMAIL_VERIFICATION_REQUIRED";
  email: string;
  emailVerified: false;
  expiresInMinutes?: number;
  message?: string;
  otpToken?: string;
  passwordUpdated?: boolean;
};

export type ForgotPasswordInput = {
  email: string;
};

export type PasswordResetChallenge = {
  expiresInMinutes?: number;
  otpToken?: string;
};

export type PasswordResetInput = {
  code: string;
  otpToken?: string;
  password: string;
};

export type PasswordResetResponse = {
  passwordReset: boolean;
};

export type EmailVerificationInput = {
  code: string;
  email: string;
  otpToken?: string;
};

export type ResendEmailVerificationInput = {
  email: string;
};

export type EmailVerificationResendResponse = {
  code?: string;
  email: string;
  emailVerified: boolean;
  expiresInMinutes?: number;
  message?: string;
  otpToken?: string;
};

export type BackendAuthResponse = {
  accessToken?: string;
  accessTokenExpiresAt?: number;
  expiresInMinutes?: number;
  otpToken?: string;
  refreshToken?: string;
  user: AuthUser;
};

export type OAuthProvider = "google" | "microsoft-entra-id";

export type OAuthBackendInput = {
  email: string;
  image?: string | null;
  name?: string | null;
  provider: OAuthProvider;
  providerAccessToken?: string;
  providerAccountId: string;
  providerIdToken?: string;
};
