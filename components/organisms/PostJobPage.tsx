import { useSettingsProfile } from "@/features/settings/use-settings";
import { hasJobExpired } from "@/features/jobs/presentation";
import { useEffect, useRef, useState } from "react";

import { useApplicationDocumentRequirements } from "@/features/document-requirements/use-document-requirements";
import { useCreateJob, useMyJobs, useUpdateJob } from "@/features/jobs/use-jobs";
import type { Job, JobCreateInput, JobUpdateInput } from "@/features/jobs/types";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Checkbox, Field, Tag } from "../atoms";
import { FormattedJobDescription, PageHead, TagInput } from "../molecules";
import { MultiSelectDropdown, SelectDropdown } from "../molecules/OptionDropdowns";

type PostingMode = "instant" | "brief";

type JobFormState = {
  latitude: string;
  longitude: string;
  qtsRequired: boolean;
  urgent: boolean;
  address: string;
  city: string;
  countryCode: string;
  county: string;
  description: string;
  documentRequirementIds: string[];
  endDate: string;
  expiresAt: string;
  keyStages: string[];
  minExperienceYears: string;
  parkingInfo: string;
  payAmount: string;
  payType: "daily" | "fixed" | "hourly";
  postalCode: string;
  startDate: string;
  subject: string;
  requiredSkills: string[];
  title: string;
};

type JobFormErrors = Partial<Record<keyof JobFormState, string>>;

const keyStageOptions = ["EYFS", "KS1", "KS2", "KS3", "KS4", "KS5"];
const subjectOptions = ["Maths", "English", "Science", "All Primary", "SEN", "Humanities", "Modern Languages"];
const payTypeOptions = ["Daily", "Hourly", "Fixed"];

const initialForm: JobFormState = {
  latitude: "",
  longitude: "",
  qtsRequired: false,
  urgent: false,
  address: "",
  city: "",
  countryCode: "GB",
  county: "",
  description: "",
  documentRequirementIds: [],
  endDate: "",
  expiresAt: "",
  keyStages: [],
  minExperienceYears: "",
  parkingInfo: "",
  payAmount: "",
  payType: "daily",
  postalCode: "",
  startDate: "",
  subject: "",
  requiredSkills: [],
  title: "",
};

