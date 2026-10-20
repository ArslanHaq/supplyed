"use client";
import { PlannedWorkUnitsField } from "@/components/molecules/PlannedWorkUnitsField";
import { ukCalendarDate, shiftCalendarDay } from "@/features/jobs/listing-window";
import { plannedUnitsInput, formatPlannedUnits } from "@/features/jobs/work-units";
import { syncWorkSchedule, validateScheduleUnits } from "@/features/jobs/schedule-editor";
import { DynamicSelect } from "@/components/molecules/DynamicDropdown";


import { RoleDescriptionEditor } from "@/components/molecules/RoleDescriptionEditor";
import { HourlyWorkSchedule } from "@/components/molecules/HourlyWorkSchedule";
import { TeachingSelectionFields } from "@/components/molecules/TeachingSelectionFields";

import { actualSubjects, catalogueError } from "@/features/teaching-catalogue/selection";
import { teachingCatalogueKey } from "@/features/teaching-catalogue/use-teaching-catalogue";
import { useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { createInvitationAction } from "@/features/invitations/actions";
import type { InvitationInput } from "@/features/invitations/types";
import { zonedDateTimeToIso } from "@/lib/zoned-date-time";
import { jobInvitationProblem, validateInvitation } from "@/features/invitations/validation";
import { useJob, useMyJobs } from "@/features/jobs/use-jobs";
import { normalizeJobCreateInput } from "@/features/jobs/schemas";
import type { Job, JobCreateInput } from "@/features/jobs/types";
import { queryKeys } from "@/lib/query/keys";
import type { GoFn, JobPayType } from "@/types/supplyed";
import { Avatar, Btn, Field, Icon, Tag } from "../atoms";
import { Modal, SectionLoader } from "../molecules";
import { InvitationErrorNotice, useInvitationError } from "./InvitationErrorNotice";

export type HireTeacher = { id: string; fullName: string; imageUrl?: string | null };
type Draft = { title: string; description: string; startDate: string; endDate: string; liveFrom: string; expiresAt: string; hours: string; days: string; payAmount: string; payType: JobPayType; address: string; city: string; postalCode: string; subjects: string[]; requiredSkills: string[]; otherSubjects?: string[]; otherSkills?: string[] };
type Attempt = { input: InvitationInput; summary: JobCreateInput };
const emptyDraft: Draft = { title: "", description: "", startDate: "", endDate: "", liveFrom: "", expiresAt: "", hours: "", days: "", payAmount: "", payType: "daily", address: "", city: "", postalCode: "", subjects: [], requiredSkills: [] };

export function InvitationModal({ teacher, accountId, initialJobId, onClose, go }: { teacher: HireTeacher; accountId: string; initialJobId?: string; onClose: () => void; go: GoFn }) {
  const client = useQueryClient();
  const storageKey = `supplyed:job-invitation:v1:${accountId}:${teacher.id}`;
  const [attempt, setAttempt] = useState<Attempt | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as Attempt | null;
      return saved?.input?.instructorId === teacher.id && saved.input.requestId && saved.summary ? saved : null;
    } catch { return null; }
  });
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState("");
  const [timezone, setTimezone] = useState("Europe/London");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT">("ACTIVE");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [review, setReview] = useState<JobCreateInput | null>(null);
  const [error, setError] = useInvitationError();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const jobs = useMyJobs({ status, page, search, limit: 6 });
  const initialJob = useJob(initialJobId ?? "", true);
  const chosen = selected ?? initialJob.data ?? null;
  const summary = attempt?.summary ?? review;

  function update(field: keyof Draft, value: string) {
    setDraft(current => syncWorkSchedule(current, field, value, timezone));
    setFields(current => ({ ...current, [field]: "", listingExpiresAt: "", liveFrom: "", hours: "", days: "", startDate: "", endDate: "" }));
    setError("");
  }
  function reviewDetails(event: FormEvent) {
    event.preventDefault(); setError(""); setFields({});
    const extras = { ...(message.trim() ? { message: message.trim() } : {}), ...(expiry ? { expiresAt: zonedDateTimeToIso(expiry, timezone) } : {}) };
    const base = { requestId: "00000000-0000-4000-8000-000000000000", instructorId: teacher.id, ...extras };
    let terms: JobCreateInput;
    let input: InvitationInput;
    if (mode === "existing") {
      if (!chosen) { setError("Choose a job for this teacher."); return; }
      const problem = jobInvitationProblem(chosen);
      if (problem) { setError(problem); return; }
      setSelected(chosen);
      terms = { subjects: chosen.subjects, requiredSkills: chosen.requiredSkills, title: chosen.title, description: chosen.description ?? "", keyStages: chosen.keyStages ?? [], startDate: chosen.startDate!, endDate: chosen.endDate!, hours: chosen.hours ?? null, days: chosen.days ?? null, payAmount: chosen.payAmount!, payType: chosen.payType as JobPayType, address: chosen.address ?? "", city: chosen.city, postalCode: chosen.postalCode ?? "" };
      input = { ...base, jobId: chosen.id };
    } else {
      terms = {
        title: draft.title, description: draft.description,
        startDate: zonedDateTimeToIso(draft.startDate, timezone), endDate: zonedDateTimeToIso(draft.endDate, timezone),
        liveFrom: draft.liveFrom || undefined, expiresAt: draft.expiresAt || undefined,
        ...plannedUnitsInput(draft.payType, draft.hours, draft.days), payAmount: Number(draft.payAmount), payType: draft.payType, keyStages: [], countryCode: "GB",
        address: draft.address, city: draft.city, postalCode: draft.postalCode, subjects: draft.subjects, otherSubjects: draft.otherSubjects, otherSkills: draft.otherSkills, requiredSkills: draft.requiredSkills,
      };
      input = { ...base, newJob: terms };
    }
    const errors = { ...validateInvitation(input, { fresh: true, job: chosen ?? undefined }), ...(mode === "new" ? validateScheduleUnits(draft, timezone) : {}) };
    if (Object.keys(errors).length) { setFields(errors); setError("Check the highlighted invitation details."); return; }
    setReview(mode === "new" ? normalizeJobCreateInput(terms) : terms);
  }
  async function confirmHire() {
    if (submitting.current || !summary) return;
    const extras = { ...(message.trim() ? { message: message.trim() } : {}), ...(expiry ? { expiresAt: zonedDateTimeToIso(expiry, timezone) } : {}) };
    const next: Attempt = attempt ?? { summary, input: mode === "existing" && selected ? { ...extras, requestId: crypto.randomUUID(), instructorId: teacher.id, jobId: selected.id } : { ...extras, requestId: crypto.randomUUID(), instructorId: teacher.id, newJob: summary } };
    // Persist before sending: closing or refreshing must retry the exact same invitation request.
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setError("Enable browser session storage to safely submit and retry this invitation."); return; }
    setAttempt(next); submitting.current = true; setBusy(true); setError("");
    try {
      const result = await createInvitationAction(next.input);
      if (!result.ok) {
        if (result.status === 409) {
          for (const queryKey of [queryKeys.teachers.all, queryKeys.publicProfiles.all]) void client.invalidateQueries({ queryKey });
        }
        if (catalogueError(result.code)) void client.invalidateQueries({ queryKey: ["dropdown"] });
        setError(result.message, result);
        if (!result.uncertain) {
          sessionStorage.removeItem(storageKey); setAttempt(null); setReview(null); setFields(result.fieldErrors ?? {});
          void jobs.refetch(); if (initialJobId) void initialJob.refetch();
        }
        return;
      }
      sessionStorage.removeItem(storageKey);
      client.setQueryData(queryKeys.invitations.detail(result.data.id), result.data);
      for (const key of [queryKeys.invitations.all, queryKeys.jobs.all, queryKeys.conversations.all]) void client.invalidateQueries({ queryKey: key });
      if (result.conversationId) go("messaging", { conversationId: result.conversationId });
      else go("job-invitations", { invitationId: result.data.id });
      onClose();
    } catch { setError("We could not confirm the result. Retry this same request to safely recover your invitation."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const choices = initialJob.data && !jobs.data?.jobs.some(job => job.id === initialJob.data!.id) && page === 1 && !search ? [initialJob.data, ...(jobs.data?.jobs ?? [])] : jobs.data?.jobs ?? [];

  return createPortal(<Modal label={`Invite ${teacher.fullName} to a job`} onClose={() => { if (!busy) onClose(); }} open size="lg">
    <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
      <div><p className="mb-1 text-xs font-semibold text-brand">JOB INVITATION · {summary ? "2 OF 2" : "1 OF 2"}</p><h2 className="font-heading text-2xl">{summary ? "Review invitation" : "Choose a job"}</h2><p className="mt-1 text-sm text-muted">{summary ? "Review the terms the teacher will receive." : "Use one of your jobs or create a new placement here."}</p></div>
      <Btn aria-label="Close invitation" disabled={busy} icon="x" variant="ghost" size="sm" onClick={onClose} />
    </div>
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-chalk p-4"><Avatar name={teacher.fullName} src={teacher.imageUrl} size="md" /><div><p className="text-xs text-muted">Your selected teacher</p><p className="font-semibold text-ink">{teacher.fullName}</p></div><Tag className="ml-auto" tone="ghost">Invitation</Tag></div>
      {error ? <InvitationErrorNotice error={error} /> : null}
      {summary ? <>
        <section className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-chalk p-4"><h3 className="font-heading text-lg">{summary.title}</h3><p className="mt-1 text-xs text-muted">{attempt?.input.newJob || (!attempt && mode === "new") ? "New private job" : "Existing school job"}</p></div>
          <dl className="grid gap-5 p-4 sm:grid-cols-2">
            <Detail label="Subjects" value={actualSubjects(summary.subjects ?? [], summary.otherSubjects).join(", ") || "Not specified"} /><Detail label="Required skills" value={actualSubjects(summary.requiredSkills ?? [], summary.otherSkills).join(", ") || "Not specified"} />
            <Detail label="Starts" value={displayDate(summary.startDate)} /><Detail label="Ends" value={displayDate(summary.endDate)} />
            <Detail label="Agreed pay" value={displayPay(summary.payAmount, summary.payType)} />{summary.payType !== "fixed" ? <Detail label="Planned work" value={formatPlannedUnits(summary)} /> : null}<Detail label="Location" value={[summary.address, summary.city, summary.postalCode].filter(Boolean).join(", ") || "Not specified"} />
            {summary.liveFrom ? <Detail label="Public if declined from" value={summary.liveFrom} /> : null}{summary.expiresAt ? <Detail label="Public listing through" value={summary.expiresAt} /> : null}
          </dl>
        </section>
        <p className="mt-4 rounded-xl bg-brand-tint p-4 text-sm leading-6 text-ink">Sending invites the teacher to review and accept these terms, starts your conversation, and posts an invitation message from your school. A booking is created only after acceptance. A pending invitation does not reserve the teacher or position.</p>
        {(attempt?.input.newJob || (!attempt && mode === "new")) ? <p className="mt-3 text-sm leading-6 text-muted">The new job stays private while awaiting a response. If the teacher declines and the job is still eligible, it becomes public so other teachers can apply. Cancelling or expiry does not publish it.</p> : null}
        {(attempt?.input.message ?? message) ? <div className="mt-4 rounded-xl border border-border p-4"><p className="text-xs text-muted">Your message</p><p className="mt-2 whitespace-pre-wrap text-sm">{attempt?.input.message ?? message}</p></div> : null}
        <p className="mt-3 text-xs text-muted">Response deadline: {(attempt?.input.expiresAt ?? (expiry ? zonedDateTimeToIso(expiry, timezone) : undefined)) ? displayDate(attempt?.input.expiresAt ?? zonedDateTimeToIso(expiry, timezone)) : "Automatically set to the earliest of seven days, the job start or listing expiry."}</p>
        {attempt ? <p className="mt-3 text-sm leading-6 text-muted">This invitation request has been saved. Retry it to retrieve the result safely. Your teacher, job and request reference will stay the same.</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {!attempt ? <Btn variant="secondary" disabled={busy} onClick={() => { setReview(null); setError(""); }}>Back to job</Btn> : null}
          <Btn disabled={busy} loading={busy} loadingLabel="Sending invitation" icon="check" onClick={() => void confirmHire()}>{attempt ? "Retry same invitation" : "Send invitation"}</Btn>
        </div>
      </> : <form onSubmit={reviewDetails}>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-chalk p-1.5"><Btn aria-pressed={mode === "existing"} variant={mode === "existing" ? "secondary" : "ghost"} onClick={() => { setMode("existing"); setError(""); }}>Use existing job</Btn><Btn aria-pressed={mode === "new"} variant={mode === "new" ? "secondary" : "ghost"} icon="plus" onClick={() => { setMode("new"); setError(""); }}>Create new job</Btn></div>
        <Field label="Timezone for dates and deadline" htmlFor="invitation-zone"><DynamicSelect collection="timezone" id="invitation-zone" value={timezone} onChange={value => { setTimezone(value); setDraft(current => syncWorkSchedule(current, "payType", current.payType, value)); setFields({}); }} /></Field>
        {mode === "existing" ? <>
          <div className="mb-4 flex flex-wrap gap-2"><Btn size="sm" variant={status === "ACTIVE" ? "secondary" : "ghost"} onClick={() => { setStatus("ACTIVE"); setPage(1); }}>Active jobs</Btn><Btn size="sm" variant={status === "DRAFT" ? "secondary" : "ghost"} onClick={() => { setStatus("DRAFT"); setPage(1); }}>Draft jobs</Btn><Btn className="ml-auto" size="sm" variant="ghost" loading={jobs.isFetching} onClick={() => void jobs.refetch()}>Refresh</Btn></div>
          <div className="mb-4 flex gap-2"><input aria-label="Search your jobs" className="input min-w-0 flex-1" placeholder="Search your jobs" value={searchDraft} maxLength={100} onChange={event => setSearchDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); setSearch(searchDraft.trim()); setPage(1); } }} /><Btn icon="search" size="sm" variant="secondary" onClick={() => { setSearch(searchDraft.trim()); setPage(1); }}>Search</Btn></div>
          {jobs.isLoading ? <SectionLoader rows={2} /> : null}
          {jobs.error ? <p className="text-sm text-danger" role="alert">{jobs.error.message} Use Refresh to try again.</p> : null}
          <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1" role="radiogroup" aria-label="Available jobs">
            {choices.map(job => { const problem = jobInvitationProblem(job); return <div key={job.id} className={`rounded-xl border p-4 ${chosen?.id === job.id ? "border-brand bg-brand-tint" : "border-border"}`}>
              <label className="flex items-start gap-3"><input className="mt-1 accent-brand" type="radio" name="hire-job" checked={chosen?.id === job.id} disabled={Boolean(problem) || jobs.isPlaceholderData} onChange={() => { setSelected(job); setError(""); }} /><span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{job.title}</span><span className="mt-1 block text-xs leading-5 text-muted">{displayDate(job.startDate)} · {displayPay(job.payAmount, job.payType)}</span><span className="block text-xs text-muted">{job.city} · {job.status === "DRAFT" ? "Draft" : "Active"}</span></span></label>
              {problem ? <div className="mt-2 pl-6"><p className="text-xs text-muted">{problem}</p><Btn className="mt-1" variant="ghost" size="sm" onClick={() => { onClose(); go("post-job", { jobId: job.id }); }}>Edit job</Btn></div> : null}
            </div>; })}
          </div>
          {!jobs.isLoading && !jobs.error && !choices.length ? <div className="rounded-xl border border-dashed border-border p-6 text-center"><Icon className="mx-auto mb-2 text-brand" name="file" size={24} /><p className="font-semibold">{search ? "No jobs match your search" : `No ${status === "DRAFT" ? "draft" : "active"} jobs`}</p><p className="mt-1 text-sm text-muted">Create a new job here to invite this teacher.</p><Btn className="mt-4" size="sm" variant="secondary" onClick={() => setMode("new")}>Create new job</Btn></div> : null}
          {jobs.data && jobs.data.pagination.totalPages > 1 ? <div className="mt-3 flex items-center justify-between"><Btn size="sm" variant="ghost" disabled={page <= 1 || jobs.isFetching} onClick={() => setPage(page - 1)}>Previous</Btn><span className="text-xs text-muted">Page {page} of {jobs.data.pagination.totalPages}</span><Btn size="sm" variant="ghost" disabled={!jobs.data.pagination.hasNextPage || jobs.isFetching} onClick={() => setPage(page + 1)}>Next</Btn></div> : null}
        </> : <div>
          <p className="mb-4 text-sm leading-6 text-muted">This job starts as a private draft. If this teacher declines and the job is still eligible, it becomes public for other teachers to apply.</p>
          <Field label="Job title" htmlFor="hire-title" required error={fields.title}><input className="input" id="hire-title" required maxLength={200} value={draft.title} onChange={e => update("title", e.target.value)} placeholder="e.g. Year 4 supply teacher" /></Field>
          <Field label="Role details" htmlFor="hire-description" required error={fields.description}><RoleDescriptionEditor id="hire-description" invalid={Boolean(fields.description)} value={draft.description} onChange={value => update("description", value)} /></Field>
          <p className="mb-3 text-xs text-muted">Enter times in the timezone selected above. For an ambiguous clock-change hour, select UTC and enter the equivalent time.</p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {draft.payType === "hourly" ? <HourlyWorkSchedule startDate={draft.startDate} endDate={draft.endDate} errors={fields} timeZone={timezone} required onChange={update} /> : <>
            <Field label="Start date and time" htmlFor="hire-start" required error={fields.startDate}><input className="input" id="hire-start" type="datetime-local" required value={draft.startDate} onChange={e => update("startDate", e.target.value)} /></Field>
            <Field label="End date and time" htmlFor="hire-end" required error={fields.endDate}><input className="input" id="hire-end" type="datetime-local" required min={draft.startDate || undefined} value={draft.endDate} onChange={e => update("endDate", e.target.value)} /></Field>
            </>}
            <div className="col-span-full"><PlannedWorkUnitsField payType={draft.payType} hours={draft.hours} days={draft.days} errors={fields} onChange={update} /></div>
            <Field label="Live from (optional)" htmlFor="hire-live-from" error={fields.liveFrom} hint="If declined, public applications open at the start of this UK date."><input className="input" id="hire-live-from" type="date" value={draft.liveFrom} onChange={e => update("liveFrom", e.target.value)} /></Field>
            <Field label="Listing expiry (optional)" htmlFor="hire-listing-expiry" error={fields.listingExpiresAt} hint="If declined, public applications stay open through this UK date. Choose a day before work starts."><input className="input" id="hire-listing-expiry" type="date" max={draft.startDate ? shiftCalendarDay(ukCalendarDate(zonedDateTimeToIso(draft.startDate, timezone)), -1) || undefined : undefined} min={draft.liveFrom || undefined} value={draft.expiresAt} onChange={e => update("expiresAt", e.target.value)} /></Field>
            <Field label="Pay amount (£)" htmlFor="hire-pay" required error={fields.payAmount}><input className="input" id="hire-pay" type="number" required min="0.01" step="0.01" value={draft.payAmount} onChange={e => update("payAmount", e.target.value)} /></Field>
            <Field label="Pay type" htmlFor="hire-pay-type" required><DynamicSelect collection="payType" id="hire-pay-type" value={draft.payType} onChange={value => update("payType", value)} /></Field>
          </div>
          <div className="mt-2 border-t border-border pt-4"><h3 className="mb-3 font-semibold">Placement location</h3><Field label="Address" htmlFor="hire-address" error={fields.address}><input className="input" id="hire-address" maxLength={250} value={draft.address} onChange={e => update("address", e.target.value)} /></Field><div className="grid gap-x-4 sm:grid-cols-2"><Field label="UK city or town" htmlFor="hire-city" error={fields.city}><DynamicSelect id="hire-city" collection="city" emptyLabel="Not specified" placeholder="Select a UK city or town" searchable error={Boolean(fields.city)} value={draft.city} onChange={value => update("city", value)} /></Field><Field label="Postcode" htmlFor="hire-postcode" error={fields.postalCode}><input className="input" id="hire-postcode" value={draft.postalCode} onChange={e => update("postalCode", e.target.value)} /></Field></div><TeachingSelectionFields otherSkills={draft.otherSkills} otherSkillError={fields.otherSkills} otherSubjects={draft.otherSubjects} otherError={fields.otherSubjects} subjects={draft.subjects} skills={draft.requiredSkills} skillLabel="Required skills" subjectError={fields.subjects} skillError={fields.requiredSkills} onChange={(subjects, requiredSkills, otherSubjects, otherSkills) => setDraft(current => ({ ...current, subjects, requiredSkills, otherSubjects, otherSkills }))} /></div>
        </div>}
        <div className="mt-5 border-t border-border pt-5"><h3 className="mb-3 font-semibold">Invitation details</h3><Field label="Message to the teacher (optional)" htmlFor="invitation-message" error={fields.message}><textarea className="input min-h-24" id="invitation-message" maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Introduce the role and anything the teacher should know." /></Field><Field label="Respond by (optional)" htmlFor="invitation-expiry" error={fields.expiresAt} hint="Leave blank for the default: the earliest of seven days, the job start or listing expiry."><input className="input" id="invitation-expiry" type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} /></Field></div>
        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn type="submit" disabled={mode === "existing" && (!chosen || Boolean(jobInvitationProblem(chosen)) || jobs.isPlaceholderData)}>Review invitation</Btn></div>
      </form>}
    </div>
  </Modal>, document.body);
}

function displayDate(value?: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)) + " (UK)" : "Dates not set"; }
function displayPay(amount?: number | null, type?: string | null) { return amount != null ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount) + (type === "hourly" ? " / hour" : type === "daily" ? " / day" : " fixed") : "Pay not set"; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{value}</dd></div>; }
