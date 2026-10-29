import { hasCreatedRoleProfile, isProfileVerified, profileEntryStatus, type ProfileEligibilitySnapshot } from "./profile-progress";
import type { OnboardingSnapshot } from "./types";

export function summarizeOnboardingProfile(profile: ProfileEligibilitySnapshot): OnboardingSnapshot {
  const applicationStatus = profileEntryStatus(profile);
  return {
    applicationStatus,
    completed: Boolean(profile.role) && applicationStatus !== "none",
    verified: isProfileVerified(profile),
    role: profile.role,
    signatoryApproval: profile.signatoryApproval ?? null,
    step: hasCreatedRoleProfile(profile) ? (profile.role === "institution" ? 4 : 2) : 1,
  };
}
