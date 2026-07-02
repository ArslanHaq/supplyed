import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type AuthUser = {
  applicationStatus: ApplicationStatus;
  email: string;
  emailVerified: boolean;
  id: string;
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
