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
import { buildAppHref } from "@/lib/routes";
import { useMounted } from "@/lib/use-mounted";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { PageLoader, PublicThemeControls } from "../molecules";
import { OnboardingPage } from "./OnboardingPage";

type SignupRole = Extract<AppRole, "institution" | "teacher" | "individual">;

function normalizeSignupRole(role: AppRole | null | undefined): SignupRole {
  if (role === "teacher") return "teacher";
  if (role === "individual") return "individual";
  return "institution";
}

function initialStep(role: AppRole | null | undefined, snapshot: OnboardingProfileSnapshot) {
  if (role === "teacher") {
    if (snapshot.documents.dbs && snapshot.documents.id && snapshot.documents.qualification && snapshot.documents.addressProof) return 3;
    return 2;
  }

  if (role === "institution" && snapshot.institution) return 3;

  return 1;
}

async function refreshSessionFromTicket(ticket?: string) {
  if (!ticket) return { ok: true as const };

  const signInResult = await signIn("credentials", {
    flow: "verified-email-session",
    redirect: false,
    redirectTo: "/post-auth",
    ticket,
  });

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
}: {
  accountEmail?: string;
  initialApplicationStatus: ApplicationStatus;
  initialProfileSnapshot: OnboardingProfileSnapshot;
  initialRole: AppRole | null;
}) {
  const router = useRouter();
  const [role, setRoleState] = useState<SignupRole>(() => normalizeSignupRole(initialRole));
  const [roleSelected, setRoleSelected] = useState(Boolean(initialRole));
  const [step, setStep] = useState(() => initialStep(initialRole, initialProfileSnapshot));
  const [profileSnapshot, setProfileSnapshot] = useState(initialProfileSnapshot);

  useEffect(() => {
    if (initialRole === "admin" || (initialRole && initialApplicationStatus !== "none")) {
      startRouteLoading();
      router.replace(buildAppHref("dashboard"));
    }
  }, [initialApplicationStatus, initialRole, router]);

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
    setProfileSnapshot(result.data.snapshot);
    router.refresh();

    return result;
  }

  async function finishOnboarding(payload: FormData) {
    const result = await saveOnboardingAction(payload);
    if (!result.ok) return result;

    const sessionRefresh = await refreshSessionFromTicket(result.data.ticket);
    if (!sessionRefresh.ok) return sessionRefresh;

    if (result.data.snapshot) setProfileSnapshot(result.data.snapshot);
    startRouteLoading();
    router.push(buildAppHref("dashboard"));
    router.refresh();

    return result;
  }

  if (initialRole === "admin" || (initialRole && initialApplicationStatus !== "none")) return null;

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
}: {
  accountEmail?: string;
  initialApplicationStatus: ApplicationStatus;
  initialProfileSnapshot: OnboardingProfileSnapshot;
  initialRole: AppRole | null;
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
    />
  );
}
