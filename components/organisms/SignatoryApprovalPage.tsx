"use client";

import { useEffect, useState } from "react";

import { Btn, Checkbox, Icon, Logo, Tag } from "../atoms";
import { Modal } from "../molecules";

type ApprovalStatus = "APPROVED" | "DECLINED" | "EXPIRED" | "PENDING" | "REVOKED";
type ApprovalReview = {
  expiresAt: string;
  requestedBy: string;
  school: { address: string; city: string; domain: string; name: string; postalCode: string | null; registrationId: string | null };
  signatoryJobTitle: string;
  signatoryName: string;
  status: ApprovalStatus;
  termsVersion: string;
  trust: { companyNumber: string | null; name: string };
};

const signatoryTermsVersion = "2026-09";

function decidedRequestCopy(status: ApprovalStatus) {
  if (status === "APPROVED") return "This school has already been approved. No further action is needed.";
  if (status === "DECLINED") return "This request has already been declined. Contact the school if it needs to send a new request.";
  if (status === "EXPIRED") return "This approval link expired before a decision was recorded. Ask the school to send a new request.";
  return "This approval request is no longer valid because it was replaced or the trust details changed.";
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(" ") : payload?.message;
    throw new Error(message || (response.status === 410 ? "This approval link has expired." : "This approval link is not valid."));
  }
  return payload as ApprovalReview;
}

export function SignatoryApprovalPage({ token }: { token: string }) {
  const [approval, setApproval] = useState<ApprovalReview>();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function load() {
    setError(undefined);
    try {
      setApproval(await readResponse(await fetch(`/api/signatory-approvals/${encodeURIComponent(token)}`, { cache: "no-store" })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "This approval link is not valid.");
    }
  }

  useEffect(() => {
    let active = true;

    void fetch(`/api/signatory-approvals/${encodeURIComponent(token)}`, { cache: "no-store" })
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
    if (action === "approve" && !acceptTerms) {
      setError("Accept the trust approval terms before approving this school.");
      return;
    }
    if (action === "decline" && !reason.trim()) {
      setError("Explain why the trust is declining this request.");
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      setApproval(await readResponse(await fetch(`/api/signatory-approvals/${encodeURIComponent(token)}`, {
        body: JSON.stringify({ acceptTerms, action, reason }),
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
        <div className="marketing-approval-card mt-8 border border-border bg-white p-6 sm:p-9">
          <Tag tone={approval?.status === "APPROVED" ? "green" : approval?.status === "DECLINED" ? "red" : "amber"}>
            Trust signatory approval
          </Tag>
          <h1 className="mt-4 font-heading text-3xl sm:text-4xl">Review this school&apos;s trust membership.</h1>

          {!approval && !error ? <div role="status"><p className="mt-6 text-sm text-muted">Checking this secure approval link...</p><div className="marketing-approval-loading" aria-hidden="true"><span /><span /><span /></div></div> : null}
          {error ? <div className="mt-6 rounded-xl border border-danger bg-danger-tint p-4 text-sm font-semibold text-danger" role="alert">{error}</div> : null}

          {approval ? (
            <div className="mt-7 space-y-6">
              <div className="marketing-approval-details grid rounded-xl border border-border sm:grid-cols-2">
                <Detail label="School" value={approval.school.name} />
                <Detail label="Trust" value={approval.trust.name} />
                <Detail label="School domain" value={approval.school.domain} />
                <Detail label="Company number" value={approval.trust.companyNumber || "Not supplied"} />
                <Detail label="Requested by" value={approval.requestedBy} />
                <Detail label="Signatory" value={`${approval.signatoryName}, ${approval.signatoryJobTitle}`} />
              </div>

              {isPending ? (
                <>
                  <div>
                    <h2 className="font-heading text-2xl">Approval terms</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      I confirm that I am authorised to act for {approval.trust.name}, that {approval.school.name} is part of this trust, and that the trust authorises the school to create and operate a SupplyED institution workspace. I understand SupplyED will retain this approval for audit and safeguarding purposes.
                    </p>
                    <p className="mt-2 text-xs text-muted">Terms version {signatoryTermsVersion}. Link expires {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(approval.expiresAt))}.</p>
                  </div>
                  {declining ? (
                    <label className="block text-sm font-semibold">
                      Reason for declining
                      <textarea className="textarea mt-2" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                    </label>
                  ) : null}
                  <div className="marketing-approval-actions flex flex-col gap-3 sm:flex-row sm:justify-end">
                    {declining ? (
                      <>
                        <Btn variant="ghost" disabled={pending} onClick={() => setDeclining(false)}>Cancel</Btn>
                        <Btn variant="danger" loading={pending} onClick={() => void decide("decline")}>Confirm decline</Btn>
                      </>
                    ) : (
                      <>
                        <Btn variant="secondary" disabled={pending} onClick={() => setDeclining(true)}>Decline</Btn>
                        <Btn disabled={pending} onClick={() => {
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
            You are approving <strong className="text-ink">{approval?.school.name}</strong> as part of <strong className="text-ink">{approval?.trust.name}</strong> and authorising it to create and operate a SupplyED institution workspace.
          </p>
          <div className="mt-5 rounded-xl border border-border bg-chalk p-4 text-sm leading-6 text-muted">
            I confirm that I am authorised to act for the trust, that the school belongs to it, and that this approval may be retained for audit and safeguarding purposes.
            <div className="mt-2 text-xs">Terms version {signatoryTermsVersion}</div>
          </div>
          <div className="mt-5">
            <Checkbox checked={acceptTerms} onChange={(checked) => {
              setAcceptTerms(checked);
              if (checked) setError(undefined);
            }} label="I confirm the details above and accept the approval terms." />
          </div>
          {error ? <div className="mt-4 rounded-xl border border-danger bg-danger-tint p-3 text-sm font-semibold text-danger" role="alert">{error}</div> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn variant="ghost" disabled={pending} onClick={() => setApproveOpen(false)}>Cancel</Btn>
            <Btn loading={pending} onClick={() => void decide("approve")}>Confirm approval</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
