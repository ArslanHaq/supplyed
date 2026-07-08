import type { DefaultSession } from "next-auth";

import type { AppRole, ApplicationStatus } from "@/types/supplyed";

declare module "next-auth" {
  interface Session {
    user: {
      applicationStatus: ApplicationStatus;
      id: string;
      isEmailVerified: boolean;
      role: AppRole | null;
    } & DefaultSession["user"];
  }

  interface User {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    applicationStatus?: ApplicationStatus;
    appEmailVerified?: boolean;
    refreshToken?: string;
    role?: AppRole | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    applicationStatus?: ApplicationStatus;
    appEmailVerified?: boolean;
    refreshToken?: string;
    role?: AppRole | null;
    userId?: string;
  }
}
