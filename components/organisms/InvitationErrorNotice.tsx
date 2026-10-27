"use client";

import { useCallback, useState } from "react";
import { reportSchoolInactive } from "@/features/auth/use-school-hiring";
import { recordRateLimit } from "@/lib/rate-limit";
import { userFacingError } from "@/lib/user-facing-error";
import { Icon } from "../atoms";

type InvitationError = { message: string; status?: number; requestId?: string; code?: string; retryAfter?: number };

export function useInvitationError() {
  const [error, updateError] = useState<InvitationError | null>(null);
  const setError = useCallback((message: string, details: Omit<InvitationError, "message"> = {}) => {
    recordRateLimit(details);
    reportSchoolInactive(details);
    updateError(message ? { message, status: details.status, requestId: details.requestId } : null);
  }, []);
  return [error, setError] as const;
}

export function InvitationErrorNotice({ error }: { error: InvitationError }) {
  const message = userFacingError(error.message, { status: error.status });
  const conflict = /already booked during these dates/i.test(message);
  return (
    <div className="my-4 rounded-xl border border-danger/20 bg-danger-tint p-4 sm:p-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface text-danger" aria-hidden="true"><Icon name={conflict ? "calendar" : "help"} size={21} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-6 text-ink">{conflict ? "Teacher unavailable" : "We couldn’t complete this request"}</h3>
          <p className="mt-1 break-words text-sm leading-6 text-slate">{message}</p>
        </div>
      </div>
    </div>
  );
}
