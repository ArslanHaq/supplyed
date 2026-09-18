"use server";
import { revalidateTag } from "next/cache";
import { getOnboardingProfileSnapshot } from "./actions";
import { api } from "@/lib/server/api-client";
import { actionError, actionOk } from "@/lib/server/action-response";
export async function submitProfileReviewAction() {
  try {
    const profile = await getOnboardingProfileSnapshot();
    if (!["none", "rejected", "deactivated"].includes(profile.applicationStatus))
      return actionError("Your profile cannot be submitted from its current status.");
    const resource =
      profile.role === "teacher"
        ? "instructors"
        : profile.role === "institution"
          ? "institutions"
          : profile.role === "individual"
            ? "recruiters"
            : null;
    if (!resource) return actionError("Create your profile first.");
    await api.patch(`/${resource}/me/status`);
    revalidateTag("onboarding", "max");
    return actionOk(null, "Profile submitted for review.");
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "Could not submit profile.");
  }
}
