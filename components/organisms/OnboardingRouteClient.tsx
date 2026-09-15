"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";

import {
  downloadOnboardingDocument,
  saveOnboardingAction,
  saveOnboardingStep,
  uploadOnboardingDocument,
} from "@/app/(app)/onboarding/actions";
import { hasRequiredDocuments } from "@/features/onboarding/document-utils";
import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import {
  clearFoundingSignupIntent,
  foundingSignupRole,
  type FoundingSignupIntent,
  readFoundingSignupIntent,
} from "@/lib/founding-signup-intent";
import { startRouteLoading } from "@/lib/navigation-loading";
import { getAuthenticatedEntryHref } from "@/lib/routes";
import { useMounted } from "@/lib/use-mounted";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { PageLoader, PublicThemeControls } from "../molecules";
import { OnboardingPage } from "./OnboardingPage";
import type { OnboardingPrefill } from "./onboarding/types";

type SignupRole = Extract<AppRole, "institution" | "teacher" | "individual">;
const sessionRefreshTimeoutMs = 12_000;

function withClientTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function normalizeSignupRole(role: AppRole | null | undefined): SignupRole {
  if (role === "teacher") return "teacher";
  if (role === "individual") return "individual";
  return "institution";
}

function hasMissingRequiredProfileDocuments(snapshot: OnboardingProfileSnapshot) {
  return snapshot.documentRequirements.some(
    (requirement) => requirement.isRequired && !snapshot.requirementDocuments[requirement.id]?.uploadedAt,
  );
}

function initialStep(role: AppRole | null | undefined, snapshot: OnboardingProfileSnapshot) {
  if (role === "teacher") {
    return snapshot.instructor ? 2 : 1;
  }

  if (role === "institution") {
    if (!snapshot.institution) return 1;
    if (snapshot.institution.userRole && snapshot.institution.staffingNeeds) return 3;
    return 2;
  }

  if (role === "individual") {
    return snapshot.recruiter ? 2 : 1;
  }

  return 1;
}

function keyStagesFromFoundingPhase(phase?: string) {
  if (!phase) return undefined;

  if (phase === "Primary") return ["KS1", "KS2"];
  if (phase === "Secondary") return ["KS3", "KS4"];
  if (phase === "Early years") return ["EYFS"];
  if (phase === "Any / flexible") return ["EYFS", "KS1", "KS2", "KS3", "KS4"];
  return undefined;
}

function prefillFromFoundingIntent(intent: FoundingSignupIntent | null): OnboardingPrefill | undefined {
  if (!intent) return undefined;

  const common = {
    email: intent.email,
    fullName: intent.name,
    phone: intent.phone,
    postcode: intent.postcode,
  };

  if (intent.type === "teacher") {
    return {
      ...common,
      bio: intent.bio,
      currency: "GBP",
      dailyRate: intent.dailyRate,
      hourlyRate: intent.hourlyRate,
      keyStages: intent.keyStages ?? keyStagesFromFoundingPhase(intent.phase),
      maxTravelDistance: intent.maxTravelDistance,
      skills: intent.skills ?? (intent.phase === "SEND / Special" ? ["SEN support"] : undefined),
      subjects: intent.subjects,
      yearsExperience: intent.yearsExperience,
    };
  }

  return {
    ...common,
    complianceContact: intent.name,
    complianceEmail: intent.email,
    contactRole: intent.role,
    coverTypes: intent.coverTypes,
    institutionAddress: intent.institutionAddress,
    institutionCity: intent.institutionCity,
    institutionCountryCode: "GB",
    institutionDomain: intent.institutionDomain,
    localAuthority: intent.localAuthority,
    schoolName: intent.organizationName,
    staffingNeeds: intent.staffingNeeds ?? intent.coverTypes?.join(", "),
    typicalPupilCount: intent.typicalPupilCount,
  };
}

