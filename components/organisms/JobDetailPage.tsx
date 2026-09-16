import { useState } from "react";

import { useCreateApplication } from "@/features/applications/use-applications";
import { useJob } from "@/features/jobs/use-jobs";
import { useJobMatchScore } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, Tag } from "../atoms";
import { FormattedJobDescription, MatchScorePanel, Modal, SectionLoader } from "../molecules";

export function JobDetailPage({ ctx, go, toast, role }: Pick<RouteProps, "ctx" | "go" | "toast" | "role">) {
  const [open, setOpen] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterError, setCoverLetterError] = useState<string>();
  const jobQuery = useJob(ctx.jobId ?? "");
  const matchQuery = useJobMatchScore(ctx.jobId ?? "", role === "teacher");
  const job = jobQuery.data;
  const createApplication = useCreateApplication({
    onSuccess: (result) => {
      if (!result.ok) {
        setCoverLetterError(result.fieldErrors?.coverLetter);
        toast({ title: "Could not apply", msg: result.message, tone: "danger" });
        return;
      }

      setApplicationSubmitted(true);
      setOpen(false);
      toast({ title: "Application submitted", msg: "Your application and cover letter were sent successfully.", tone: "success" });
    },
    onError: () => {
      toast({ title: "Could not apply", msg: "Please try again.", tone: "danger" });
    },
  });

  function submitApplication() {
    if (!job || role !== "teacher") return;

    const normalizedCoverLetter = coverLetter.trim();
    if (!normalizedCoverLetter) {
      setCoverLetterError("Add a cover letter before applying.");
      return;
    }

    setCoverLetterError(undefined);
    createApplication.mutate({ coverLetter: normalizedCoverLetter, jobId: job.id });
  }

  function closeModal() {
    if (createApplication.isPending) return;
    setOpen(false);
    setCoverLetterError(undefined);
  }

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
          <div className="mb-6 flex flex-wrap gap-4"><div className="flex items-center gap-1.5"><Icon name="building" size={14} />{job.school}</div><div className="flex items-center gap-1.5"><Icon name="pin" size={14} />{[job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC"}</div><div className="flex items-center gap-1.5"><Icon name="clock" size={14} />Posted {job.postedAt}</div></div>
          <div className="grid-3 mb-7">
            <div className="card card-pad text-center"><div className="text-xs text-muted">Day rate</div><div className="font-serif text-[26px] text-brand">£{job.rate}</div></div>
            <div className="card card-pad text-center"><div className="text-xs text-muted">Duration</div><div className="font-serif text-xl">1 Day</div></div>
            <div className="card card-pad text-center"><div className="text-xs text-muted">Experience</div><div className="font-serif text-xl">{job.minExperienceYears != null ? `${job.minExperienceYears}+ years` : "Not specified"}</div></div>
          </div>
          <div className="card card-pad-lg mb-5">
            <div className="section-title">About this role</div>
            <FormattedJobDescription description={job.description || ""} emptyText="School-provided role details will appear here once published." />
          </div>
          <div className="card card-pad-lg"><div className="section-title">Requirements</div>{[`Subject: ${job.subject}`, `Key stage: ${job.keyStage}`, job.minExperienceYears != null ? `Minimum experience: ${job.minExperienceYears} years` : "No minimum experience specified", job.parkingInfo || "Arrival details will be shared by the hiring account."].map((item) => <div key={item} className="flex items-center gap-2.5 py-2"><Icon name="checkCircle" size={16} />{item}</div>)}{job.requiredSkills.length ? <div className="mt-3 flex flex-wrap gap-2">{job.requiredSkills.map((skill) => <Tag key={skill} tone="ghost">{skill}</Tag>)}</div> : null}</div>
        </div>
        <div className="card card-pad-lg sticky top-[88px] self-start">
          <div className="mb-3.5 flex items-center justify-between"><div><div className="text-xs text-muted">Day rate</div><div className="font-serif text-[28px]">£{job.rate}</div></div>{matchQuery.data ? <Tag tone="green">{matchQuery.data.score}% match</Tag> : null}</div>
          <div className="mb-3.5 flex flex-wrap gap-2"><span className="pill">{job.keyStage}</span><span className="pill">{job.subject}</span><span className="pill">{job.date}</span></div>
          {role === "teacher" && matchQuery.isLoading ? <div className="mb-4"><SectionLoader rows={1} /></div> : null}
          {role === "teacher" && matchQuery.data ? <div className="mb-4"><MatchScorePanel match={matchQuery.data} /></div> : null}
          <Btn className="w-full" disabled={role === "teacher" && applicationSubmitted} size="lg" onClick={() => setOpen(true)}>{role === "teacher" ? (applicationSubmitted ? "Application submitted" : "Apply for job") : "Invite candidates"}</Btn>
          <Btn variant="secondary" className="mt-2 w-full" onClick={() => go("messaging")}>Message school</Btn>
        </div>
      </div>
      <Modal open={open} onClose={closeModal}>
        <div className="card-pad-lg">
          <div className="mb-2 font-serif text-[26px]">{role === "teacher" ? "Apply to this role" : "Invite candidates"}</div>
          {role === "teacher" ? (
            <>
              <p className="mb-5 text-sm leading-6 text-muted">Introduce yourself and explain why you are a good fit for this role.</p>
              <Field error={coverLetterError} htmlFor="job-cover-letter" label="Cover letter" required>
                <textarea
                  id="job-cover-letter"
                  className="textarea"
                  maxLength={2000}
                  placeholder="Share your relevant experience, availability, and suitability for this role."
                  value={coverLetter}
                  onChange={(event) => {
                    setCoverLetter(event.target.value);
                    if (coverLetterError) setCoverLetterError(undefined);
                  }}
                />
              </Field>
              <div className="-mt-2 mb-5 text-right text-xs text-muted">{coverLetter.length.toLocaleString()} / 2,000</div>
              <div className="flex items-center justify-between">
                <Btn disabled={createApplication.isPending} variant="ghost" onClick={closeModal}>Cancel</Btn>
                <Btn loading={createApplication.isPending} loadingLabel="Submitting application" onClick={submitApplication}>Apply for job</Btn>
              </div>
            </>
          ) : (
            <>
              <Field label="Message"><textarea className="textarea" defaultValue="Please review this role and let us know if you are interested." /></Field>
              <div className="flex items-center justify-between"><Btn variant="ghost" onClick={closeModal}>Cancel</Btn><Btn onClick={() => { setOpen(false); toast({ title: "Success", msg: "Top candidates invited." }); }}>Confirm</Btn></div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
