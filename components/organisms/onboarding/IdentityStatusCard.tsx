"use client";

import Link from "next/link";

import {
  describeIdentityState,
  identityCheckPending,
  identityStateTag,
} from "@/features/identity-verification/presentation";
import { useMyIdentityVerification } from "@/features/identity-verification/use-identity-verification";
import { cn } from "@/lib/cn";

import { buttonClassName, Icon, Tag } from "../../atoms";
import { IdentityVerificationActions } from "../IdentityVerificationActions";

/**
 * Where the teacher's identity check stands, above their documents. Identity
 * is its own step (/verify-identity); the teacher reaches the documents once
 * they have submitted to TrustID, and can send their profile for review once verified.
 */
export function IdentityStatusCard() {
  const { data: identity } = useMyIdentityVerification();

  if (!identity?.required) return null;

  const verified = identity.state === "VERIFIED";
  const tag = identityStateTag(identity.state);

  return (
    <div className={cn("rounded-xl border p-4 sm:p-5", verified ? "border-success bg-success-tint" : "border-brand-tint-2 bg-brand-tint")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white", verified ? "text-success" : "text-brand")}>
            <Icon name={verified ? "checkCircle" : "shield"} size={19} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold">{verified ? "Identity verified" : "Identity check"}</div>
              <Tag tone={tag.tone}>{tag.label}</Tag>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              {describeIdentityState(identity)}
              {identityCheckPending(identity.state)
                ? " You can upload your documents now, and send your profile for review once your identity is verified."
                : null}
            </p>
          </div>
        </div>
        {verified ? null : identity.state === "LINK_SENT" ? (
          <IdentityVerificationActions identity={identity} />
        ) : (
          <Link className={buttonClassName({ size: "sm", variant: "secondary" })} href="/verify-identity">
            View identity check
          </Link>
        )}
      </div>
    </div>
  );
}
