"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buttonClassName } from "../atoms";

export function WorkspaceStatusUnavailable({ retryAfter }: { retryAfter: number }) {
  const router = useRouter();
  const rateLimited = retryAfter > 0;
  const [seconds, setSeconds] = useState(Math.max(0, Math.ceil(retryAfter)));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!rateLimited) return;
    const deadline = Date.now() + retryAfter * 1000;
    const timer = window.setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [rateLimited, retryAfter]);

  return (
    <main className="mx-auto max-w-xl px-6 py-16" aria-labelledby="workspace-status-heading">
      <h1 id="workspace-status-heading" className="text-2xl font-semibold">Account check temporarily unavailable</h1>
      <p className="mt-4">{rateLimited ? "We need to confirm your account status before opening this page. Too many checks were made recently; your account has not been signed out." : "The account-status service is temporarily unavailable. Your account is safe and you have not been signed out."}</p>
      <p className="mt-3" role="status" aria-live="off">{seconds > 0 ? `You can retry in ${seconds} seconds.` : "Please try the account check again."}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className={buttonClassName({ variant: "primary" })} disabled={seconds > 0 || pending}
          onClick={() => startTransition(() => router.refresh())}>
          {pending ? "Checking account…" : "Retry account check"}
        </button>
        <Link className={buttonClassName({ variant: "ghost" })} href="/">Return to homepage</Link>
      </div>
    </main>
  );
}
