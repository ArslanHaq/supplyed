"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

import { defaultState } from "@/data/supplyed";
import { useOnboardingSnapshot } from "@/features/onboarding/use-onboarding";
import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref, shouldShowApplicationStatusPage } from "@/lib/routes";
import { loadTweaks, saveTweaks } from "@/lib/supplyed-preferences";
import { applyBrandTheme } from "@/lib/theme";
import type { AppPage, AppRole, ApplicationStatus, AppState, GoFn, RouteProps, ToastFn, Tweaks } from "@/types/supplyed";

import { ToastStack } from "../molecules";
import { ApplicationStatusPage } from "./ApplicationStatusPage";
import { AdminDashboard } from "./AdminDashboard";
import { AppChrome } from "./AppChrome";
import { ApplicationsPage } from "./ApplicationsWorkspacePage";
import { BillingPage } from "./BillingPage";
import { BookingsPage } from "./BookingsPage";
import { CalendarPage } from "./CalendarPage";
import { FindJobsPage } from "./FindJobsPage";
import { FindTeachersPage } from "./FindTeachersPage";
import { InstitutionDashboard } from "./InstitutionDashboard";
import { InstitutionProfilePage } from "./InstitutionProfilePage";
import { JobDetailPage } from "./JobDetailPage";
import { MessagingPage } from "./MessagingPage";
import { PostJobPage } from "./PostJobPage";
import { SecurityPage } from "./SecurityPage";
import { SettingsPage } from "./SettingsPage";
import { TeacherDashboard } from "./TeacherDashboard";
import { TeacherApplicationsPage } from "./TeacherApplicationsPage";
import { PublicTeacherProfilePage as TeacherProfilePage } from "./PublicTeacherProfilePage";
import { TweaksPanel } from "./TweaksPanel";

function readContext(searchParams: URLSearchParams) {
  return {
    applicationId: searchParams.get("applicationId") || undefined,
    institutionId: searchParams.get("institutionId") || undefined,
    jobId: searchParams.get("jobId") || undefined,
    search: searchParams.get("search") || undefined,
    teacherId: searchParams.get("teacherId") || undefined,
  };
}

type SessionRouteState = {
  applicationStatus: ApplicationStatus;
  email: string;
  name?: string | null;
  role: AppRole;
};

function createInitialRouteState(page: AppPage, sessionState: SessionRouteState): AppState {
  return {
    ...defaultState,
    accountName: sessionState.name?.trim() || undefined,
    applicationStatus: sessionState.applicationStatus,
    auth: "signed-in",
    onboardingComplete: true,
    page,
    role: sessionState.role,
    roleSelected: true,
    signupEmail: sessionState.email,
    signupVerified: true,
    toasts: [],
  };
}

