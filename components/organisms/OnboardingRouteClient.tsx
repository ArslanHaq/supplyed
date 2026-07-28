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
import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import { startRouteLoading } from "@/lib/navigation-loading";
import { getAuthenticatedEntryHref } from "@/lib/routes";
import { useMounted } from "@/lib/use-mounted";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { PageLoader, PublicThemeControls } from "../molecules";
import { OnboardingPage } from "./OnboardingPage";

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

function hasAllInstructorDocuments(snapshot: OnboardingProfileSnapshot) {
  return Boolean(
    snapshot.documents.dbs?.uploadedAt &&
      snapshot.documents.id?.uploadedAt &&
      snapshot.documents.qualification?.uploadedAt &&
      snapshot.documents.addressProof?.uploadedAt,
  );
}

function normalizeSignupRole(role: AppRole | null | undefined): SignupRole {
  if (role === "teacher") return "teacher";
  if (role === "individual") return "individual";
  return "institution";
}

function initialStep(role: AppRole | null | undefined, snapshot: OnboardingProfileSnapshot) {
  if (role === "teacher") {
    if (!snapshot.instructor) return 1;
    if (hasAllInstructorDocuments(snapshot)) return 3;
    return 2;
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
  const [sessionRepairError, setSessionRepairError] = useState<string>();
  const [role, setRoleState] = useState<SignupRole>(() => normalizeSignupRole(initialRole));
  const [roleSelected, setRoleSelected] = useState(Boolean(initialRole));
  const [step, setStep] = useState(() => initialStep(initialRole, initialProfileSnapshot));
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState<OnboardingProfileSnapshot>();
  const profileSnapshot = savedProfileSnapshot ?? initialProfileSnapshot;
  const effectiveApplicationStatus =
    initialApplicationStatus !== "none" ? initialApplicationStatus : initialProfileSnapshot.applicationStatus;

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
        headerActionLabel="Logout"
        headerPrompt={accountEmail || "Account"}
        initialSnapshot={profileSnapshot}
        onDocumentView={downloadOnboardingDocument}
        onDocumentUpload={uploadOnboardingDocument}
        onFinish={finishOnboarding}
        onLanding={goLanding}
        onLogin={logout}
        onStepSave={saveStep}
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
