"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { buildAppHref } from "@/lib/routes";
import { loadAppState, loadTweaks, saveAppState, saveTweaks } from "@/lib/supplyed-storage";
import { applyBrandTheme } from "@/lib/theme";
import type { AppPage, AppState, GoFn, RouteProps, ToastFn, Tweaks } from "@/types/supplyed";

import { ToastStack } from "../molecules";
import { AdminDashboard } from "./AdminDashboard";
import { AppChrome } from "./AppChrome";
import { ApplicationsPage } from "./ApplicationsPage";
import { BillingPage } from "./BillingPage";
import { CalendarPage } from "./CalendarPage";
import { FindJobsPage } from "./FindJobsPage";
import { FindTeachersPage } from "./FindTeachersPage";
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

function RouteShell({ page }: { page: AppPage }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [state, setState] = useState<AppState>(loadAppState);
  const [tweaks, setTweaks] = useState<Tweaks>(loadTweaks);
  const routeCtx = useMemo(() => readContext(searchParams), [searchParams]);
  const activePage = page;

  useEffect(() => {
    if (!isClient) return;
    saveAppState({
      ...state,
      auth: "signed-in",
      page: activePage,
      ctx: routeCtx,
    });
  }, [state, isClient, activePage, routeCtx]);

  useEffect(() => {
    if (!isClient) return;
    applyBrandTheme(tweaks.accent);
    saveTweaks(tweaks);
  }, [tweaks, isClient]);

  const toast: ToastFn = (entry) => {
    const id = Math.random().toString(36).slice(2);
    setState((current) => ({ ...current, toasts: [...current.toasts, { id, ...entry }] }));
    window.setTimeout(() => {
      setState((current) => ({ ...current, toasts: current.toasts.filter((item) => item.id !== id) }));
    }, 3200);
  };

  const go: GoFn = (page, ctx = {}) => {
    setState((current) => ({ ...current, page, ctx: { ...current.ctx, ...ctx }, auth: "signed-in" }));
    router.push(buildAppHref(page, ctx));
  };

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
  } else {
    content = activePage === "messaging" ? <MessagingPage {...routeProps} /> : <AdminDashboard />;
  }

  if (!isClient) return null;

  return (
    <>
      <AppChrome
        state={routeProps.state}
        setState={setState}
        go={go}
        onLanding={() => {
          const nextState: AppState = { ...state, auth: "landing" };
          setState(nextState);
          saveAppState(nextState);
          router.push("/");
        }}
      >
        {content}
      </AppChrome>
      <TweaksPanel state={routeProps.state} setState={setState} tweaks={tweaks} setTweaks={setTweaks} />
      <ToastStack toasts={state.toasts} />
    </>
  );
}

export function AppRouteShellClient({ page }: { page: AppPage }) {
  return <RouteShell page={page} />;
}
