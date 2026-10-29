import { useRateLimit } from "@/lib/rate-limit";
import { useSchoolHiringAllowed } from "@/features/auth/use-school-hiring";
import { PlannedWorkUnitsField } from "@/components/molecules/PlannedWorkUnitsField";
import { plannedUnitsInput, formatPlannedUnits } from "@/features/jobs/work-units";
import { syncWorkSchedule, validateScheduleUnits } from "@/features/jobs/schedule-editor";
import { validateJobDateOrder } from "@/features/jobs/date-validation";
import { DynamicSelect, DynamicMultiSelect } from "@/components/molecules/DynamicDropdown";

import { RoleDescriptionEditor } from "@/components/molecules/RoleDescriptionEditor";
import { HourlyWorkSchedule } from "@/components/molecules/HourlyWorkSchedule";
import { TeachingSelectionFields } from "@/components/molecules/TeachingSelectionFields";
import { useTeachingCatalogue } from "@/features/teaching-catalogue/use-teaching-catalogue";
import { toSkillEditor, otherSkillsError, toSubjectEditor, actualSubjects, otherSubjectsError, jobSubjects } from "@/features/teaching-catalogue/selection";
import { useRef, useState } from "react";
import { useSettingsProfile } from "@/features/settings/use-settings";
import type { SettingsInstitutionProfile } from "@/features/settings/types";

import { useCreateJob, useJob, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job, JobCreateInput, JobUpdateInput } from "@/features/jobs/types";
import { formatUkListingInstant, getJobVisibilityLabel, ukCalendarDate, ukDateTimeInput, shiftCalendarDay } from "@/features/jobs/listing-window";
import { isEmptyRichText, richTextToPlainText } from "@/features/applications/rich-text";
import { validateUkCity, validateUkCountry, validateUkPostcode, validateUkRegion } from "@/lib/uk-validation";
import { zonedDateTimeToIso } from "@/lib/zoned-date-time";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Checkbox, Field } from "../atoms";
import { JobListingPreview, type JobListingPreviewData, PageHead, PostcodeLookup, previewDateRange } from "../molecules";

type PostingMode = "instant" | "brief";
type AddressMode = "school" | "different";

type JobFormState = {
  address: string;
  city: string;
  countryCode: string;
  county: string;
  description: string;
  endDate: string;
  expiresAt: string;
  liveFrom: string;
  originalLiveFrom?: string | null;
  originalExpiresAt?: string | null;
  keyStages: string[];
  minExperienceYears: string;
  parkingInfo: string;
  hours: string;
  days: string;
  payAmount: string;
  payType: "daily" | "fixed" | "hourly";
  postalCode: string;
  qtsRequired: boolean;
  startDate: string;
  subjects: string[];
  otherSubjects?: string[]; otherSkills?: string[];
  requiredSkills: string[];
  title: string;
  urgent: boolean;
};

type JobFormErrors = Partial<Record<keyof JobFormState, string>>;
type JobAddress = Pick<JobFormState, "address" | "city" | "countryCode" | "county" | "postalCode">;
const addressKeys: Array<keyof JobAddress> = ["address", "city", "countryCode", "county", "postalCode"];


const initialForm: JobFormState = {
  address: "",
  city: "",
  countryCode: "GB",
  county: "",
  description: "",
  endDate: "",
  expiresAt: "",
  liveFrom: "",
  keyStages: [],
  minExperienceYears: "",
  parkingInfo: "",
  hours: "",
  days: "",
  payAmount: "",
  payType: "daily",
  postalCode: "",
  qtsRequired: false,
  startDate: "",
  subjects: [],
  requiredSkills: [],
  title: "",
  urgent: false,
};

export function PostJobPage({ ctx, go, toast, role }: Pick<RouteProps, "ctx" | "go" | "role" | "toast">) {
  const isEditing = Boolean(ctx.jobId);
  const editingJobQuery = useJob(ctx.jobId ?? "", true);
  const profileQuery = useSettingsProfile();
  const editingJob = ctx.jobId ? editingJobQuery.data : undefined;
  const schoolProfile = profileQuery.data?.institution;

  if ((isEditing && editingJobQuery.isLoading) || (role === "institution" && profileQuery.isLoading)) {
    return (
      <div className="app-page post-job-page">
        <PageHead title="Loading job form" subtitle="Preparing the role and school address." />
        <div className="card card-pad-lg max-w-[1040px] text-sm text-muted">Loading your job details...</div>
      </div>
    );
  }

  if (ctx.jobId && !editingJobQuery.isLoading && !editingJob) {
    return (
      <div className="app-page post-job-page">
        <PageHead title="Job not found" subtitle="This job may have been deleted or belongs to another account." />
        <div className="job-editor-card card card-pad-lg max-w-[1040px]">
          <p className="text-sm leading-6 text-muted">Only jobs posted from your account can be edited here.</p>
          <Btn className="mt-5" icon="arrowLeft" onClick={() => go("dashboard")} variant="secondary">
            Back to dashboard
          </Btn>
        </div>
      </div>
    );
  }

  if (editingJob?.termsLocked) return <div className="app-page post-job-page"><PageHead title={editingJob.title} subtitle="Agreed terms are locked" /><div className="card card-pad-lg"><p className="mb-4 text-sm text-muted">This job has offer or publication history. Its material terms are read-only. Create a new job to offer different terms.</p><div className="flex flex-wrap gap-3"><Btn onClick={() => go("post-job")}>Create a new job</Btn><Btn variant="secondary" onClick={() => go("job-detail", { jobId: editingJob.id })}>View terms</Btn><Btn variant="ghost" onClick={() => go("dashboard")}>Manage job status</Btn></div></div></div>;

  const schoolAddress = addressFromSchoolProfile(schoolProfile);
  const initialValues = editingJob
    ? toFormState(editingJob)
    : schoolAddress
      ? { ...initialForm, ...schoolAddress }
      : initialForm;
  const initialAddressMode: AddressMode = schoolAddress && (!editingJob || sameAddress(initialValues, schoolAddress))
    ? "school"
    : "different";

  return (
    <PostJobEditor
      key={editingJob?.id ?? "new-job"}
      editingJob={editingJob}
      go={go}
      initialMode={editingJob?.mode ?? "instant"}
      initialAddressMode={initialAddressMode}
      initialValues={initialValues}
      role={role}
      schoolAddress={schoolAddress}
      schoolImageUrl={schoolProfile?.imageUrl}
      schoolName={schoolProfile?.name}
      toast={toast}
    />
  );
}

