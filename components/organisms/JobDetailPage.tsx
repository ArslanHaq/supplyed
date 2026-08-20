import { useState } from "react";

import { useCreateApplication, useMyApplications } from "@/features/applications/use-applications";
import { useJob } from "@/features/jobs/use-jobs";
import type { JobRequiredDocument, RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, MatchScore, Tag } from "../atoms";
import { FormattedJobDescription, Modal, SectionLoader } from "../molecules";

export function JobDetailPage({ ctx, go, toast, role }: Pick<RouteProps, "ctx" | "go" | "toast" | "role">) {
  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("Hi, I'm available and happy to arrive by 08:15. I have strong cover experience for this role.");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const jobQuery = useJob(ctx.jobId ?? "");
  const myApplicationsQuery = useMyApplications({ limit: 100 }, { enabled: role === "teacher" });
  const job = jobQuery.data;
  const existingApplication = myApplicationsQuery.data?.applications.find((application) => application.jobId === ctx.jobId);
  const applyMutation = useCreateApplication({
    onError: (error) => {
      setSubmitError(error.message);
      toast({ title: "Could not submit application", msg: error.message, tone: "danger" });
    },
    onSuccess: () => {
      setOpen(false);
      setSubmitError(null);
      toast({ title: "Application submitted", msg: "Your cover letter has been sent to the hiring account.", tone: "success" });
    },
  });

  if (!ctx.jobId) {
    return (
      <div className="app-page">
        <div className="card card-pad-lg text-center">
          <div className="font-serif text-[26px]">Choose a job</div>
          <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-muted">Open a job from your dashboard or the jobs list to view details.</p>
          <Btn className="mt-5" onClick={() => go(role === "teacher" ? "find-jobs" : "dashboard")}>Back to jobs</Btn>
        </div>
      </div>
    );
  }

  if (jobQuery.isLoading) {
    return <div className="app-page"><SectionLoader rows={5} /></div>;
  }

  if (!job) {
    return (
      <div className="app-page">
        <div className="card card-pad-lg text-center">
          <div className="font-serif text-[26px]">Job not available</div>
          <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-muted">This role may be closed, expired, or no longer visible.</p>
          <Btn className="mt-5" onClick={() => go(role === "teacher" ? "find-jobs" : "dashboard")}>Back to jobs</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="two-col">
        <div>
          <div className="mb-3.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent - act fast</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant matching" : "Open brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><Tag tone="ghost">{job.subject}</Tag></div>
          <h1 className="mb-2.5 font-serif text-[38px] leading-tight">{job.title}</h1>
          <div className="mb-6 flex flex-wrap gap-4"><div className="flex items-center gap-1.5"><Icon name="building" size={14} />{job.school}</div><div className="flex items-center gap-1.5"><Icon name="pin" size={14} />{job.city}</div><div className="flex items-center gap-1.5"><Icon name="clock" size={14} />Posted {job.postedAt}</div></div>
          <div className="grid-3 mb-7">
            <div className="card card-pad text-center"><div className="text-xs text-muted">Day rate</div><div className="font-serif text-[26px] text-brand">£{job.rate}</div></div>
            <div className="card card-pad text-center"><div className="text-xs text-muted">Duration</div><div className="font-serif text-xl">1 Day</div></div>
            <div className="card card-pad text-center"><div className="text-xs text-muted">Match score</div><div className="mt-1.5 flex justify-center"><MatchScore score={job.matchScore} /></div></div>
          </div>
          <div className="card card-pad-lg mb-5">
            <div className="section-title">About this role</div>
            <FormattedJobDescription description={job.description || ""} emptyText="School-provided role details will appear here once published." />
          </div>
          <div className="card card-pad-lg">
            <div className="section-title">Requirements</div>
            {[
              ...readJobDocumentRequirements(job.requiredDocuments),
              job.otherRequiredDocument?.trim(),
              `Subject: ${job.subject}`,
              `Key stage: ${job.keyStage}`,
              job.parkingInfo || "Arrival details will be shared by the hiring account.",
            ]
              .filter((item): item is string => Boolean(item))
              .map((item) => <div key={item} className="flex items-center gap-2.5 py-2"><Icon name="checkCircle" size={16} />{item}</div>)}
          </div>
        </div>
        <div className="card card-pad-lg sticky top-[88px] self-start">
          <div className="mb-3.5 flex items-center justify-between"><div><div className="text-xs text-muted">Day rate</div><div className="font-serif text-[28px]">£{job.rate}</div></div><MatchScore score={job.matchScore} /></div>
          <div className="mb-3.5 flex flex-wrap gap-2"><span className="pill">{job.keyStage}</span><span className="pill">{job.subject}</span><span className="pill">{job.date}</span></div>
          <Btn className="w-full" size="lg" onClick={() => setOpen(true)}>
            {role === "teacher" ? existingApplication ? "Already applied" : job.mode === "instant" ? "Accept job" : "Apply now" : "Invite candidates"}
          </Btn>
          <Btn variant="secondary" className="mt-2 w-full" onClick={() => go("messaging")}>Message school</Btn>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="card-pad-lg">
          <div className="mb-2 font-serif text-[26px]">{role === "teacher" ? "Apply to this role" : "Invite candidates"}</div>
          {role === "teacher" ? (
            <>
              {existingApplication ? (
                <div className="mb-4 rounded-xl border border-brand bg-brand-tint px-4 py-3 text-sm font-semibold text-brand">
                  You already applied to this role. Current status: {formatStatus(existingApplication.status)}.
                </div>
              ) : null}
              <Field
                error={submitError ?? undefined}
                label="Cover letter"
              >
                <textarea
                  className="textarea"
                  maxLength={2000}
                  onChange={(event) => {
                    setCoverLetter(event.target.value);
                    if (submitError) setSubmitError(null);
                  }}
                  value={coverLetter}
                />
                <div className="mt-1.5 text-right text-xs text-muted">{coverLetter.length}/2000</div>
              </Field>
              <div className="flex items-center justify-between">
                <Btn disabled={applyMutation.isPending} variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
                <Btn
                  disabled={Boolean(existingApplication)}
                  loading={applyMutation.isPending}
                  loadingLabel="Submitting"
                  onClick={() => {
                    setSubmitError(null);
                    applyMutation.mutate({ coverLetter, jobId: job.id });
                  }}
                >
                  Submit application
                </Btn>
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm leading-6 text-muted">Candidate invitations are not connected to a backend endpoint yet.</p>
              <div className="flex items-center justify-between">
                <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
                <Btn onClick={() => {
                  setOpen(false);
                  toast({ title: "Not available yet", msg: "Backend candidate invitations are not available in the current API.", tone: "danger" });
                }}>Close</Btn>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function readJobDocumentRequirements(documents: JobRequiredDocument[] = []) {
  const selected = documents.length ? documents : ["DBS_CERTIFICATE" satisfies JobRequiredDocument];

  return selected.map((document) => {
    if (document === "DBS_CERTIFICATE") return "Enhanced DBS certificate";
    if (document === "PHOTO_ID") return "Photo ID";
    if (document === "TEACHING_QUALIFICATION") return "Teaching Qualifications / QTS";
    return "Proof of Address";
  });
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}