function hasFoundingAccountBasics(intent: FoundingSignupIntent) {
  return Boolean(intent.name?.trim() && intent.phone?.trim() && intent.postcode?.trim());
}

function hasFoundingTeacherProfile(intent: FoundingSignupIntent) {
  const keyStages = intent.keyStages ?? keyStagesFromFoundingPhase(intent.phase);

  return Boolean(
    hasFoundingAccountBasics(intent) &&
      intent.subjects?.length &&
      keyStages?.length &&
      intent.yearsExperience?.trim() &&
      intent.bio?.trim() &&
      intent.bio.trim().length >= 40,
  );
}

function initialStepWithFoundingIntent(
  initialRole: AppRole | null,
  snapshot: OnboardingProfileSnapshot,
  intent: FoundingSignupIntent | null,
) {
  const role = initialRole ?? (intent ? foundingSignupRole(intent.type) : null);
  const step = initialStep(role, snapshot);

  if (!initialRole && intent?.type === "school" && step === 1 && hasFoundingAccountBasics(intent)) {
    return 2;
  }

  if (!initialRole && intent?.type === "teacher" && step === 1 && hasFoundingTeacherProfile(intent)) {
    return 2;
  }

  return step;
}

function readMatchingFoundingIntent(initialRole: AppRole | null, accountEmail?: string) {
  if (initialRole) return null;

  const intent = readFoundingSignupIntent();
  if (!intent) return null;

  if (accountEmail && intent.email !== accountEmail.trim().toLowerCase()) {
    return null;
  }

  return intent;
}

async function refreshSessionFromTicket(ticket?: string) {
  if (!ticket) return { ok: true as const };

  const signInResult = await withClientTimeout(
    signIn("credentials", {
      flow: "verified-email-session",
      redirect: false,
      redirectTo: "/post-auth",
      ticket,
    }),
    sessionRefreshTimeoutMs,
    "Your profile was saved, but the session refresh timed out. Refresh the page and sign in again before uploading documents.",
  );

  if (!signInResult?.ok) {
    return {
      message: signInResult?.error || "Your onboarding was saved, but we could not refresh your session. Sign in again to continue.",
      ok: false as const,
    };
  }

  return { ok: true as const };
}

