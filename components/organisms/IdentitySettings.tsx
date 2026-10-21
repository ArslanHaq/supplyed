"use client";

import { describeIdentityState, identityStateTag } from "@/features/identity-verification/presentation";
import { useMyIdentityVerification } from "@/features/identity-verification/use-identity-verification";

import { Icon, Tag } from "../atoms";
import { IdentityVerificationActions } from "./IdentityVerificationActions";

/** The teacher's TrustID identity and right to work check, in Settings. Render only for teachers. */
export function IdentitySettings() {
  const query = useMyIdentityVerification();
  const identity = query.data;
  const tag = identity ? identityStateTag(identity.state) : null;

  return (
    <section aria-labelledby="identity-settings-heading" className="card card-pad-lg" id="identity-settings">
      <div className="account-section-icon"><Icon name="shield" size={20} /></div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl leading-tight" id="identity-settings-heading">Identity verification</h2>
            {tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : null}
          </div>
          <p className="mt-2 max-w-[660px] text-sm leading-6 text-muted">
            {identity ? describeIdentityState(identity) : query.isLoading ? "Checking your identity verification..." : null}
          </p>
          <p className="mt-1 text-xs font-medium text-muted">Verified by TrustID. Required before your profile can be approved.</p>
        </div>
      </div>
      <div className="mt-5">
        {identity ? <IdentityVerificationActions identity={identity} /> : null}
        {query.isError ? (
          <div className="mt-2 text-xs font-semibold text-danger" role="alert">
            Your identity check status could not be loaded.{" "}
            <button className="underline" onClick={() => void query.refetch()} type="button">Retry</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
