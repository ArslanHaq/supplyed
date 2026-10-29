import "server-only";

import { cache } from "react";
import { auth } from "@/auth";
import { normalizeRole, normalizeStatus } from "@/features/auth/backend";
import { ApiError, api } from "@/lib/server/api-client";
import type { ServerAuthContext } from "@/lib/server/auth-context";
import { getOnboardingProfileSnapshot } from "./actions";
import { summarizeOnboardingProfile } from "./snapshot";
import type { OnboardingSnapshot, SignatoryApprovalSnapshot, InstitutionType } from "./types";

type WorkspaceStatusEvidence = {
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  profile: { id: string; status: string; institutionType?: InstitutionType } | null;
  requirements: {
    id: string; isRequired: boolean; requiresReview: boolean;
    document: { uploadedAt: string | null; documentExpiryDate?: string | null; status: string } | null;
  }[];
  signatoryApproval: SignatoryApprovalSnapshot | null;
};

// React cache deduplicates within this server render only. Never share private
// eligibility across requests/users or replace authoritative checks with a TTL.
export const getOnboardingSnapshot = cache(async (authContext?: ServerAuthContext): Promise<OnboardingSnapshot> => {
  if (!process.env.API_BASE_URL) {
    const session = await auth();
    const applicationStatus = session?.user.applicationStatus ?? "none";
    const role = session?.user.role ?? null;
    return { applicationStatus, completed: Boolean(role) && applicationStatus !== "none", verified: false, role, signatoryApproval: null, step: 1 };
  }

  let evidence: WorkspaceStatusEvidence;
  try {
    evidence = await api.get<WorkspaceStatusEvidence>("/users/me/workspace-status", {
      ...(authContext !== undefined ? { authContext } : {}),
      cache: "no-store",
    });
  } catch (error) {
    // Support a rolling deployment where the frontend is updated before the
    // consolidated backend endpoint. The legacy path is only used for 404s.
    if (error instanceof ApiError && error.status === 404) {
      return summarizeOnboardingProfile(await getOnboardingProfileSnapshot());
    }
    throw error;
  }
  const role = normalizeRole(evidence.role);
  return summarizeOnboardingProfile({
    role,
    applicationStatus: normalizeStatus(evidence.profile?.status),
    user: { emailVerified: evidence.emailVerified, phoneVerified: evidence.phoneVerified },
    instructor: role === "teacher" && evidence.profile ? { id: evidence.profile.id } : undefined,
    institution: role === "institution" && evidence.profile ? {
      id: evidence.profile.id, institutionType: evidence.profile.institutionType ?? "SINGLE_SCHOOL",
    } : undefined,
    signatoryApproval: evidence.signatoryApproval,
    documentRequirements: evidence.requirements,
    requirementDocuments: Object.fromEntries(evidence.requirements.flatMap(r => r.document ? [[r.id, r.document]] : [])),
  });
});
