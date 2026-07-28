"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { refreshApplicationStatusAction } from "@/features/auth/actions";
import { startRouteLoading } from "@/lib/navigation-loading";
import { getAuthenticatedEntryHref, isApprovedApplicationStatus } from "@/lib/routes";
import type { AppState } from "@/types/supplyed";

import { Btn, Icon, Logo, Tag } from "../atoms";

const statusPollMs = 30_000;

function statusCopy(status: AppState["applicationStatus"]) {
  if (status === "rejected") {
    return {
      tag: "Action needed",
      title: "Your application needs updates.",
      copy: "The review team needs more information before approval.",
      icon: "file",
    };
  }

  if (status === "suspended") {
    return {
      tag: "Account paused",
      title: "This account is currently suspended.",
      copy: "Please contact support before continuing to the workspace.",
      icon: "shield",
    };
  }

  return {
    tag: "In review",
    title: "Your application is in review.",
    copy: "SupplyED is checking the submitted profile and verification details. You will get access once the account is approved.",
    icon: "clock",
  };
}

export function ApplicationStatusPage({ state, onLanding, onLogout }: { state: AppState; onLanding: () => void; onLogout: () => void }) {
  const router = useRouter();
  const checkingRef = useRef(false);
  const mountedRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>();
  const copy = statusCopy(state.applicationStatus);
  const roleLabel = state.role === "teacher" ? "Teacher application" : state.role === "institution" ? "School workspace" : "Account";
  const canRefreshStatus = state.applicationStatus === "pending_review";

  const checkStatus = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (checkingRef.current) return;

      checkingRef.current = true;
      if (!quiet) {
        setChecking(true);
        setStatusMessage(undefined);
      }

      try {
        const result = await refreshApplicationStatusAction();
        if (!mountedRef.current) return;

        if (!result.ok) {
          if (!quiet) setStatusMessage(result.message);
          return;
        }

        const sessionResult = await signIn("credentials", {
          flow: "verified-email-session",
          redirect: false,
          redirectTo: "/post-auth",
          ticket: result.data.ticket,
        });
        if (!mountedRef.current) return;

        if (!sessionResult?.ok) {
          if (!quiet) setStatusMessage("Your status was checked, but the session could not be refreshed. Sign in again to continue.");
          return;
        }

        if (isApprovedApplicationStatus(result.data.applicationStatus)) {
          startRouteLoading();
          router.replace(
            getAuthenticatedEntryHref({
              applicationStatus: result.data.applicationStatus,
              role: result.data.role,
            }),
          );
          router.refresh();
          return;
        }

        if (!quiet) setStatusMessage(result.message || "Your application is still in review.");
      } catch (error) {
        if (!quiet && mountedRef.current) {
          setStatusMessage(error instanceof Error && error.message ? error.message : "We could not check your application status.");
        }
      } finally {
        checkingRef.current = false;
        if (mountedRef.current) setChecking(false);
      }
    },
    [router],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canRefreshStatus) return;

    const interval = window.setInterval(() => {
      void checkStatus({ quiet: true });
    }, statusPollMs);
    const handleFocus = () => {
      void checkStatus({ quiet: true });
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [canRefreshStatus, checkStatus]);

  return (
    <div className="min-h-screen bg-chalk">
      <header className="flex min-h-[76px] items-center justify-between border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-12">
        <Logo size={20} onClick={onLanding} />
        <div className="flex items-center gap-2">
          <Btn variant="secondary" onClick={onLanding}>
            View Home
          </Btn>
          <Btn variant="ghost" onClick={onLogout}>
            Logout
          </Btn>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-76px)] max-w-[960px] items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-xl border border-border bg-white p-6 shadow-(--shadow-xs) sm:p-9">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-tint text-brand">
            <Icon name={copy.icon} size={26} />
          </div>
          <Tag>{copy.tag}</Tag>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-[48px]">{copy.title}</h1>
          <p className="mt-4 max-w-[640px] text-base leading-7 text-muted">{copy.copy}</p>

          <div className="mt-7 grid gap-3 rounded-xl border border-border bg-chalk p-4 sm:grid-cols-3">
            <div>
              <div className="label-xs">Application</div>
              <div className="mt-1 font-semibold">{roleLabel}</div>
            </div>
            <div>
              <div className="label-xs">Email</div>
              <div className="mt-1 truncate font-semibold">{state.signupEmail || "Verified"}</div>
            </div>
            <div>
              <div className="label-xs">Status</div>
              <div className="mt-1 font-semibold capitalize">{state.applicationStatus.replace("_", " ")}</div>
            </div>
          </div>

          {statusMessage ? (
            <div className="mt-6 rounded-xl border border-border bg-chalk px-4 py-3 text-sm font-semibold text-muted">
              {statusMessage}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            {canRefreshStatus ? (
              <Btn icon="clock" loading={checking} loadingLabel="Checking status" onClick={() => void checkStatus()}>
                Check approval
              </Btn>
            ) : null}
            <Btn icon="message" variant={canRefreshStatus ? "secondary" : "primary"}>Contact support</Btn>
            <Btn variant="secondary" onClick={onLanding}>
              Back to Home
            </Btn>
            <Btn variant="ghost" onClick={onLogout}>
              Logout
            </Btn>
          </div>
        </section>
      </main>
    </div>
  );
}
