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

export type ForgotPasswordInput = {
  email: string;
};

export type EmailVerificationInput = {
  code: string;
  email: string;
};

export type ResendEmailVerificationInput = {
  email: string;
};

export type BackendAuthResponse = {
  accessToken?: string;
  accessTokenExpiresAt?: number;
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
