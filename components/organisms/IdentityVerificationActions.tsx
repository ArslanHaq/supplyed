"use client";

import Link from "next/link";

import type { MyIdentityVerification } from "@/features/identity-verification/types";

import { buttonClassName, Icon } from "../atoms";

/**
 * "Verify my identity", "Open TrustID" or "Waiting for TrustID", whichever
 * fits the teacher's latest check. Starting a check happens on
 * /verify-identity, where the teacher agrees to it. The TrustID journey opens
 * in the phone's own browser: it refuses to run in an iframe.
 */
export function IdentityVerificationActions({ identity }: { identity: MyIdentityVerification }) {
  const { canStart, verification } = identity;
  const status = verification?.status;

  return (
    <div className="flex flex-wrap gap-2">
      {canStart ? (
        <Link className={buttonClassName({ size: "sm" })} href="/verify-identity">
          <Icon name="shield" size={15} />
          Verify my identity
        </Link>
      ) : null}

      {status === "LINK_SENT" && verification?.guestLinkUrl ? (
        <>
          <a className={buttonClassName({ size: "sm" })} href={verification.guestLinkUrl} rel="noopener noreferrer" target="_blank">
            <Icon name="arrowRight" size={15} />
            Open TrustID
          </a>
          <Link className={buttonClassName({ size: "sm", variant: "secondary" })} href="/verify-identity">
            Show QR code
          </Link>
        </>
      ) : null}

      {status === "SUBMITTED" || status === "RESULTS_READY" ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted" role="status">
          <Icon className="animate-spin" name="loader" size={15} />
          Waiting for TrustID
        </span>
      ) : null}
    </div>
  );
}
