"use client";
import { apiErrorDetails } from "@/lib/api-error-details";
import { recordRateLimit, useRateLimit } from "@/lib/rate-limit";

import { useEffect, useState } from "react";

import { Btn, Checkbox, Field, Icon, Logo, Tag } from "../atoms";
import { Modal } from "../molecules";

type ApprovalStatus = "APPROVED" | "DECLINED" | "EXPIRED" | "PENDING" | "REVOKED";
type ApprovalReview = {
  expiresAt: string;
  requestedBy: string;
  school: { address: string; city: string; domain: string; name: string; postalCode: string | null; registrationId: string | null };
  complianceName: string;
  status: ApprovalStatus;
  termsVersion: string;
  termsText: string;
};


function decidedRequestCopy(status: ApprovalStatus) {
  if (status === "APPROVED") return "This school has already been approved. No further action is needed.";
  if (status === "DECLINED") return "This request has already been declined. Contact the school if it needs to send a new request.";
  if (status === "EXPIRED") return "This approval link expired before a decision was recorded. Ask the school to send a new request.";
  return "This approval request is no longer valid because it was replaced or the school or compliance details changed.";
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(" ") : payload?.message;
    const error = Object.assign(new Error(message || (response.status === 410 ? "This approval link has expired." : "This approval link is not valid.")), { status: response.status, code: payload?.code, requestId: payload?.meta?.requestId, ...apiErrorDetails(payload, response.headers.get("Retry-After")) });
    recordRateLimit(error);
    throw error;
  }
  return payload as ApprovalReview;
}

export function ComplianceApprovalPage({ token }: { token: string }) {
  const retryAfter = useRateLimit();
  const [approval, setApproval] = useState<ApprovalReview>();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [reasonError, setReasonError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function load() {
    setError(undefined);
    try {
      setApproval(await readResponse(await fetch(`/api/compliance-approvals/${encodeURIComponent(token)}`, { cache: "no-store" })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "This approval link is not valid.");
    }
  }

  useEffect(() => {
    let active = true;

    void fetch(`/api/compliance-approvals/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(readResponse)
      .then((value) => {
        if (active) setApproval(value);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "This approval link is not valid.");
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function decide(action: "approve" | "decline") {
    if (pending || retryAfter || approval?.status !== "PENDING") return;
    if (action === "approve" && !acceptTerms) {
      setError("Accept the compliance approval terms before approving this school.");
      return;
    }
    if (action === "decline" && (!reason.trim() || reason.trim().length > 1000)) {
      setReasonError("Explain why you are declining this request (up to 1,000 characters).");
      return;
    }

    setPending(true);
    setError(undefined);
    setReasonError(undefined);
    try {
      setApproval(await readResponse(await fetch(`/api/compliance-approvals/${encodeURIComponent(token)}`, {
        body: JSON.stringify({ acceptTerms, action, reason: reason.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }))); 
      setDeclining(false);
      setApproveOpen(false);
    } catch (decisionError) {
      const decisionMessage = decisionError instanceof Error ? decisionError.message : "The response could not be recorded.";
      await load();
      setError(decisionMessage);
    } finally {
      setPending(false);
    }
  }

  const isPending = approval?.status === "PENDING";

  return (
    <>
      <main className="marketing-approval min-h-screen px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="marketing-approval-header"><Logo href="/" size={24} /><span><Icon name="lock" size={14} /> Secure approval link</span></div>
        <div className="marketing-approval-card mt-8 border border-border bg-surface p-6 sm:p-9">
          <Tag tone={approval?.status === "APPROVED" ? "green" : approval?.status === "DECLINED" ? "red" : "amber"}>
            School compliance approval
          </Tag>
          <h1 className="mt-4 font-heading text-3xl sm:text-4xl">Review this school?s workspace request.</h1>

          {!approval && !error ? <div role="status"><p className="mt-6 text-sm text-muted">Checking this secure approval link...</p><div className="marketing-approval-loading" aria-hidden="true"><span /><span /><span /></div></div> : null}
          {error ? <div className="mt-6 rounded-xl border border-danger bg-danger-tint p-4 text-sm font-semibold text-danger" role="alert">{error}</div> : null}

          {approval ? (
            <div className="mt-7 space-y-6">
              <div className="marketing-approval-details grid rounded-xl border border-border sm:grid-cols-2">
                <Detail label="School" value={approval.school.name} />
                <Detail label="Address" value={approval.school.address} />
                <Detail label="School domain" value={approval.school.domain} />
                <Detail label="City" value={approval.school.city} />
                <Detail label="Requested by" value={approval.requestedBy} />
                <Detail label="Compliance contact" value={approval.complianceName} />
              </div>

              {isPending ? (
                <>
                  <div>
                    <h2 className="font-heading text-2xl">Approval terms</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {approval.termsText}
                    </p>
                    <p className="mt-2 text-xs text-muted">Terms version {approval?.termsVersion}. Link expires {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(approval.expiresAt))}.</p>
                  </div>
                  {declining ? (
                    <Field error={reasonError} label="Reason for declining" required>
                      <textarea className="textarea mt-2" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                    </Field>
                  ) : null}
                  <div className="marketing-approval-actions flex flex-col gap-3 sm:flex-row sm:justify-end">
                    {declining ? (
                      <>
                        <Btn variant="ghost" disabled={pending || Boolean(retryAfter)} onClick={() => setDeclining(false)}>Cancel</Btn>
                        <Btn variant="danger" disabled={Boolean(retryAfter)} loading={pending} onClick={() => void decide("decline")}>Confirm decline</Btn>
                      </>
                    ) : (
                      <>
                        <Btn variant="secondary" disabled={pending || Boolean(retryAfter)} onClick={() => setDeclining(true)}>Decline</Btn>
                        <Btn disabled={pending || Boolean(retryAfter)} onClick={() => {
                          setAcceptTerms(false);
                          setError(undefined);
                          setApproveOpen(true);
                        }}>Approve school</Btn>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-chalk p-5" role="status">
                  <div className="font-semibold">This request is {approval.status.toLowerCase()}.</div>
                  <p className="mt-1 text-sm text-muted">{decidedRequestCopy(approval.status)}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      </main>

      <Modal open={approveOpen} onClose={() => {
        if (!pending) setApproveOpen(false);
      }}>
        <div className="p-6 sm:p-8">
          <Tag tone="amber">Final confirmation</Tag>
          <h2 className="mt-4 font-heading text-2xl">Approve this school?</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            You are approving <strong className="text-ink">{approval?.school.name}</strong> to submit its SupplyED workspace application for admin review. This does not activate the school automatically.
          </p>
          <div className="mt-5 rounded-xl border border-border bg-chalk p-4 text-sm leading-6 text-muted">
            {approval?.termsText}
            <div className="mt-2 text-xs">Terms version {approval?.termsVersion}</div>
          </div>
          <div className="mt-5">
            <Checkbox checked={acceptTerms} onChange={(checked) => {
              setAcceptTerms(checked);
              if (checked) setError(undefined);
            }} label="I confirm the details above and accept the approval terms." />
          </div>
          {error ? <div className="mt-4 rounded-xl border border-danger bg-danger-tint p-3 text-sm font-semibold text-danger" role="alert">{error}</div> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn variant="ghost" disabled={pending || Boolean(retryAfter)} onClick={() => setApproveOpen(false)}>Cancel</Btn>
            <Btn disabled={Boolean(retryAfter)} loading={pending} onClick={() => void decide("approve")}>Confirm approval</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
