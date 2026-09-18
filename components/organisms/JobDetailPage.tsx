import { ApplicationForm } from "./ApplicationForm";
import { useState } from "react";
import { useCreateApplication } from "@/features/applications/use-applications";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import type { PaginatedApplications } from "@/features/applications/types";
import { useJob } from "@/features/jobs/use-jobs";
import { displayedJobStatus, formatJobPay, isJobOpen } from "@/features/jobs/presentation";
import { useJobMatchScore } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";
import { Btn, Field, Icon, Tag } from "../atoms";
import { FormattedJobDescription, MatchScorePanel, Modal, SectionLoader } from "../molecules";

export function JobDetailPage({
  ctx,
  go,
  toast,
  role,
  state,
}: Pick<RouteProps, "ctx" | "go" | "toast" | "state"> & { role?: RouteProps["role"] }) {
  const [open, setOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const jobQuery = useJob(ctx.jobId ?? "");
  const matchQuery = useJobMatchScore(ctx.jobId ?? "", role === "teacher");
  const existingQuery = useQuery({
    queryKey: ["applications", "existing", ctx.jobId],
    enabled: role === "teacher" && Boolean(ctx.jobId),
    queryFn: async () => {
      for (let page = 1; ; page++) {
        const result = await fetchJson<PaginatedApplications>("/api/applications/me", { query: { page, limit: 100 } });
        const existing = result.applications.find((item) => item.jobId === ctx.jobId);
        if (existing || !result.pagination.hasNextPage) return existing ?? null;
      }
    },
  });
  const job = jobQuery.data;
  const create = useCreateApplication({
    onSuccess: (result) => {
      if (!result.ok) {
        toast({ title: "Could not apply", msg: result.message, tone: "danger" });
        void existingQuery.refetch();
        return;
      }
      setSubmitted(true);
      setOpen(false);
      toast({
        title: "Application submitted",
        msg: "Track its status and add supporting documents in My applications.",
        tone: "success",
      });
    },
    onError: () => toast({ title: "Could not apply", msg: "Please try again.", tone: "danger" }),
  });
  if (jobQuery.isLoading)
    return (
      <div className="app-page">
        <SectionLoader rows={5} />
      </div>
    );
  if (!job)
    return (
      <div className="app-page">
        <div className="card card-pad-lg">
          <h1 className="font-serif text-3xl">Job not available</h1>
          <p className="mt-3">This role may be closed, expired, or no longer visible.</p>
          <Btn className="mt-4" onClick={() => go("find-jobs")}>
            Browse jobs
          </Btn>
        </div>
      </div>
    );
  const applied = submitted || Boolean(existingQuery.data);
  const canApply = role === "teacher" && state.isFullyVerified && isJobOpen(job) && !applied && existingQuery.isSuccess;
  return (
    <div className="app-page">
      <div className="two-col">
        <main>
          <div className="mb-3 flex flex-wrap gap-2">
            {job.urgent ? <Tag tone="red">Urgent - act fast</Tag> : null}
            <Tag tone={job.mode === "instant" ? "" : "purple"}>
              {job.mode === "instant" ? "Instant matching" : "Open brief"}
            </Tag>
            <Tag tone="ghost">{job.subject}</Tag>
            <Tag tone="ghost">{displayedJobStatus(job)}</Tag>
            {job.keyStages?.map((stage) => (
              <Tag key={stage} tone="ghost">
                {stage}
              </Tag>
            ))}
          </div>
          <h1 className="font-serif text-4xl">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="building" size={14} />
              {job.school}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="pin" size={14} />
              {[job.address, job.city, job.county, job.postalCode, job.countryCode].filter(Boolean).join(", ")}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={14} />
              Posted {job.postedAt}
            </span>
          </div>
          <div className="grid-3 my-6">
            <div className="card card-pad">
              <p className="text-xs text-muted">Pay (GBP)</p>
              <strong>{formatJobPay(job)}</strong>
            </div>
            <div className="card card-pad">
              <p className="text-xs text-muted">Dates</p>
              <strong>{job.date}</strong>
            </div>
            <div className="card card-pad">
              <p className="text-xs text-muted">Minimum experience</p>
              <strong>{job.minExperienceYears != null ? `${job.minExperienceYears} years` : "Not specified"}</strong>
            </div>
          </div>
          <section className="card card-pad-lg mb-5">
            <h2 className="section-title">About this role</h2>
            <FormattedJobDescription description={job.description ?? ""} />
          </section>
          <section className="card card-pad-lg">
            <h2 className="section-title">Requirements</h2>
            {[
              `Subject: ${job.subject}`,
              `Key stages: ${job.keyStages?.join(", ") || "All stages"}`,
              job.minExperienceYears != null
                ? `Minimum experience: ${job.minExperienceYears} years`
                : "No minimum experience specified",
              ...(job.description?.includes("QTS requested.") ? ["QTS qualified"] : []),
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 py-2">
                <Icon name="checkCircle" size={16} />
                {item}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map((skill) => (
                <Tag key={skill} tone="ghost">
                  {skill}
                </Tag>
              ))}
            </div>
            <p className="mt-4">{job.parkingInfo || "Arrival details have not been provided."}</p>
          </section>
        </main>
        <aside className="card card-pad-lg sticky top-[88px] self-start">
          <h2 className="font-serif text-2xl">{formatJobPay(job)}</h2>
          <p className="my-3 text-sm">
            {job.expiresAt
              ? `Applications close ${new Date(job.expiresAt).toLocaleString("en-GB")}`
              : "No application deadline specified"}
          </p>
          {matchQuery.data ? <MatchScorePanel match={matchQuery.data} /> : null}
          {role === "teacher" ? (
            <>
              <Btn className="mt-4 w-full" disabled={!canApply} onClick={() => setOpen(true)}>
                {applied
                  ? "Application submitted"
                  : !state.isFullyVerified
                    ? "Full verification required"
                    : !isJobOpen(job)
                      ? "Applications closed"
                      : existingQuery.isLoading
                        ? "Checking application..."
                        : "Apply for job"}
              </Btn>
              {existingQuery.isError ? (
                <p role="alert" className="mt-3 text-sm">
                  Could not check existing applications.{" "}
                  <button className="underline" onClick={() => void existingQuery.refetch()}>
                    Retry
                  </button>
                </p>
              ) : null}
              <Btn
                className="mt-2 w-full"
                variant="secondary"
                onClick={() => go(applied ? "applications" : "settings")}
              >
                {applied ? "My applications" : "Profile and verification"}
              </Btn>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted">Applications are open to fully verified instructors.</p>
              {role ? (
                <Btn className="mt-4 w-full" onClick={() => setInviteOpen(true)}>
                  Invite candidates
                </Btn>
              ) : null}
            </>
          )}
          {role ? (
            <Btn variant="secondary" className="mt-2 w-full" onClick={() => go("messaging")}>
              Message school
            </Btn>
          ) : null}
        </aside>
      </div>
      <Modal
        wide
        open={open}
        onClose={() => {
          if (!create.isPending && !formBusy) setOpen(false);
        }}
      >
        <div className="card-pad-lg">
          {open ? (
            <ApplicationForm
              onBusyChange={setFormBusy}
              jobTitle={job.title}
              pending={create.isPending}
              canApply={Boolean(canApply)}
              onCancel={() => setOpen(false)}
              onSubmit={(coverLetter) => create.mutate({ jobId: job.id, coverLetter: coverLetter || undefined })}
            />
          ) : null}
        </div>
      </Modal>
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <div className="card-pad-lg">
          <h2 className="mb-4 font-serif text-2xl">Invite candidates</h2>
          <Field label="Message">
            <textarea
              className="textarea"
              defaultValue="Please review this role and let us know if you are interested."
            />
          </Field>
          <div className="flex justify-between">
            <Btn variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Btn>
            <Btn
              onClick={() => {
                setInviteOpen(false);
                toast({
                  title: "Preview invitation",
                  msg: "Your invitation is ready. Candidate messaging is shown as preview content for now.",
                });
              }}
            >
              Confirm
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