function PostJobEditor({
  editingJob,
  go,
  initialAddressMode,
  initialMode,
  initialValues,
  role,
  schoolAddress,
  schoolImageUrl,
  schoolName,
  toast,
}: Pick<RouteProps, "go" | "role" | "toast"> & {
  editingJob?: Job;
  initialAddressMode: AddressMode;
  initialMode: PostingMode;
  initialValues: JobFormState;
  schoolAddress: JobAddress | null;
  schoolImageUrl?: string;
  schoolName?: string;
}) {
  const catalogue = useTeachingCatalogue();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<PostingMode>(initialMode);
  const [form, setForm] = useState<JobFormState>(initialValues);
  const [addressMode, setAddressMode] = useState<AddressMode>(initialAddressMode);
  const [differentAddress, setDifferentAddress] = useState<JobAddress>(
    initialAddressMode === "different" ? pickAddress(initialValues) : emptyAddress(),
  );
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [savingIntent, setSavingIntent] = useState<"draft" | "publish" | null>(null);
  const savedJobIdRef = useRef<string | undefined>(editingJob?.id);
  const savingRef = useRef(false);
  const retryAfter = useRateLimit();
  const hiringAllowed = useSchoolHiringAllowed();
  const isEditing = Boolean(editingJob);
  const todayDate = getTodayDateInput();
  const savedExpiryUnchanged = Boolean(form.originalExpiresAt && form.expiresAt === ukCalendarDate(form.originalExpiresAt, true));
  const earliestWorkStart = [todayDate + "T00:00", form.liveFrom ? form.liveFrom + "T00:01" : "", savedExpiryUnchanged ? ukDateTimeInput(form.originalExpiresAt) : form.expiresAt ? shiftCalendarDay(form.expiresAt, 1) + "T00:00" : ""].sort().at(-1)!;
  const latestListingDay = form.startDate ? savedExpiryUnchanged && Date.parse(form.originalExpiresAt!) <= Date.parse(toWorkIso(form.startDate) ?? "") ? form.expiresAt : shiftCalendarDay(form.startDate, -1) : undefined;

  const createJob = useCreateJob({
    onSuccess: async (result) => {
      savingRef.current = false;
      if (!result.ok) {
        if (result.savedJobId) savedJobIdRef.current = result.savedJobId;
        setSavingIntent(null);
        if (result.fieldErrors) {
          setErrors(result.fieldErrors as JobFormErrors);
          if (!isEditing) setStep(firstInvalidStep(result.fieldErrors as JobFormErrors));
        }
        toast({ title: "Could not save job", msg: result.message ?? "Please check the details and try again.", tone: "danger" });
        return;
      }

      const published = result.data.status === "ACTIVE";
      const scheduled = published && getJobVisibilityLabel(result.data) === "scheduled";
      toast({
        title: scheduled ? "Job scheduled" : published ? "Job published" : "Draft saved",
        msg: scheduled ? `The listing will open ${formatUkListingInstant(result.data.liveFrom)}.` : published ? "The role is live and ready for applications." : "You can finish and publish this role later.",
        tone: "success",
      });
      setSavingIntent(null);
      go(published ? "applications" : "dashboard", published ? { jobId: result.data.id } : undefined);
    },
    onError: () => {
      savingRef.current = false;
      setSavingIntent(null);
      toast({ title: "Could not save job", msg: "Please check the details and try again.", tone: "danger" });
    },
  });
  const updateJob = useUpdateJob({
    onSuccess: async (result) => {
      savingRef.current = false;
      if (!result.ok) {
        setSavingIntent(null);
        if (result.fieldErrors) {
          setErrors(result.fieldErrors as JobFormErrors);
          if (!isEditing) setStep(firstInvalidStep(result.fieldErrors as JobFormErrors));
        }
        toast({ title: "Could not update job", msg: result.message ?? "Please check the details and try again.", tone: "danger" });
        return;
      }

      const published = result.data?.status === "ACTIVE";
      const scheduled = published && result.data && getJobVisibilityLabel(result.data) === "scheduled";
      toast({
        title: scheduled ? "Job scheduled" : published ? "Job updated" : "Draft saved",
        msg: scheduled && result.data ? `The listing will open ${formatUkListingInstant(result.data.liveFrom)}.` : published ? "The live role details are updated." : "Your draft changes were saved.",
        tone: "success",
      });
      setSavingIntent(null);
      go(published ? "applications" : "dashboard", published && result.data ? { jobId: result.data.id } : undefined);
    },
    onError: () => {
      savingRef.current = false;
      setSavingIntent(null);
      toast({ title: "Could not update job", msg: "Please check the details and try again.", tone: "danger" });
    },
  });

  const saving = createJob.isPending || updateJob.isPending;

  function updateForm<Key extends keyof JobFormState>(key: Key, value: JobFormState[Key]) {
    if (addressMode === "different" && isAddressKey(key)) {
      setDifferentAddress((current) => ({ ...current, [key]: value as string }));
    }
    setForm((current) => syncWorkSchedule(current, key, value));
    setErrors((current) => {
      const nextForm = syncWorkSchedule(form, key, value);
      if (["startDate", "endDate", "liveFrom", "expiresAt", "payType", "hours", "days"].includes(key)) {
        const dates = { ...validateJobDates(nextForm), ...validateScheduleUnits(nextForm) };
        return { ...current, hours: dates.hours, days: dates.days, startDate: dates.startDate, endDate: dates.endDate, liveFrom: dates.liveFrom, expiresAt: dates.expiresAt };
      }
      return current[key] ? { ...current, [key]: validateAll(nextForm)[key] } : current;
    });
  }

  function chooseAddressMode(nextMode: AddressMode) {
    if (nextMode === addressMode || (nextMode === "school" && !schoolAddress)) return;
    const nextAddress = nextMode === "school" ? schoolAddress : differentAddress;
    if (!nextAddress) return;

    setAddressMode(nextMode);
    setForm((current) => ({ ...current, ...nextAddress }));
    setErrors((current) => ({
      ...current,
      address: undefined,
      city: undefined,
      countryCode: undefined,
      county: undefined,
      postalCode: undefined,
    }));
  }

  function nextStep() {
    const nextErrors = validateStep(step, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep((current) => Math.min(4, current + 1));
  }

  function saveDraft() {
    const draftErrors = { ...validateDraft(form), ...expiryClearError(editingJob, form) };
    setErrors(draftErrors);
    if (Object.keys(draftErrors).length > 0) {
      if (!isEditing) setStep(firstInvalidStep(draftErrors));
      return;
    }

    saveJob("DRAFT");
  }

  function publish() {
    const nextErrors = { ...validateAll(form), ...expiryClearError(editingJob, form) };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (!isEditing) setStep(firstInvalidStep(nextErrors));
      return;
    }

    saveJob("ACTIVE");
  }

  function saveJob(status: Extract<JobCreateInput["status"], "ACTIVE" | "DRAFT">) {
    if (savingRef.current || retryAfter || (status === "ACTIVE" && !hiringAllowed)) return;
    savingRef.current = true;
    const payload = toJobCreateInput(form, mode, status, catalogue.data);
    setSavingIntent(status === "ACTIVE" ? "publish" : "draft");

    if (savedJobIdRef.current) {
      updateJob.mutate(toChangedJobUpdateInput(payload, toJobCreateInput(initialValues, initialMode, status, catalogue.data), savedJobIdRef.current));
      return;
    }

    createJob.mutate(payload);
  }

  function renderPostingTypeSection() {
    return (
      <div>
        <div className="eyebrow mb-2.5">{isEditing ? "Posting type" : "Step 1 - Posting type"}</div>
        <h2 className="mb-5 font-heading text-[26px]">How do you want to staff this role?</h2>
        <div className="grid-2">
          {[
            { value: "instant" as const, title: "Instant matching", desc: "Best for urgent or same-day cover.", color: "var(--se)", bg: "var(--se-tint)" },
            { value: "brief" as const, title: "Open brief", desc: "Best for planned, long-term, or proposal-led cover.", color: "var(--purple)", bg: "var(--purple-tint)" },
          ].map((option) => (
            <button
              key={option.value}
              aria-pressed={mode === option.value}
              className="posting-type-choice cursor-pointer rounded-xl border p-5 text-left transition"
              onClick={() => setMode(option.value)}
              style={{
                background: mode === option.value ? option.bg : "var(--surface)",
                borderColor: mode === option.value ? option.color : "var(--border)",
                borderWidth: 1.5,
              }}
              type="button"
            >
              <div className="mb-2 font-heading text-xl">{option.title}</div>
              <div className="text-muted">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderDetailsFields() {
    return (
      <div>
        <div className="grid-2">
          <Field error={errors.title} label="Job title" required>
            <input
              className="input"
              placeholder="e.g. Y6 Maths cover - 1 day"
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
            />
          </Field>

          <div className="md:col-span-2 rounded-xl border border-border bg-chalk/40 p-4">
            <div className="text-sm font-semibold">Role location</div>
            <p className="mt-1 text-xs leading-5 text-muted">Choose whether this role takes place at your saved school address or somewhere else.</p>
            <div aria-label="Choose the role address" className="mt-4 grid gap-3 sm:grid-cols-2" role="group">
              <button
                aria-pressed={addressMode === "school"}
                className={`rounded-xl border p-4 text-left transition ${addressMode === "school" ? "border-brand bg-brand-tint text-ink" : "border-border bg-surface text-muted hover:border-brand"}`}
                disabled={!schoolAddress}
                onClick={() => chooseAddressMode("school")}
                type="button"
              >
                <span className="block font-semibold text-ink">Use school address</span>
                <span className="mt-1 block text-xs leading-5">{schoolAddress ? formatAddress(schoolAddress) : "Add a complete school address in Settings first."}</span>
              </button>
              <button
                aria-pressed={addressMode === "different"}
                className={`rounded-xl border p-4 text-left transition ${addressMode === "different" ? "border-brand bg-brand-tint text-ink" : "border-border bg-surface text-muted hover:border-brand"}`}
                onClick={() => chooseAddressMode("different")}
                type="button"
              >
                <span className="block font-semibold text-ink">Use a different address</span>
                <span className="mt-1 block text-xs leading-5">Enter the complete location for this role.</span>
              </button>
            </div>
            {addressMode === "school" && schoolAddress ? (
              <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">Saved school address</div>
                {schoolName ? <div className="mt-2 font-semibold text-ink">{schoolName}</div> : null}
                <div className="mt-1 text-sm leading-6 text-muted">{formatAddress(schoolAddress)}</div>
              </div>
            ) : null}
            {addressMode === "different" ? <div className="mt-4 grid gap-4 md:grid-cols-2">
              <PostcodeLookup
                error={errors.postalCode}
                hint="Check the postcode area, then select the city or town."
                id="post-job-postcode"
                onChange={(value) => updateForm("postalCode", value)}
                onSelect={(selection) => {
                  updateForm("postalCode", selection.postcode);
                  updateForm("countryCode", "GB");
                  if (selection.city) updateForm("city", selection.city);
                  if (selection.county) updateForm("county", selection.county);
                }}
                value={form.postalCode}
              />
              <Field error={errors.address} label="Address">
                <input className="input" maxLength={250} placeholder="School or street address" value={form.address} onChange={(event) => updateForm("address", event.target.value)} />
              </Field>
              <Field error={errors.city} label="City or town">
                <DynamicSelect collection="city" emptyLabel="Not specified" placeholder="Select a UK city or town" searchable value={form.city} onChange={(value) => updateForm("city", value)} />
              </Field>
              <Field error={errors.county} label="County or region">
                <DynamicSelect collection="region" emptyLabel="Not specified" placeholder="Select a UK county or region" searchable value={form.county} onChange={(value) => updateForm("county", value)} />
              </Field>
              <Field error={errors.countryCode} hint="United Kingdom addresses only, including Northern Ireland." label="Country">
                <DynamicSelect collection="country" value={form.countryCode} onChange={(value) => updateForm("countryCode", value)} />
              </Field>
            </div> : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-[220px_minmax(0,1fr)]">
            <Field label="Pay basis">
              <DynamicSelect
                collection="payType"
                value={form.payType}
                onChange={(value) => updateForm("payType", value as JobFormState["payType"])}
              />
            </Field>
            <Field error={errors.payAmount} label="Pay amount (£)">
              <input
                className="input"
                min={0}
                placeholder="180"
                type="number"
                value={form.payAmount}
                onChange={(event) => updateForm("payAmount", event.target.value)}
              />
            </Field>
          </div>
          {form.payType === "hourly" ? <HourlyWorkSchedule startDate={form.startDate} endDate={form.endDate} errors={errors} minDate={earliestWorkStart.slice(0, 10)} onChange={updateForm} /> : <>
          <Field error={errors.startDate} hint="When the teacher starts work, in UK local time. Must be after Live from, with the listing closed by this time." label="Work start">
            <input className="input" min={earliestWorkStart} type="datetime-local" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} />
          </Field>
          <Field error={errors.endDate} hint="UK local time. Must be on or after the work start." label="Work end">
            <input className="input" min={form.startDate > earliestWorkStart ? form.startDate : earliestWorkStart} type="datetime-local" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} />
          </Field>
          </>}
          {form.payType === "hourly" || form.payType === "daily" ? <div className="md:col-span-2"><PlannedWorkUnitsField payType={form.payType} hours={form.hours} days={form.days} errors={errors} onChange={updateForm} /></div> : null}
          <Field error={errors.liveFrom} hint="Teachers can see and apply for the published job from midnight on this UK date. Leave blank to open when published. Must be before Work start." label="Live from">
            <input className="input" min={todayDate} max={form.startDate ? (form.startDate.endsWith("T00:00") ? shiftCalendarDay(form.startDate, -1) : form.startDate.slice(0, 10)) : undefined} type="date" value={form.liveFrom} onChange={(event) => updateForm("liveFrom", event.target.value)} />
          </Field>
          <Field error={errors.expiresAt} hint={editingJob?.expiresAt ? `Applications currently close ${formatUkListingInstant(editingJob.expiresAt)}. Choose a replacement date to keep applications open through that UK day. The final listing day must be before work starts.` : "Optional. Teachers can apply through this entire UK date, then the listing closes. Choose a final listing day before work starts."} label="Listing expiry">
            <input className="input" min={form.liveFrom > todayDate ? form.liveFrom : todayDate} max={latestListingDay} type="date" value={form.expiresAt} onChange={(event) => updateForm("expiresAt", event.target.value)} />
          </Field>
          <Field error={errors.minExperienceYears} label="Minimum experience (years)">
            <input
              className="input"
              min={0}
              placeholder="e.g. 2"
              step={1}
              type="number"
              value={form.minExperienceYears}
              onChange={(event) => updateForm("minExperienceYears", event.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <TeachingSelectionFields otherSkills={form.otherSkills} otherSkillError={errors.otherSkills} otherSubjects={form.otherSubjects} otherError={errors.otherSubjects} subjects={form.subjects} skills={form.requiredSkills} skillLabel="Required skills" subjectError={errors.subjects} skillError={errors.requiredSkills} onChange={(subjects, requiredSkills, otherSubjects, otherSkills) => setForm(current => ({ ...current, subjects, requiredSkills, otherSubjects, otherSkills }))} />
          </div>
        </div>
        <Field error={errors.description} label="Role description" required>
          <RoleDescriptionEditor
            id="job-description"
            invalid={Boolean(errors.description)}
            value={form.description}
            onChange={value => updateForm("description", value)}
          />
        </Field>
      </div>
    );
  }

  function renderRequirementsFields() {
    return (
      <div>
        <div className="grid-2">
          <Field error={errors.keyStages} htmlFor="job-key-stages" label="Key stages">
            <DynamicMultiSelect
              id="job-key-stages"
              collection="keyStage"
              placeholder="Select key stages"
              value={form.keyStages}
              onChange={(value) => updateForm("keyStages", value)}
            />
          </Field>
        </div>
        <Field error={errors.parkingInfo} label="Parking / arrival notes">
          <textarea
            className="textarea"
            placeholder="e.g. Parking available on-site. Please sign in at reception."
            value={form.parkingInfo}
            onChange={(event) => updateForm("parkingInfo", event.target.value)}
          />
        </Field>
        <div className="grid-2">
          <Field label="Posting options">
            <div className="flex flex-col gap-2">
              <Checkbox checked={form.qtsRequired} label="QTS qualified" onChange={(value) => updateForm("qtsRequired", value)} />
              <Checkbox checked={form.urgent} label="Mark as urgent" onChange={(value) => updateForm("urgent", value)} />
            </div>
          </Field>
        </div>
      </div>
    );
  }

  function renderReviewSummary(eyebrow = "Step 4 - Review") {
    const previewDescription = readEditableDescription(form.description);
    const preview: JobListingPreviewData = {
      date: previewDateRange(toWorkIso(form.startDate), toWorkIso(form.endDate)),
      description: richTextToPlainText(previewDescription),
      experience: form.minExperienceYears ? `${form.minExperienceYears}+ years experience` : undefined,
      keyStages: form.keyStages,
      listingDetails: [
        form.liveFrom ? `Opens ${formatPreviewCalendarDate(form.liveFrom)}` : "Opens when published",
        ...(form.expiresAt ? [`Applications close ${formatPreviewCalendarDate(form.expiresAt)}`] : []),
      ],
      location: formatAddress(pickAddress(form)) || "Location TBC",
      mode,
      pay: formatPay(form),
      plannedWork: form.payType !== "fixed" ? formatPlannedUnits(plannedUnitsInput(form.payType, form.hours, form.days)) : undefined,
      schoolImageUrl,
      schoolName: schoolName || "Your school",
      skills: [...actualSubjects(form.requiredSkills, form.otherSkills), ...(form.qtsRequired ? ["QTS required"] : [])],
      status: { label: isEditing ? "Current preview" : "Ready to publish", tone: "green" },
      subjects: actualSubjects(form.subjects, form.otherSubjects),
      title: form.title || "Untitled teaching role",
      urgent: form.urgent,
    };

    return (
      <div>
        <div className="eyebrow mb-2.5">{eyebrow}</div>
        <JobListingPreview data={preview} />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="app-page post-job-page">
        <PageHead
          title="Edit job post"
          subtitle="Update the complete role in one place, save it as a draft, or publish the latest version."
        />

        <div className="job-editor-card card card-pad-lg max-w-[1280px]">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <div className="space-y-10">
              {renderPostingTypeSection()}
              <section>
                <div className="eyebrow mb-2.5">Role details</div>
                {renderDetailsFields()}
              </section>
              <section>
                <div className="eyebrow mb-2.5">Requirements and publishing</div>
                {renderRequirementsFields()}
              </section>
            </div>

            <aside aria-label="Job preview" className="xl:sticky xl:top-[92px] xl:self-start">
              {renderReviewSummary("Live preview")}
            </aside>
          </div>

          <div className="job-editor-actions mt-8 flex items-center justify-between border-t border-border pt-6">
            <Btn variant="ghost" onClick={() => go("dashboard")}>
              Cancel
            </Btn>
            <div className="flex flex-wrap justify-end gap-2">
              <Btn
                disabled={saving || Boolean(retryAfter)}
                loading={savingIntent === "draft"}
                loadingLabel="Saving draft"
                onClick={saveDraft}
                size="lg"
                variant="secondary"
              >
                Save draft
              </Btn>
              <Btn
                disabled={saving || Boolean(retryAfter) || !hiringAllowed}
                iconRight="send"
                loading={savingIntent === "publish"}
                loadingLabel="Updating"
                onClick={publish}
                size="lg"
              >
                Update and publish
              </Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page post-job-page">
      <PageHead
        title={isEditing ? "Edit job post" : "Post a new role"}
        subtitle={isEditing ? "Update the role, keep it as draft, or publish the latest version." : "Create the role once, publish it to active listings, then review applications from the same workspace."}
      />
      <div aria-label="Posting progress" className="job-posting-progress mb-7">
        {["Type", "Details", "Requirements", "Review"].map((label, index) => (
          <div aria-current={index + 1 === step ? "step" : undefined} key={label} className="job-posting-step flex items-center gap-2">
            <div className={`step ${index + 1 < step ? "done" : index + 1 === step ? "active" : ""}`}>{index + 1}</div>
            <span className={index + 1 === step ? "font-semibold" : "text-muted"}>{label}</span>
            {index < 3 ? <div className={`step-bar ${index + 1 < step ? "done" : ""}`} /> : null}
          </div>
        ))}
      </div>

      <div className="job-editor-card card card-pad-lg max-w-[1040px]">
        {step === 1 ? renderPostingTypeSection() : null}

        {step === 2 ? renderDetailsFields() : null}

        {step === 3 ? renderRequirementsFields() : null}

        {step === 4 ? renderReviewSummary() : null}

        <div className="job-editor-actions mt-8 flex items-center justify-between">
          <Btn variant="ghost" onClick={() => (step > 1 ? setStep(step - 1) : go("dashboard"))}>
            {step > 1 ? "Back" : "Cancel"}
          </Btn>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              disabled={saving || Boolean(retryAfter)}
              loading={savingIntent === "draft"}
              loadingLabel="Saving draft"
              onClick={saveDraft}
              size="lg"
              variant="secondary"
            >
              Save draft
            </Btn>
            <Btn
              disabled={saving || Boolean(retryAfter) || (step === 4 && !hiringAllowed)}
              iconRight={step === 4 ? "send" : "arrow"}
              loading={savingIntent === "publish"}
              loadingLabel={isEditing ? "Updating" : "Publishing"}
              onClick={() => (step < 4 ? nextStep() : publish())}
              size="lg"
            >
              {step < 4 ? "Continue" : isEditing ? "Update and publish" : "Publish job"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function validateStep(step: number, form: JobFormState): JobFormErrors {
  if (step === 2) {
    return pickErrors(validateAll(form), ["address", "city", "countryCode", "county", "description", "endDate", "liveFrom", "expiresAt", "minExperienceYears", "payAmount", "hours", "days", "postalCode", "requiredSkills", "startDate", "subjects", "otherSubjects", "otherSkills", "title"]);
  }
  if (step === 3) return pickErrors(validateAll(form), ["parkingInfo", "keyStages"]);
  return {};
}

function validateAll(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};

  if (!form.title.trim()) errors.title = "Enter a job title.";
  Object.assign(errors, validateJobDates(form));
  Object.assign(errors, validateOptionalJobFields(form));
  if (isEmptyRichText(form.description) || richTextToPlainText(form.description).length < 20) errors.description = "Add role details of at least 20 characters.";

  return errors;
}

function validateDraft(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};

  if (!form.title.trim()) errors.title = "Enter a job title before saving a draft.";
  if (isEmptyRichText(form.description)) errors.description = "Add a short role description before saving a draft.";
  Object.assign(errors, validateJobDates(form));
  Object.assign(errors, validateOptionalJobFields(form));

  return errors;
}

function validateOptionalJobFields(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};
  Object.assign(errors, validateScheduleUnits(form));
  const skillCustomError = otherSkillsError(form.requiredSkills, form.otherSkills);
  if (skillCustomError) errors.otherSkills = skillCustomError;
  const otherError = otherSubjectsError(form.subjects, form.otherSubjects);
  if (otherError) errors.otherSubjects = otherError;
  const postcode = validateUkPostcode(form.postalCode);
  const country = validateUkCountry(form.countryCode, { required: true });
  const city = validateUkCity(form.city);
  const county = validateUkRegion(form.county);
  if (!postcode.valid) errors.postalCode = postcode.error;
  if (!country.valid) errors.countryCode = country.error;
  if (!city.valid) errors.city = city.error;
  if (!county.valid) errors.county = county.error;
  for (const [key, limit] of [["title", 200], ["address", 250], ["description", 10000], ["parkingInfo", 1000]] as const) {
    if (form[key].trim().length > limit) errors[key] = `Use ${limit} characters or fewer.`;
  }
  for (const [key, limit] of [["subjects", 50], ["requiredSkills", 50], ["keyStages", 100]] as const) {
    if (form[key].length > limit || form[key].some(value => !value.trim() || value.length > 100)) errors[key] = `Choose up to ${limit} values, each with 1 to 100 characters.`;
  }

  if (form.payAmount.trim()) {
    const payAmount = Number(form.payAmount);
    if (!Number.isFinite(payAmount) || payAmount < 0) errors.payAmount = "Enter a valid pay amount.";
  }
  if (form.minExperienceYears.trim()) {
    const years = Number(form.minExperienceYears);
    if (!Number.isInteger(years) || years < 0) errors.minExperienceYears = "Enter a whole number of 0 or more.";
  }
  return errors;
}

function validateJobDates(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};
  const todayDate = getTodayDateInput();

  for (const key of ["liveFrom", "expiresAt"] as const) {
    if (form[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(form[key]) || !Number.isFinite(Date.parse(form[key])) || new Date(form[key]).toISOString().slice(0, 10) !== form[key])) errors[key] = "Enter a valid date.";
  }

  for (const key of ["startDate", "endDate"] as const) if (form[key] && !zonedDateTimeToIso(form[key], "Europe/London")) errors[key] = "Enter an unambiguous UK date and time.";

  if (form.startDate && form.startDate.slice(0, 10) < todayDate) {
    errors.startDate = "Start date cannot be before today.";
  }
  const liveFrom = form.originalLiveFrom && form.liveFrom === ukCalendarDate(form.originalLiveFrom) ? form.originalLiveFrom : form.liveFrom;
  const expiresAt = form.originalExpiresAt && form.expiresAt === ukCalendarDate(form.originalExpiresAt, true) ? form.originalExpiresAt : form.expiresAt;
  const orderErrors = validateJobDateOrder({ startDate: toWorkIso(form.startDate), endDate: toWorkIso(form.endDate), liveFrom, expiresAt });
  Object.assign(errors, orderErrors);
  if (form.expiresAt && form.expiresAt < todayDate) errors.expiresAt = "Listing expiry cannot be before today.";

  return errors;
}

function pickErrors(errors: JobFormErrors, keys: Array<keyof JobFormState>) {
  return keys.reduce<JobFormErrors>((selected, key) => {
    if (errors[key]) selected[key] = errors[key];
    return selected;
  }, {});
}

function firstInvalidStep(errors: JobFormErrors) {
  if (errors.title || errors.address || errors.city || errors.countryCode || errors.county || errors.subjects || errors.otherSubjects || errors.otherSkills || errors.startDate || errors.endDate || errors.liveFrom || errors.expiresAt || errors.payAmount || errors.hours || errors.days || errors.minExperienceYears || errors.postalCode || errors.description || errors.requiredSkills) return 2;
  if (errors.parkingInfo || errors.keyStages) return 3;
  return 4;
}

function expiryClearError(editingJob: Job | undefined, form: JobFormState): JobFormErrors {
  return editingJob?.expiresAt && !form.expiresAt
    ? { expiresAt: "Replace the existing listing expiry with another date. Clearing it is not supported." }
    : {};
}

function toJobCreateInput(form: JobFormState, mode: PostingMode, status: Extract<JobCreateInput["status"], "ACTIVE" | "DRAFT">, catalogue?: import("@/features/teaching-catalogue/types").TeachingCatalogue): JobCreateInput {
  return {
    address: form.address || undefined,
    city: validateUkCity(form.city).value || undefined,
    countryCode: validateUkCountry(form.countryCode).value,
    county: validateUkRegion(form.county).value || undefined,
    description: buildDescription(form, mode),
    endDate: toWorkIso(form.endDate),
    expiresAt: form.expiresAt || undefined,
    liveFrom: form.liveFrom || undefined,
    keyStages: form.keyStages,
    minExperienceYears: form.minExperienceYears ? Number(form.minExperienceYears) : undefined,
    parkingInfo: form.parkingInfo,
    payAmount: form.payAmount ? Number(form.payAmount) : undefined,
    payType: form.payType,
    ...plannedUnitsInput(form.payType, form.hours, form.days),
    postalCode: validateUkPostcode(form.postalCode).value || undefined,
    requiredSkills: toSkillEditor(catalogue, form.requiredSkills, form.otherSkills).skills,
    otherSkills: toSkillEditor(catalogue, form.requiredSkills, form.otherSkills).otherSkills,
    startDate: toWorkIso(form.startDate),
    status,
    ...toSubjectEditor(catalogue, form.subjects, form.otherSubjects),
    title: form.title,
  };
}

function toChangedJobUpdateInput(current: JobCreateInput, initial: JobCreateInput, id: string): JobUpdateInput {
  const update: Record<string, unknown> = { id, status: current.status };
  for (const key of Object.keys(current) as Array<keyof JobCreateInput>) {
    if (key === "status") continue;
    const currentValue = current[key];
    const initialValue = initial[key];
    if (JSON.stringify(currentValue) === JSON.stringify(initialValue)) continue;
    if (key === "liveFrom" && currentValue === undefined) update.liveFrom = null;
    else if (key === "expiresAt" && currentValue === undefined && initialValue !== undefined) continue;
    else update[key] = currentValue;
  }
  if ("subjects" in update || "requiredSkills" in update || "otherSubjects" in update || "otherSkills" in update) { update.subjects = current.subjects; update.requiredSkills = current.requiredSkills; update.otherSubjects = current.otherSubjects; update.otherSkills = current.otherSkills; }
  return update as JobUpdateInput;
}

function buildDescription(form: JobFormState, mode: PostingMode) {
  const description = readEditableDescription(form.description);
  const notes = [
    description,
    `Posting route: ${mode === "instant" ? "Instant matching" : "Open brief"}.`,
    form.urgent ? "Marked urgent by the hiring account." : "",
    form.qtsRequired ? "QTS requested." : "",
  ].filter(Boolean);

  return notes.join("\n\n");
}

function toWorkIso(value: string) {
  if (!value) return undefined;
  return zonedDateTimeToIso(value, "Europe/London") || undefined;
}

function getTodayDateInput() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function toFormState(job: Job): JobFormState {
  return {
    address: job.address ?? "",
    city: job.city === "Location TBC" ? "" : job.city,
    countryCode: job.countryCode ?? "GB",
    county: job.county ?? "",
    description: readEditableDescription(job.description ?? ""),
    endDate: ukDateTimeInput(job.endDate),
    expiresAt: ukCalendarDate(job.expiresAt, true),
    liveFrom: ukCalendarDate(job.liveFrom),
    originalLiveFrom: job.liveFrom,
    originalExpiresAt: job.expiresAt,
    keyStages: job.keyStages?.length ? job.keyStages : [],
    minExperienceYears: job.minExperienceYears != null ? String(job.minExperienceYears) : "",
    parkingInfo: job.parkingInfo ?? "",
    payAmount: job.payAmount != null && job.payAmount > 0 ? String(job.payAmount) : job.rate ? String(job.rate) : "",
    hours: job.hours == null ? "" : String(job.hours),
    days: job.days == null ? "" : String(job.days),
    payType: isPayType(job.payType) ? job.payType : "daily",
    postalCode: job.postalCode ?? "",
    qtsRequired: job.description?.includes("QTS requested.") ?? false,
    startDate: ukDateTimeInput(job.startDate),
    subjects: jobSubjects(job),
    requiredSkills: job.requiredSkills,
    title: job.title,
    urgent: job.description?.includes("Marked urgent by the hiring account.") || job.urgent,
  };
}

function readEditableDescription(description: string) {
  return description
    .split(/\r?\n/)
    .filter((line) => !isGeneratedDescriptionLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isGeneratedDescriptionLine(line: string) {
  return /^(Posting route:\s*(Instant matching|Open brief)\.|Marked urgent by the hiring account\.|QTS requested\.)$/i.test(line.trim());
}

function isPayType(value: Job["payType"]): value is JobFormState["payType"] {
  return value === "daily" || value === "fixed" || value === "hourly";
}

function formatPayTypeLabel(value: JobFormState["payType"]) {
  if (value === "hourly") return "Hourly";
  if (value === "fixed") return "Fixed";
  return "Daily";
}

function readPayTypeLabel(value: string): JobFormState["payType"] {
  const normalized = value.toLowerCase();
  if (normalized === "hourly" || normalized === "fixed") return normalized;
  return "daily";
}

function formatPay(form: JobFormState) {
  const amount = Number(form.payAmount);
  if (!Number.isFinite(amount) || amount <= 0) return "Rate TBC";
  if (form.payType === "hourly") return `£${amount}/hr`;
  if (form.payType === "fixed") return `£${amount} fixed`;
  return `£${amount}/day`;
}

function formatPreviewCalendarDate(value: string) {
  const parsed = Date.parse(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(parsed))
    : "Date TBC";
}

function addressFromSchoolProfile(profile?: SettingsInstitutionProfile): JobAddress | null {
  if (!profile?.address.trim() || !profile.city.trim()) return null;
  return {
    address: profile.address.trim(),
    city: profile.city.trim(),
    countryCode: profile.countryCode.trim() || "GB",
    county: profile.county.trim(),
    postalCode: profile.postalCode.trim(),
  };
}

function emptyAddress(): JobAddress {
  return { address: "", city: "", countryCode: "GB", county: "", postalCode: "" };
}

function pickAddress(form: JobFormState): JobAddress {
  return {
    address: form.address,
    city: form.city,
    countryCode: form.countryCode,
    county: form.county,
    postalCode: form.postalCode,
  };
}

function isAddressKey(key: keyof JobFormState): key is keyof JobAddress {
  return addressKeys.includes(key as keyof JobAddress);
}

function sameAddress(left: JobAddress, right: JobAddress) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
  return (Object.keys(right) as Array<keyof JobAddress>).every((key) => normalize(left[key]) === normalize(right[key]));
}

function formatAddress(address: JobAddress) {
  const locationParts = [address.address, address.city, address.county, address.postalCode]
    .map((part) => part.trim())
    .filter(Boolean);
  if (!locationParts.length) return "";
  const country = address.countryCode.toUpperCase() === "GB" ? "United Kingdom" : address.countryCode;
  return [...locationParts, country.trim()].filter(Boolean).join(", ");
}
