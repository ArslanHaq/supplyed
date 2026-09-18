import type { OnboardingProfileSnapshot } from "./types";
export function hasCreatedRoleProfile(snapshot: OnboardingProfileSnapshot) {
  if (snapshot.role === "teacher") return Boolean(snapshot.instructor?.id);
  if (snapshot.role === "institution") return Boolean(snapshot.institution?.id);
  if (snapshot.role === "individual") return Boolean(snapshot.recruiter?.id);
  return false;
}
export function isProfileVerified(snapshot: OnboardingProfileSnapshot) {
  return snapshot.user?.isFullyVerified === true;
}
export function profileEntryStatus(snapshot: OnboardingProfileSnapshot) {
  return hasCreatedRoleProfile(snapshot) ? snapshot.applicationStatus : "none";
}