function RouteShell({ page, sessionState }: { page: AppPage; sessionState: SessionRouteState }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localState, setState] = useState<AppState>(() => createInitialRouteState(page, sessionState));
  const onboardingQuery = useOnboardingSnapshot(sessionState.email, { enabled: sessionState.role !== "admin" });
  // Ignore a cached result until this visit has checked the latest documents.
  const onboarding = onboardingQuery.isSuccess && onboardingQuery.isFetchedAfterMount ? onboardingQuery.data : undefined;
  const state: AppState = {
    ...localState,
    accountName: sessionState.name?.trim() || localState.accountName,
    applicationStatus: onboarding?.applicationStatus ?? sessionState.applicationStatus,
    role: sessionState.role === "admin" ? "admin" : onboarding?.role ?? sessionState.role,
    signupEmail: sessionState.email,
  };
  const [tweaks, setTweaks] = useState<Tweaks>(loadTweaks);
  const routeCtx = useMemo(() => readContext(searchParams), [searchParams]);
  const activePage = page;

  useEffect(() => {
    if (sessionState.role !== "admin" && onboarding?.completed === false) {
      startRouteLoading();
      router.replace("/onboarding");
    }
  }, [onboarding?.completed, router, sessionState.role]);

  useEffect(() => {
    applyBrandTheme(tweaks.accent);
    saveTweaks(tweaks);
  }, [tweaks]);

  const dismissToast = useCallback((id: string) => {
    setState((current) => ({ ...current, toasts: current.toasts.filter((item) => item.id !== id) }));
  }, []);

  const toast = useCallback<ToastFn>((entry) => {
    const id = Math.random().toString(36).slice(2);
    setState((current) => ({ ...current, toasts: [...current.toasts, { id, ...entry }] }));
  }, []);

  const go: GoFn = (page, ctx = {}) => {
    setState((current) => ({ ...current, page, ctx: { ...current.ctx, ...ctx }, auth: "signed-in" }));
    startRouteLoading();
    router.push(buildAppHref(page, ctx));
  };

  function goHome() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    startRouteLoading();
    router.push("/");
  }

  async function logout() {
    await signOut({ redirect: false });
    startRouteLoading();
    router.push("/login");
  }

  const routeProps: RouteProps = {
    go,
    toast,
    state: { ...state, auth: "signed-in", page: activePage, ctx: routeCtx },
    setState,
    ctx: routeCtx,
    role: state.role,
    tweaks,
  };

  if (sessionState.role !== "admin" && onboarding?.completed === false) {
    return <p role="status" className="p-6 text-muted">Returning to profile setup...</p>;
  }

  let content: ReactNode = null;
  if (activePage === "settings") {
    content = <SettingsPage {...routeProps} verified={onboarding?.verified === true} />;
  } else if (state.role === "institution") {
    if (activePage === "dashboard") content = <InstitutionDashboard {...routeProps} />;
    else if (activePage === "post-job") content = <PostJobPage {...routeProps} />;
    else if (activePage === "applications") content = <ApplicationsPage {...routeProps} />;
    else if (activePage === "bookings") content = <BookingsPage {...routeProps} />;
    else if (activePage === "find-teachers") content = <FindTeachersPage key={routeCtx.search ?? "all-teachers"} {...routeProps} />;
    else if (activePage === "teacher-profile") content = <TeacherProfilePage {...routeProps} />;
    else if (activePage === "institution-profile") content = <InstitutionProfilePage {...routeProps} />;
    else if (activePage === "messaging") content = <MessagingPage {...routeProps} />;
    else if (activePage === "security") content = <SecurityPage {...routeProps} />;
    else if (activePage === "billing") content = <BillingPage {...routeProps} />;
    else if (activePage === "job-detail") content = <JobDetailPage {...routeProps} />;
    else content = <InstitutionDashboard {...routeProps} />;
  } else if (state.role === "teacher") {
    if (activePage === "dashboard") content = <TeacherDashboard {...routeProps} />;
    else if (activePage === "find-jobs") content = <FindJobsPage {...routeProps} />;
    else if (activePage === "applications") content = <TeacherApplicationsPage {...routeProps} />;
    else if (activePage === "bookings") content = <BookingsPage {...routeProps} />;
    else if (activePage === "job-detail") content = <JobDetailPage {...routeProps} />;
    else if (activePage === "calendar") content = <CalendarPage />;
    else if (activePage === "teacher-profile") content = <TeacherProfilePage {...routeProps} />;
    else if (activePage === "institution-profile") content = <InstitutionProfilePage {...routeProps} />;
    else if (activePage === "messaging") content = <MessagingPage {...routeProps} />;
    else if (activePage === "security") content = <SecurityPage {...routeProps} />;
    else if (activePage === "billing") content = <BillingPage {...routeProps} />;
    else content = <TeacherDashboard {...routeProps} />;
  } else if (state.role === "admin") {
    if (activePage === "security") content = <SecurityPage {...routeProps} />;
    else if (activePage === "billing") content = <BillingPage {...routeProps} />;
    else content = <AdminDashboard />;
  }

  if (shouldShowApplicationStatusPage(routeProps.state.role, routeProps.state.applicationStatus)) {
    return (
      <ApplicationStatusPage
        state={routeProps.state}
        onLanding={goHome}
        onLogout={logout}
      />
    );
  }

  return (
    <>
      <AppChrome
        verified={onboarding?.verified === true}
        state={routeProps.state}
        go={go}
        onLanding={goHome}
        onLogout={logout}
        onSettings={() => go("settings")}
      >
        {content}
      </AppChrome>
      <TweaksPanel state={routeProps.state} setState={setState} tweaks={tweaks} setTweaks={setTweaks} />
      <ToastStack autoCloseMs={3200} onDismiss={dismissToast} toasts={state.toasts} />
    </>
  );
}

export function AppRouteShellClient({ page, sessionState }: { page: AppPage; sessionState: SessionRouteState }) {
  return <RouteShell page={page} sessionState={sessionState} />;
}