export function PostJobPage({
  ctx,
  go,
  toast,
  role,
  state,
}: Pick<RouteProps, "ctx" | "go" | "role" | "toast" | "state">) {
  const isEditing = Boolean(ctx.jobId);
  const myJobsQuery = useMyJobs();
  const profileQuery = useSettingsProfile();
  const profile = role === "institution" ? profileQuery.data?.institution : profileQuery.data?.recruiter;
  const editingJob = ctx.jobId ? myJobsQuery.data?.find((job) => job.id === ctx.jobId) : undefined;

  if (!isEditing && !state.isFullyVerified) {
    return (
      <div className="app-page">
        <PageHead title="Post a job" subtitle="Full verification is required before creating a role." />
        <div className="card card-pad-lg">
          <p>Verify your email and phone, activate your profile, and have all documents approved to start hiring.</p>
          <Btn className="mt-4" onClick={() => go("settings")}>
            Complete verification
          </Btn>
        </div>
      </div>
    );
  }
  if (!isEditing && profileQuery.isLoading) return <div className="app-page">Loading your profile details...</div>;
  if (myJobsQuery.isError)
    return (
      <div className="app-page">
        <p role="alert">Your jobs could not be loaded.</p>
        <Btn onClick={() => void myJobsQuery.refetch()}>Try again</Btn>
      </div>
    );
  if (isEditing && myJobsQuery.isLoading) {
    return (
      <div className="app-page">
        <PageHead title="Loading job" subtitle="Preparing the role editor." />
        <div className="card card-pad-lg max-w-[1040px] text-sm text-muted">Loading your job draft...</div>
      </div>
    );
  }

  if (ctx.jobId && !myJobsQuery.isLoading && !editingJob) {
    return (
      <div className="app-page">
        <PageHead title="Job not found" subtitle="This job may have been deleted or belongs to another account." />
        <div className="card card-pad-lg max-w-[1040px]">
          <p className="text-sm leading-6 text-muted">You can edit roles posted by your own account.</p>
          <Btn className="mt-5" icon="arrowLeft" onClick={() => go("dashboard")} variant="secondary">
            Back to dashboard
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <PostJobEditor
      key={editingJob?.id ?? "new-job"}
      verified={state.isFullyVerified === true}
      editingJob={editingJob}
      go={go}
      initialMode={editingJob?.mode ?? "instant"}
      initialValues={
        editingJob
          ? toFormState(editingJob)
          : {
              ...initialForm,
              address: profile?.address ?? "",
              city: profile?.city ?? "",
              county: profile?.county ?? "",
              postalCode: profile?.postalCode ?? "",
              countryCode: profile?.countryCode || "GB",
            }
      }
      role={role}
      toast={toast}
    />
  );
}

function PostJobEditor({
  initialMode,
  verified,
  editingJob,
  go,
  initialValues,
  role,
  toast,
}: Pick<RouteProps, "go" | "role" | "toast"> & {
  initialMode: PostingMode;
  verified: boolean;
  editingJob?: Job;
  initialValues: JobFormState;
}) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<PostingMode>(initialMode);
  const [form, setForm] = useState<JobFormState>(initialValues);
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [locating, setLocating] = useState(!editingJob && !initialValues.latitude && !initialValues.longitude);
  const [locationMessage, setLocationMessage] = useState("");
  const [savingIntent, setSavingIntent] = useState<"draft" | "publish" | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = Boolean(editingJob);
  const documentRequirementsQuery = useApplicationDocumentRequirements(role === "institution" && !isEditing);
  const documentRequirements = documentRequirementsQuery.data ?? [];
  const documentRequirementOptions = documentRequirements.map((requirement) => ({
    description: requirement.description,
    label: requirement.name,
    value: requirement.id,
  }));

  const createJob = useCreateJob({
    onSuccess: async (result) => {
      if (!result.ok) {
        setSavingIntent(null);
        toast({
          title: "Could not save job",
          msg: result.message ?? "Please check the details and try again.",
          tone: "danger",
        });
        return;
      }

      const published = result.data.status === "ACTIVE";
      toast({
        title: published ? "Job published" : "Draft saved",
        msg:
          result.message ??
          (published
            ? "The role is active and ready for applications."
            : "You can finish and publish this role later."),
        tone: "success",
      });
      setSavingIntent(null);
      go(published ? "applications" : "post-job", { jobId: result.data.id });
    },
    onError: () => {
      setSavingIntent(null);
      toast({ title: "Could not save job", msg: "Please check the details and try again.", tone: "danger" });
    },
  });
  const updateJob = useUpdateJob({
    onSuccess: async (result) => {
      if (!result.ok) {
        setSavingIntent(null);
        toast({
          title: "Could not update job",
          msg: result.message ?? "Please check the details and try again.",
          tone: "danger",
        });
        return;
      }

      const published = result.data?.status === "ACTIVE";
      toast({
        title: "Job updated",
        msg: result.message ?? "The role details are updated.",
        tone: "success",
      });
      setSavingIntent(null);
      go(published ? "applications" : "dashboard", published && result.data ? { jobId: result.data.id } : undefined);
    },
    onError: () => {
      setSavingIntent(null);
      toast({ title: "Could not update job", msg: "Please check the details and try again.", tone: "danger" });
    },
  });

  const saving = createJob.isPending || updateJob.isPending || locating;

  useEffect(() => {
    if (!locating) return;
    let cancelled = false;
    const location = new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Location is unavailable"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
    });
    location
      .then(({ coords }) => {
        if (cancelled) return;
        setForm((current) => ({
          ...current,
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
        }));
        setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
        setLocationMessage("Current location filled automatically. Check that this is the job site.");
        setLocating(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLocationMessage(
          "Location access is unavailable or was denied. Enter the coordinates or use the job postcode.",
        );
        setLocating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locating]);

  function updateForm<Key extends keyof JobFormState>(key: Key, value: JobFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function nextStep() {
    const nextErrors = validateStep(step, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep((current) => Math.min(4, current + 1));
  }

  function saveDraft() {
    const draftErrors = validateDraft(form);
    setErrors(draftErrors);
    if (Object.keys(draftErrors).length > 0) {
      if (!isEditing) setStep(firstInvalidStep(draftErrors));
      return;
    }

    saveJob("DRAFT");
  }

  function publish() {
    const nextErrors = validateAll(form);
    const expiry =
      editingJob && form.expiresAt === toDateInput(editingJob.expiresAt)
        ? editingJob.expiresAt
        : form.expiresAt
          ? `${form.expiresAt}T23:59:59.999Z`
          : undefined;
    if (hasJobExpired({ expiresAt: expiry }))
      nextErrors.expiresAt = "Choose a later expiry date before publishing this role.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (!isEditing) setStep(firstInvalidStep(nextErrors));
      return;
    }

    saveJob("ACTIVE");
  }

  function saveJob(status: Extract<JobCreateInput["status"], "ACTIVE" | "DRAFT">) {
    const payload = toJobCreateInput(form, mode, status);
    setSavingIntent(status === "ACTIVE" ? "publish" : "draft");

    if (editingJob) {
      const { documentRequirementIds: _createOnlyDocumentRequirements, ...updatePayload } = payload;
      updateJob.mutate({
        ...updatePayload,
        status: editingJob.status === "SUSPENDED" ? undefined : updatePayload.status,
        startDate: form.startDate === toDateInput(editingJob.startDate) ? undefined : updatePayload.startDate,
        endDate: form.endDate === toDateInput(editingJob.endDate) ? undefined : updatePayload.endDate,
        expiresAt: form.expiresAt === toDateInput(editingJob.expiresAt) ? undefined : updatePayload.expiresAt,
        latitude:
          form.latitude === (editingJob.latitude != null ? String(editingJob.latitude) : "") &&
          form.longitude === (editingJob.longitude != null ? String(editingJob.longitude) : "")
            ? undefined
            : updatePayload.latitude,
        longitude:
          form.latitude === (editingJob.latitude != null ? String(editingJob.latitude) : "") &&
          form.longitude === (editingJob.longitude != null ? String(editingJob.longitude) : "")
            ? undefined
            : updatePayload.longitude,
        id: editingJob.id,
      } satisfies JobUpdateInput);
      return;
    }

    createJob.mutate(payload);
  }

  function formatDescription(format: "bold" | "bullet" | "heading") {
    const textarea = descriptionRef.current;
    const value = form.description;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const replacement = buildFormattedDescription(format, selected, start > 0 && !value.endsWith("\n"));
    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

    updateForm("description", nextValue);
    window.requestAnimationFrame(() => {
      descriptionRef.current?.focus();
      const cursor = start + replacement.length;
      descriptionRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function renderPostingTypeSection() {
    return (
      <div>
        <div className="eyebrow mb-2.5">{isEditing ? "Posting type" : "Step 1 - Posting type"}</div>
        <h2 className="mb-5 font-serif text-[26px]">How do you want to staff this role?</h2>
        <div className="grid-2">
          {[
            {
              value: "instant" as const,
              title: "Instant matching",
              desc: "Best for urgent or same-day cover.",
              color: "var(--se)",
              bg: "var(--se-tint)",
            },
            {
              value: "brief" as const,
              title: "Open brief",
              desc: "Best for planned, long-term, or proposal-led cover.",
              color: "var(--purple)",
              bg: "var(--purple-tint)",
            },
          ].map((option) => (
            <button
              key={option.value}
              className="cursor-pointer rounded-xl border p-5 text-left transition"
              onClick={() => setMode(option.value)}
              style={{
                background: mode === option.value ? option.bg : "#fff",
                borderColor: mode === option.value ? option.color : "var(--border)",
                borderWidth: 1.5,
              }}
              type="button"
            >
              <div className="mb-2 font-serif text-xl">{option.title}</div>
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
          <Field error={errors.subject} label="Subject">
            <SelectDropdown
              options={subjectOptions}
              placeholder="Select a subject"
              value={form.subject}
              onChange={(value) => updateForm("subject", value)}
            />
          </Field>
          <div className="md:col-span-2 rounded-xl border border-border bg-chalk/40 p-4">
            <div className="mb-3 text-sm font-semibold">Role location</div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field error={errors.postalCode} label="Postcode" hint="Use a valid UK postcode, for example M5 4WT.">
                <input
                  className="input"
                  maxLength={20}
                  placeholder="M5 4WT"
                  value={form.postalCode}
                  onChange={(event) => updateForm("postalCode", event.target.value.toUpperCase())}
                />
              </Field>
              <Field error={errors.address} label="Address">
                <input
                  className="input"
                  maxLength={250}
                  placeholder="School or street address"
                  value={form.address}
                  onChange={(event) => updateForm("address", event.target.value)}
                />
              </Field>
              <Field error={errors.city} label="City">
                <input
                  className="input"
                  maxLength={100}
                  placeholder="Salford"
                  value={form.city}
                  onChange={(event) => updateForm("city", event.target.value)}
                />
              </Field>
              <Field error={errors.county} label="County">
                <input
                  className="input"
                  maxLength={100}
                  placeholder="Greater Manchester"
                  value={form.county}
                  onChange={(event) => updateForm("county", event.target.value)}
                />
              </Field>
              <Field error={errors.countryCode} hint="Two-letter ISO country code." label="Country code">
                <input
                  className="input"
                  maxLength={2}
                  value={form.countryCode}
                  onChange={(event) => updateForm("countryCode", event.target.value.toUpperCase())}
                />
              </Field>
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-border bg-chalk/40 p-4">
            <div className="mb-2 text-sm font-semibold">Location for travel matching</div>
            <p className="mb-3 text-xs text-muted">
              Your current location is filled automatically with browser permission. Check that it is the job
              site, or enter coordinates below. Leave them blank to use the job postcode.
            </p>
            {locating ? (
              <p className="mb-3 text-xs text-muted" role="status">
                Getting your current location. Allow location access if your browser asks.
              </p>
            ) : null}
            {locationMessage ? (
              <p className="mb-3 text-xs text-muted" role="status">
                {locationMessage}
              </p>
            ) : null}
            <div className="grid-2">
              <Field error={errors.latitude} label="Latitude" htmlFor="job-latitude">
                <input
                  id="job-latitude"
                  disabled={locating}
                  className="input"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  placeholder="51.5014"
                  value={form.latitude}
                  onChange={(event) => updateForm("latitude", event.target.value)}
                />
              </Field>
              <Field error={errors.longitude} label="Longitude" htmlFor="job-longitude">
                <input
                  id="job-longitude"
                  disabled={locating}
                  className="input"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  placeholder="-0.1419"
                  value={form.longitude}
                  onChange={(event) => updateForm("longitude", event.target.value)}
                />
              </Field>
            </div>
          </div>
          <Field error={errors.startDate} label="Start date">
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(event) => updateForm("startDate", event.target.value)}
            />
          </Field>
          <Field error={errors.endDate} label="End date">
            <input
              className="input"
              min={form.startDate || undefined}
              type="date"
              value={form.endDate}
              onChange={(event) => updateForm("endDate", event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-[minmax(0,1fr)_220px]">
            <Field
              error={errors.payAmount}
              label="Pay amount (GBP)"
              hint="All job rates on SupplyED are displayed in GBP."
            >
              <input
                className="input"
                min={0}
                placeholder="180"
                type="number"
                value={form.payAmount}
                onChange={(event) => updateForm("payAmount", event.target.value)}
              />
            </Field>
            <Field label="Pay basis">
              <SelectDropdown
                options={payTypeOptions}
                value={formatPayTypeLabel(form.payType)}
                onChange={(value) => updateForm("payType", readPayTypeLabel(value))}
              />
            </Field>
          </div>
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
            <Field
              error={errors.requiredSkills}
              htmlFor="job-required-skills"
              hint="Optional. Press Enter or comma after each skill."
              label="Required skills"
            >
              <TagInput
                id="job-required-skills"
                value={form.requiredSkills}
                onChange={(value) => updateForm("requiredSkills", value)}
              />
            </Field>
          </div>
        </div>
        <Field error={errors.description} label="Role description" required>
          <div className="mb-2 flex flex-wrap gap-2">
            <Btn size="sm" variant="secondary" onClick={() => formatDescription("heading")}>
              Heading
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => formatDescription("bullet")}>
              Bullet list
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => formatDescription("bold")}>
              Bold
            </Btn>
          </div>
          <textarea
            ref={descriptionRef}
            className="textarea"
            placeholder="Describe the class, cover expectations, timetable notes, support needs, and arrival instructions."
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
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
            <MultiSelectDropdown
              id="job-key-stages"
              options={keyStageOptions}
              placeholder="Select key stages"
              value={form.keyStages}
              onChange={(value) => updateForm("keyStages", value)}
            />
          </Field>
          <Field
            error={errors.expiresAt}
            hint="Optional. If set, the job stops appearing publicly after this date."
            label="Listing expiry"
          >
            <input
              className="input"
              type="date"
              value={form.expiresAt}
              onChange={(event) => updateForm("expiresAt", event.target.value)}
            />
          </Field>
          {!isEditing && role === "institution" ? (
            <div className="md:col-span-2">
              <Field
                htmlFor="job-document-requirements"
                hint="Optional. Select the documents applicants should provide."
                label="Application document requirements"
              >
                <MultiSelectDropdown
                  id="job-document-requirements"
                  disabled={
                    documentRequirementsQuery.isLoading ||
                    documentRequirementsQuery.isError ||
                    documentRequirementOptions.length === 0
                  }
                  error={documentRequirementsQuery.isError}
                  options={documentRequirementOptions}
                  placeholder={
                    documentRequirementsQuery.isLoading
                      ? "Loading document requirements..."
                      : documentRequirementsQuery.isError
                        ? "Document requirements unavailable"
                        : documentRequirementOptions.length === 0
                          ? "No document requirements available"
                          : "Select document requirements"
                  }
                  value={form.documentRequirementIds}
                  onChange={(value) => updateForm("documentRequirementIds", value)}
                />
                {documentRequirementsQuery.isError ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-danger" role="alert">
                    <span>Could not load document requirements.</span>
                    <button
                      className="cursor-pointer font-semibold underline underline-offset-2"
                      onClick={() => void documentRequirementsQuery.refetch()}
                      type="button"
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
              </Field>
            </div>
          ) : null}
        </div>
        {role === "individual" && !isEditing ? (
          <p className="mb-4 text-sm text-muted">
            Document selection is not currently available for hirer accounts. You can still post a role without
            selecting application documents.
          </p>
        ) : null}
        {isEditing ? (
          <p className="mb-4 text-sm text-muted">
            Application document requirements can only be changed by an administrator after creation. Existing dates are
            kept if left blank.
          </p>
        ) : null}
        <Field error={errors.parkingInfo} label="Parking / arrival notes">
          <textarea
            className="textarea"
            maxLength={1000}
            placeholder="e.g. Parking available on-site. Please sign in at reception."
            value={form.parkingInfo}
            onChange={(event) => updateForm("parkingInfo", event.target.value)}
          />
        </Field>
        <Field label="Posting options">
          <div className="flex flex-col gap-2">
            <Checkbox
              checked={form.qtsRequired}
              label="QTS qualified"
              onChange={(value) => updateForm("qtsRequired", value)}
            />
            <Checkbox checked={form.urgent} label="Mark as urgent" onChange={(value) => updateForm("urgent", value)} />
          </div>
        </Field>
      </div>
    );
  }

  function renderReviewSummary(eyebrow = "Step 4 - Review") {
    const previewDescription = readEditableDescription(form.description);

    return (
      <div>
        <div className="eyebrow mb-2.5">{eyebrow}</div>
        <div className="card card-pad bg-chalk">
          <div className="mb-2.5 flex flex-wrap gap-2">
            <Tag tone={mode === "instant" ? "" : "purple"}>
              {mode === "instant" ? "Instant matching" : "Open brief"}
            </Tag>
            <Tag tone="green">{isEditing ? "Current preview" : "Ready to publish"}</Tag>
            {form.urgent ? <Tag tone="red">Urgent</Tag> : null}
            {form.qtsRequired ? <Tag tone="ghost">QTS requested</Tag> : null}
          </div>
          <div className="font-serif text-[22px]">{form.title || "Untitled teaching role"}</div>
          <FormattedJobDescription className="mt-2 max-w-[760px]" description={previewDescription} />
          <div className="mt-3 flex flex-wrap gap-2">
            {form.keyStages.map((stage) => (
              <span key={stage} className="pill">
                {stage}
              </span>
            ))}
            {form.subject ? <span className="pill">{form.subject}</span> : null}
            <span className="pill">{formatFormLocation(form)}</span>
            {form.latitude && form.longitude ? (
              <span className="pill">
                Coordinates: {form.latitude}, {form.longitude}
              </span>
            ) : null}
            {form.expiresAt ? <span className="pill">Apply by {form.expiresAt}</span> : null}
            {form.parkingInfo ? <span className="pill">{form.parkingInfo}</span> : null}
            <span className="pill">{formatPay(form)}</span>
            <span className="pill">{formatDateRange(form.startDate, form.endDate)}</span>
            {form.minExperienceYears ? <span className="pill">{form.minExperienceYears}+ years experience</span> : null}
            {form.requiredSkills.map((skill) => (
              <span key={skill} className="pill">
                {skill}
              </span>
            ))}
            {documentRequirements
              .filter((requirement) => form.documentRequirementIds.includes(requirement.id))
              .map((requirement) => (
                <span key={requirement.id} className="pill">
                  {requirement.name}
                </span>
              ))}
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="app-page">
        <PageHead
          title="Edit job post"
          subtitle="Update the complete role in one place, save it as a draft, or publish the latest version."
        />

        <div className="card card-pad-lg max-w-[1280px]">
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

            <aside className="xl:sticky xl:top-[92px] xl:self-start">{renderReviewSummary("Live preview")}</aside>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <Btn variant="ghost" onClick={() => go("dashboard")}>
              Cancel
            </Btn>
            <div className="flex flex-wrap justify-end gap-2">
              <Btn
                disabled={saving}
                loading={savingIntent === "draft"}
                loadingLabel="Saving draft"
                onClick={saveDraft}
                size="lg"
                variant="secondary"
              >
                {editingJob?.status === "SUSPENDED" ? "Save changes" : "Save draft"}
              </Btn>
              <Btn
                disabled={saving || !verified || editingJob?.status === "SUSPENDED"}
                iconRight="send"
                loading={savingIntent === "publish"}
                loadingLabel="Updating"
                onClick={publish}
                title={!verified ? "Full verification is required to publish" : undefined}
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
    <div className="app-page">
      <PageHead
        title={isEditing ? "Edit job post" : role === "individual" ? "Post a hiring role" : "Post a new role"}
        subtitle={
          isEditing
            ? "Update the role, keep it as draft, or publish the latest version."
            : "Create the role once, publish it to active listings, then review applications from the same workspace."
        }
      />
      <div className="mb-7 flex flex-wrap gap-2.5">
        {["Type", "Details", "Requirements", "Review"].map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`step ${index + 1 < step ? "done" : index + 1 === step ? "active" : ""}`}>{index + 1}</div>
            <span className={index + 1 === step ? "font-semibold" : "text-muted"}>{label}</span>
            {index < 3 ? <div className={`step-bar ${index + 1 < step ? "done" : ""}`} /> : null}
          </div>
        ))}
      </div>

      <div className="card card-pad-lg max-w-[1040px]">
        {step === 1 ? renderPostingTypeSection() : null}
        {step === 2 ? renderDetailsFields() : null}
        {step === 3 ? renderRequirementsFields() : null}
        {step === 4 ? renderReviewSummary() : null}

        <div className="mt-8 flex items-center justify-between">
          <Btn variant="ghost" onClick={() => (step > 1 ? setStep(step - 1) : go("dashboard"))}>
            {step > 1 ? "Back" : "Cancel"}
          </Btn>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              disabled={saving}
              loading={savingIntent === "draft"}
              loadingLabel="Saving draft"
              onClick={saveDraft}
              size="lg"
              variant="secondary"
            >
              Save draft
            </Btn>
            <Btn
              disabled={saving}
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
    return pickErrors(validateAll(form), [
      "address",
      "latitude",
      "longitude",
      "city",
      "countryCode",
      "county",
      "description",
      "endDate",
      "minExperienceYears",
      "requiredSkills",
      "payAmount",
      "postalCode",
      "startDate",
      "subject",
      "title",
    ]);
  }
  if (step === 3) return pickErrors(validateAll(form), ["expiresAt", "parkingInfo"]);
  return {};
}

function validateAll(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};

  if (!form.title.trim()) errors.title = "Enter a job title.";
  Object.assign(errors, validateJobDates(form));
  Object.assign(errors, validateOptionalJobFields(form));
  if (!form.description.trim()) errors.description = "Add a role description.";

  return errors;
}

function validateDraft(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};

  if (!form.title.trim()) errors.title = "Enter a job title before saving a draft.";
  if (!form.description.trim()) errors.description = "Add a short role description before saving a draft.";
  Object.assign(errors, validateJobDates(form));
  Object.assign(errors, validateOptionalJobFields(form));

  return errors;
}

function validateOptionalJobFields(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};
  if (form.countryCode.toUpperCase() === "GB" && form.postalCode.trim() && !isValidUkPostcode(form.postalCode))
    errors.postalCode = "Enter a valid UK postcode.";
  if (form.countryCode.trim() && !/^[A-Z]{2}$/i.test(form.countryCode.trim()))
    errors.countryCode = "Use a two-letter country code.";

  const hasLatitude = Boolean(form.latitude.trim());
  const hasLongitude = Boolean(form.longitude.trim());
  if (hasLatitude !== hasLongitude) {
    if (!hasLatitude) errors.latitude = "Enter latitude and longitude together.";
    if (!hasLongitude) errors.longitude = "Enter latitude and longitude together.";
  }
  if (hasLatitude && (!Number.isFinite(Number(form.latitude)) || Math.abs(Number(form.latitude)) > 90))
    errors.latitude = "Latitude must be between -90 and 90.";
  if (hasLongitude && (!Number.isFinite(Number(form.longitude)) || Math.abs(Number(form.longitude)) > 180))
    errors.longitude = "Longitude must be between -180 and 180.";
  if (form.parkingInfo.length > 1000) errors.parkingInfo = "Use 1,000 characters or fewer.";
  if (form.requiredSkills.length > 50 || form.requiredSkills.some((skill) => skill.trim().length > 100))
    errors.requiredSkills = "Use up to 50 skills, each 100 characters or fewer.";
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

function isValidUkPostcode(value: string) {
  return /^(GIR\s?0AA|(?:(?:[A-PR-UWYZ][0-9][0-9A-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?|[A-PR-UWYZ][0-9][A-HJKSTUW]|[A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRV-Y])\s?[0-9][ABD-HJLNP-UW-Z]{2}))$/i.test(
    value.trim(),
  );
}

function validateJobDates(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};

  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = "End date cannot be before the start date.";
  }
  return errors;
}

function pickErrors(errors: JobFormErrors, keys: Array<keyof JobFormState>) {
  return keys.reduce<JobFormErrors>((selected, key) => {
    if (errors[key]) selected[key] = errors[key];
    return selected;
  }, {});
}

function firstInvalidStep(errors: JobFormErrors) {
  if (
    errors.latitude ||
    errors.longitude ||
    errors.title ||
    errors.address ||
    errors.city ||
    errors.countryCode ||
    errors.county ||
    errors.subject ||
    errors.startDate ||
    errors.endDate ||
    errors.payAmount ||
    errors.minExperienceYears ||
    errors.postalCode ||
    errors.description ||
    errors.requiredSkills
  )
    return 2;
  if (errors.expiresAt || errors.parkingInfo) return 3;
  return 4;
}

function toJobCreateInput(
  form: JobFormState,
  mode: PostingMode,
  status: Extract<JobCreateInput["status"], "ACTIVE" | "DRAFT">,
): JobCreateInput {
  return {
    address: form.address || undefined,
    city: form.city || undefined,
    countryCode: form.countryCode || undefined,
    county: form.county || undefined,
    description: buildDescription(form, mode),
    latitude: form.latitude.trim() ? Number(form.latitude) : undefined,
    longitude: form.longitude.trim() ? Number(form.longitude) : undefined,
    documentRequirementIds: form.documentRequirementIds,
    endDate: toIsoDate(form.endDate),
    expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59.999Z`).toISOString() : undefined,
    keyStages: form.keyStages,
    minExperienceYears: form.minExperienceYears ? Number(form.minExperienceYears) : undefined,
    parkingInfo: form.parkingInfo,
    payAmount: form.payAmount ? Number(form.payAmount) : undefined,
    payType: form.payType,
    postalCode: form.postalCode || undefined,
    requiredSkills: form.requiredSkills,
    startDate: toIsoDate(form.startDate),
    status,
    subject: form.subject,
    title: form.title,
  };
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

function buildFormattedDescription(
  format: "bold" | "bullet" | "heading",
  selected: string,
  needsLeadingBreak: boolean,
) {
  const prefix = needsLeadingBreak ? "\n\n" : "";
  const text = selected.trim();

  if (format === "heading") return `${prefix}## ${text || "Section heading"}\n`;
  if (format === "bullet") {
    if (!text) return `${prefix}- `;
    return `${prefix}${text
      .split("\n")
      .map((line) => (line.trim() ? `- ${line.replace(/^-\s*/, "").trim()}` : ""))
      .join("\n")}`;
  }

  return text ? `**${text}**` : "**important detail**";
}

function toIsoDate(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T09:00:00.000Z`).toISOString();
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

function toFormState(job: Job): JobFormState {
  return {
    address: job.address ?? "",
    city: job.city === "Location TBC" ? "" : job.city,
    countryCode: job.countryCode ?? "GB",
    county: job.county ?? "",
    description: readEditableDescription(job.description ?? ""),
    latitude: job.latitude != null ? String(job.latitude) : "",
    longitude: job.longitude != null ? String(job.longitude) : "",
    qtsRequired: job.description?.includes("QTS requested.") ?? false,
    urgent: job.description?.includes("Marked urgent by the hiring account.") || job.urgent,
    documentRequirementIds: [],
    endDate: toDateInput(job.endDate),
    expiresAt: toDateInput(job.expiresAt),
    keyStages: job.keyStages?.length ? job.keyStages : [],
    minExperienceYears: job.minExperienceYears != null ? String(job.minExperienceYears) : "",
    parkingInfo: job.parkingInfo ?? "",
    payAmount: job.payAmount != null ? String(job.payAmount) : "",
    payType: isPayType(job.payType) ? job.payType : "daily",
    postalCode: job.postalCode ?? "",
    startDate: toDateInput(job.startDate),
    subject: job.subject === "General cover" ? "" : job.subject,
    requiredSkills: job.requiredSkills,
    title: job.title,
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
  return /^(Posting route:\s*(Instant matching|Open brief)\.|Marked urgent by the hiring account\.|QTS requested\.)$/i.test(
    line.trim(),
  );
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
  if (!form.payAmount.trim() || !Number.isFinite(amount) || amount < 0) return "Rate TBC";
  if (form.payType === "hourly") return `£${amount}/hr`;
  if (form.payType === "fixed") return `£${amount} fixed`;
  return `£${amount}/day`;
}

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate) return "Date TBC";
  if (!endDate || startDate === endDate) return startDate;
  return `${startDate} - ${endDate}`;
}

function formatFormLocation(form: JobFormState) {
  return (
    [form.city, form.county, form.postalCode]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ") || "Location TBC"
  );
}
