"use client";

import type { ReactNode } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

import { defaultState } from "@/data/supplyed";
import { WorkspaceAccountProvider } from "@/features/auth/workspace-account";
import { useOnboardingSnapshot } from "@/features/onboarding/use-onboarding";
import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref, shouldShowApplicationStatusPage } from "@/lib/routes";
import { useTweaks } from "@/lib/use-tweaks";
import type { AppPage, AppRole, ApplicationStatus, AppState, GoFn, RouteContext, RouteProps, ToastFn } from "@/types/supplyed";
import { SectionLoader, ToastStack } from "../molecules";
import { ApplicationStatusPage } from "./ApplicationStatusPage";
import { AppChrome } from "./AppChrome";
import { TweaksPanel } from "./TweaksPanel";

const AdminDashboard = lazy(async () => ({ default: (await import("./AdminDashboard")).AdminDashboard }));
const ApplicationsPage = lazy(async () => ({ default: (await import("./ApplicationsWorkspacePage")).ApplicationsPage }));
const BillingPage = lazy(async () => ({ default: (await import("./BillingPage")).BillingPage }));
const BookingsPage = lazy(async () => ({ default: (await import("./BookingsPage")).BookingsPage }));
const CalendarPage = lazy(async () => ({ default: (await import("./CalendarPage")).CalendarPage }));
const FindJobsPage = lazy(async () => ({ default: (await import("./FindJobsPage")).FindJobsPage }));
const FindTeachersPage = lazy(async () => ({ default: (await import("./FindTeachersPage")).FindTeachersPage }));
const InstitutionDashboard = lazy(async () => ({ default: (await import("./InstitutionDashboard")).InstitutionDashboard }));
const InstitutionProfilePage = lazy(async () => ({ default: (await import("./InstitutionProfilePage")).InstitutionProfilePage }));
const JobDetailPage = lazy(async () => ({ default: (await import("./JobDetailPage")).JobDetailPage }));
const JobInvitationsPage = lazy(async () => ({ default: (await import("./JobInvitationsPage")).JobInvitationsPage }));
const MessagingPage = lazy(async () => ({ default: (await import("./MessagingPage")).MessagingPage }));
const MyProfilePage = lazy(async () => ({ default: (await import("./MyProfilePage")).MyProfilePage }));
const PostJobPage = lazy(async () => ({ default: (await import("./PostJobPage")).PostJobPage }));
const SecurityPage = lazy(async () => ({ default: (await import("./SecurityPage")).SecurityPage }));
const SettingsPage = lazy(async () => ({ default: (await import("./SettingsPage")).SettingsPage }));
const TeacherDashboard = lazy(async () => ({ default: (await import("./TeacherDashboard")).TeacherDashboard }));
const TeacherApplicationsPage = lazy(async () => ({ default: (await import("./TeacherApplicationsPage")).TeacherApplicationsPage }));
const TeacherProfilePage = lazy(async () => ({ default: (await import("./PublicTeacherProfilePage")).PublicTeacherProfilePage }));

function readContext(searchParams: URLSearchParams) {
  return {
    applicationId: searchParams.get("applicationId") || undefined,
    bookingId: searchParams.get("bookingId") || undefined,
    conversationId: searchParams.get("conversationId") || undefined,
    institutionId: searchParams.get("institutionId") || undefined,
    jobId: searchParams.get("jobId") || undefined,
    search: searchParams.get("search") || undefined,
    teacherId: searchParams.get("teacherId") || undefined,
  };
}

type SessionRouteState = {
  id: string;
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

function RouteShell({ page, sessionState, initialContext }: { page: AppPage; sessionState: SessionRouteState; initialContext?: RouteContext }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localState, setState] = useState<AppState>(() => createInitialRouteState(page, sessionState));
  const onboardingQuery = useOnboardingSnapshot(sessionState.email, { enabled: sessionState.role !== "admin" });
  // The server seeds this account's query after its authoritative access check.
  // Keep the last successful display status during a background retry.
  const onboarding = onboardingQuery.data;
  const state: AppState = {
    ...localState,
    accountName: sessionState.name?.trim() || localState.accountName,
    applicationStatus: onboarding?.applicationStatus ?? sessionState.applicationStatus,
    role: sessionState.role === "admin" ? "admin" : onboarding?.role ?? sessionState.role,
    signupEmail: sessionState.email,
  };
  const [tweaks, setTweaks] = useTweaks();
  const routeCtx = useMemo(() => ({ ...readContext(searchParams), ...initialContext }), [searchParams, initialContext]);
  const activePage = page;

  useEffect(() => {
    if (sessionState.role !== "admin" && onboarding?.completed === false) {
      startRouteLoading();
      router.replace(page === "job-invitations" ? `/onboarding?returnTo=${encodeURIComponent(buildAppHref(page, initialContext))}` : "/onboarding");
    }
  }, [onboarding?.completed, router, sessionState.role, page, initialContext]);

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
  if (activePage === "job-invitations") {
    content = <JobInvitationsPage key={routeCtx.invitationId ?? "all"} {...routeProps} />;
  } else if (activePage === "settings") {
    content = <SettingsPage {...routeProps} verified={onboarding?.verified === true} />;
  } else if (activePage === "my-profile" && state.role !== "admin") {
    content = <MyProfilePage {...routeProps} />;
  } else if (state.role === "institution") {
    if (activePage === "dashboard") content = <InstitutionDashboard {...routeProps} />;
    else if (activePage === "post-job") content = <PostJobPage {...routeProps} />;
    else if (activePage === "applications") content = <ApplicationsPage {...routeProps} />;
    else if (activePage === "bookings") content = <BookingsPage key={routeCtx.bookingId ?? routeCtx.jobId ?? "all-bookings"} {...routeProps} />;
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
    else if (activePage === "bookings") content = <BookingsPage key={routeCtx.bookingId ?? routeCtx.jobId ?? "all-bookings"} {...routeProps} />;
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
    <WorkspaceAccountProvider key={sessionState.id} value={{ id: sessionState.id, role: state.role, applicationStatus: state.applicationStatus }}>
      <AppChrome
        verified={onboarding?.verified === true}
        state={routeProps.state}
        go={go}
        onLanding={goHome}
        onLogout={logout}
        onSettings={() => go("settings")}
        onTheme={() => setState((current) => ({ ...current, tweaksOpen: true }))}
      >
        <Suspense fallback={<WorkspaceScreenLoader />}>
          {content}
        </Suspense>
      </AppChrome>
      <TweaksPanel state={routeProps.state} setState={setState} tweaks={tweaks} setTweaks={setTweaks} />
      <ToastStack autoCloseMs={3200} onDismiss={dismissToast} toasts={state.toasts} />
    </WorkspaceAccountProvider>
  );
}

function WorkspaceScreenLoader() {
  return (
    <div className="app-page" aria-label="Loading workspace screen" role="status">
      <div className="mb-7 h-9 w-64 max-w-full rounded-md bg-border" aria-hidden="true" />
      <SectionLoader rows={4} />
    </div>
  );
}

export function AppRouteShellClient({ page, sessionState, initialContext }: { page: AppPage; sessionState: SessionRouteState; initialContext?: RouteContext }) {
  return <RouteShell page={page} sessionState={sessionState} initialContext={initialContext} />;
}
