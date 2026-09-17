import "server-only";

import { auth } from "@/auth";

import { getOnboardingProfileSnapshot } from "./actions";
import { hasCreatedRoleProfile, isProfileVerified, profileEntryStatus } from "./profile-progress";
import type { OnboardingSnapshot } from "./types";

export async function getOnboardingSnapshot(): Promise<OnboardingSnapshot> {
  if (!process.env.API_BASE_URL) {
    const session = await auth();
    const applicationStatus = session?.user.applicationStatus ?? "none";
    const role = session?.user.role ?? null;
    return { applicationStatus, completed: Boolean(role) && applicationStatus !== "none", verified: false, role, step: 1 };
  }

  const profile = await getOnboardingProfileSnapshot();
  const applicationStatus = profileEntryStatus(profile);
  return {
    applicationStatus,
    completed: Boolean(profile.role) && applicationStatus !== "none",
    verified: isProfileVerified(profile),
    role: profile.role,
    step: hasCreatedRoleProfile(profile) ? (profile.role === "institution" ? 4 : 2) : 1,
  };
}
