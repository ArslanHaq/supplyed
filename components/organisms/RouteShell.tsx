"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

import { defaultState } from "@/data/supplyed";
import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref } from "@/lib/routes";
import { loadTweaks, saveTweaks } from "@/lib/supplyed-preferences";
import { applyBrandTheme } from "@/lib/theme";
import { useMounted } from "@/lib/use-mounted";
import type { AppPage, AppRole, ApplicationStatus, AppState, GoFn, RouteProps, ToastFn, Tweaks } from "@/types/supplyed";

import { PageLoader, ToastStack } from "../molecules";
import { AdminDashboard } from "./AdminDashboard";
import { ApplicationStatusPage } from "./ApplicationStatusPage";
import { AppChrome } from "./AppChrome";
import { ApplicationsPage } from "./ApplicationsPage";
import { BillingPage } from "./BillingPage";
import { CalendarPage } from "./CalendarPage";
import { FindJobsPage } from "./FindJobsPage";
import { FindTeachersPage } from "./FindTeachersPage";
import { IndividualDashboard } from "./IndividualDashboard";
import { InstitutionDashboard } from "./InstitutionDashboard";
import { JobDetailPage } from "./JobDetailPage";
import { MessagingPage } from "./MessagingPage";
import { PostJobPage } from "./PostJobPage";
import { TeacherDashboard } from "./TeacherDashboard";
import { TeacherProfilePage } from "./TeacherProfilePage";
import { TweaksPanel } from "./TweaksPanel";

function readContext(searchParams: URLSearchParams) {
  return {
    jobId: searchParams.get("jobId") || undefined,
    teacherId: searchParams.get("teacherId") || undefined,
  };
}

type SessionRouteState = {
  applicationStatus: ApplicationStatus;
  email: string;
  role: AppRole;
};

function createInitialRouteState(page: AppPage, sessionState: SessionRouteState): AppState {
  return {
    ...defaultState,
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
  const isClient = useMounted();
  const [state, setState] = useState<AppState>(() => createInitialRouteState(page, sessionState));
  const [tweaks, setTweaks] = useState<Tweaks>(loadTweaks);
  const routeCtx = useMemo(() => readContext(searchParams), [searchParams]);
  const activePage = page;

  useEffect(() => {
    if (!isClient) return;
    applyBrandTheme(tweaks.accent);
    saveTweaks(tweaks);
  }, [tweaks, isClient]);

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

  let content: ReactNode = null;
  if (state.role === "institution") {
    if (activePage === "dashboard") content = <InstitutionDashboard {...routeProps} />;
    else if (activePage === "post-job") content = <PostJobPage {...routeProps} />;
    else if (activePage === "applications") content = <ApplicationsPage {...routeProps} />;
    else if (activePage === "find-teachers") content = <FindTeachersPage {...routeProps} />;
    else if (activePage === "teacher-profile") content = <TeacherProfilePage {...routeProps} />;
    else if (activePage === "messaging") content = <MessagingPage {...routeProps} />;
    else if (activePage === "billing") content = <BillingPage />;
    else if (activePage === "job-detail") content = <JobDetailPage {...routeProps} />;
    else content = <InstitutionDashboard {...routeProps} />;
  } else if (state.role === "teacher") {
    if (activePage === "dashboard") content = <TeacherDashboard {...routeProps} />;
    else if (activePage === "find-jobs") content = <FindJobsPage {...routeProps} />;
    else if (activePage === "job-detail") content = <JobDetailPage {...routeProps} />;
    else if (activePage === "calendar") content = <CalendarPage />;
    else if (activePage === "teacher-profile") content = <TeacherProfilePage {...routeProps} />;
    else if (activePage === "messaging") content = <MessagingPage {...routeProps} />;
    else content = <TeacherDashboard {...routeProps} />;
  } else if (state.role === "individual") {
    if (activePage === "dashboard") content = <IndividualDashboard {...routeProps} />;
    else if (activePage === "find-teachers") content = <FindTeachersPage {...routeProps} />;
    else if (activePage === "teacher-profile") content = <TeacherProfilePage {...routeProps} />;
    else if (activePage === "messaging") content = <MessagingPage {...routeProps} />;
    else if (activePage === "calendar") content = <CalendarPage />;
    else if (activePage === "billing") content = <BillingPage />;
    else content = <IndividualDashboard {...routeProps} />;
  } else {
    content = activePage === "messaging" ? <MessagingPage {...routeProps} /> : <AdminDashboard />;
  }

  if (!isClient) {
    return (
      <PageLoader
        compact
        description="Restoring your saved role, workspace, and theme."
        title="Preparing workspace"
      />
    );
  }

  if (
    routeProps.state.role !== "individual" &&
    (routeProps.state.applicationStatus === "pending_review" ||
      routeProps.state.applicationStatus === "rejected" ||
      routeProps.state.applicationStatus === "suspended")
  ) {
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
        state={routeProps.state}
        setState={setState}
        go={go}
        onLanding={goHome}
        onLogout={logout}
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