function OnboardingRouteClientInner({
  accountEmail,
  initialApplicationStatus,
  initialProfileSnapshot,
  initialRole,
  sessionRepairTicket,
}: {
  accountEmail?: string;
  initialApplicationStatus: ApplicationStatus;
  initialProfileSnapshot: OnboardingProfileSnapshot;
  initialRole: AppRole | null;
  sessionRepairTicket?: string;
}) {
  const router = useRouter();
  const [foundingIntent, setFoundingIntent] = useState(() => readMatchingFoundingIntent(initialRole, accountEmail));
  const foundingRole = foundingIntent ? foundingSignupRole(foundingIntent.type) : null;
  const [sessionRepairError, setSessionRepairError] = useState<string>();
  const [role, setRoleState] = useState<SignupRole>(() => normalizeSignupRole(initialRole ?? foundingRole));
  const [roleSelected, setRoleSelected] = useState(Boolean(initialRole ?? foundingRole));
  const [step, setStep] = useState(() => initialStepWithFoundingIntent(initialRole, initialProfileSnapshot, foundingIntent));
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState<OnboardingProfileSnapshot>();
  const profileSnapshot = savedProfileSnapshot ?? initialProfileSnapshot;
  const hasMissingRequiredDocuments = hasMissingRequiredProfileDocuments(profileSnapshot);
  const effectiveApplicationStatus = hasMissingRequiredDocuments
    ? "none"
    : initialApplicationStatus !== "none"
      ? initialApplicationStatus
      : initialProfileSnapshot.applicationStatus;
  useEffect(() => {
    if (initialRole && effectiveApplicationStatus !== "none") {
      startRouteLoading();
      const entryHref = getAuthenticatedEntryHref({
        applicationStatus: effectiveApplicationStatus,
        role: initialRole,
      });

      if (!sessionRepairTicket) {
        router.replace(entryHref);
        return;
      }

      void refreshSessionFromTicket(sessionRepairTicket).then((result) => {
        if (!result.ok) {
          setSessionRepairError(result.message);
          return;
        }

        router.replace(entryHref);
        router.refresh();
      });
    }
  }, [effectiveApplicationStatus, initialRole, router, sessionRepairTicket]);

  function setRole(role: SignupRole) {
    if (foundingIntent && role !== foundingSignupRole(foundingIntent.type)) {
      clearFoundingSignupIntent();
      setFoundingIntent(null);
    }

    setRoleState(role);
    setRoleSelected(true);
    setStep(1);
  }

  function goLanding() {
    startRouteLoading();
    router.push("/");
  }

  async function logout() {
    await signOut({ redirect: false });
    startRouteLoading();
    router.push("/login");
  }

  async function saveStep(payload: FormData) {
    const result = await saveOnboardingStep(payload);
    if (!result.ok) return result;

    const sessionRefresh = await refreshSessionFromTicket(result.data.ticket);
    if (!sessionRefresh.ok) return sessionRefresh;
    setSavedProfileSnapshot(result.data.snapshot);
    router.refresh();

    return result;
  }

  async function finishOnboarding(payload: FormData) {
    const result = await saveOnboardingAction(payload);
    if (!result.ok) return result;

    const sessionRefresh = await refreshSessionFromTicket(result.data.ticket);
    if (!sessionRefresh.ok) return sessionRefresh;

    if (result.data.snapshot) setSavedProfileSnapshot(result.data.snapshot);

    if (result.data.applicationStatus === "none") {
      router.refresh();
      return result;
    }

    startRouteLoading();
    router.push(
      getAuthenticatedEntryHref({
        applicationStatus: result.data.applicationStatus,
        role,
      }),
    );
    router.refresh();

    return result;
  }

  if (initialRole && effectiveApplicationStatus !== "none") {
    return (
      <PageLoader
        description={sessionRepairError || "Syncing your latest backend profile status before opening the workspace."}
        title={sessionRepairError ? "Session refresh failed" : "Updating account status"}
      />
    );
  }

  return (
    <>
      <OnboardingPage
        accountEmail={accountEmail}
        foundingType={foundingIntent?.type}
        headerActionLabel="Logout"
        headerPrompt={accountEmail || "Account"}
        initialSnapshot={profileSnapshot}
        onDocumentView={downloadOnboardingDocument}
        onDocumentUpload={uploadOnboardingDocument}
        onFinish={finishOnboarding}
        onLanding={goLanding}
        onLogin={logout}
        onStepSave={saveStep}
        prefill={prefillFromFoundingIntent(foundingIntent)}
        role={role}
        roleSelected={roleSelected}
        setRole={setRole}
        setStep={setStep}
        step={step}
      />
      <PublicThemeControls />
    </>
  );
}

export function OnboardingRouteClient({
  accountEmail,
  initialApplicationStatus,
  initialProfileSnapshot,
  initialRole,
  sessionRepairTicket,
}: {
  accountEmail?: string;
  initialApplicationStatus: ApplicationStatus;
  initialProfileSnapshot: OnboardingProfileSnapshot;
  initialRole: AppRole | null;
  sessionRepairTicket?: string;
}) {
  const isClient = useMounted();

  if (!isClient) {
    return (
      <PageLoader
        description="Restoring verified account and onboarding progress."
        title="Preparing onboarding"
      />
    );
  }

  return (
    <OnboardingRouteClientInner
      accountEmail={accountEmail}
      initialApplicationStatus={initialApplicationStatus}
      initialProfileSnapshot={initialProfileSnapshot}
      initialRole={initialRole}
      sessionRepairTicket={sessionRepairTicket}
    />
  );
}
