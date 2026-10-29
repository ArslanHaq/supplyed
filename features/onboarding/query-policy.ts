import type { OnboardingSnapshot } from "./types";

export type OnboardingRefreshMode = "workspace" | "approval" | "display";
export const onboardingStaleTime = 60_000;

export function onboardingRefreshInterval(mode: OnboardingRefreshMode, data?: OnboardingSnapshot): number | false {
  if (mode === "display") return false;
  if (mode === "approval") return data?.signatoryApproval?.status === "PENDING" ? 60_000 : false;
  // Events/focus handle ordinary updates; reconcile missed events in an idle
  // foreground workspace without polling completed accounts every minute.
  return data?.applicationStatus === "pending_review" ? 60_000 : 300_000;
}
