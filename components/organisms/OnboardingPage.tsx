import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import type { AppRole } from "@/types/supplyed";

import { Btn, Checkbox, Field, Icon, Logo, Tag } from "../atoms";
import { MultiSelectDropdown, SelectDropdown } from "../molecules/OptionDropdowns";
import {
  budgetRanges,
  countryCodes,
  coverTypes,
  currencies,
  keyStages,
  learningModes,
  preferredSchedules,
  subjects,
  supportForOptions,
  teacherSkills,
} from "./onboarding/constants";
import { ReviewCard } from "./onboarding/ReviewCard";
import type {
  OnboardingDocumentDownloadActionResult,
  OnboardingDocumentUploadActionResult,
  OnboardingFinishResult,
  SignupRole,
} from "./onboarding/types";
import { UploadCard } from "./onboarding/UploadCard";
import { useOnboardingForm } from "./onboarding/useOnboardingForm";
import {
  areaClass,
  fieldClass,
  roleLabel,
  signupHeroCopy,
  signupHeroTitle,
  signupStepTitle,
  signupSubmitLabel,
} from "./onboarding/utils";

export function OnboardingPage({
  accountEmail,
  headerActionLabel = "Log in",
  headerPrompt = "Already registered?",
  roleSelected,
  step,
  setStep,
  role,
  setRole,
  initialSnapshot,
  onFinish,
  onDocumentView,
  onDocumentUpload,
  onStepSave,
  onLanding,
  onLogin,
}: {
  accountEmail?: string;
  headerActionLabel?: string;
  headerPrompt?: string;
  initialSnapshot?: OnboardingProfileSnapshot;
  roleSelected: boolean;
  step: number;
  setStep: (step: number) => void;
  role: AppRole;
  setRole: (role: SignupRole) => void;
  onFinish: (payload: FormData) => Promise<OnboardingFinishResult>;
  onDocumentView: (payload: FormData) => Promise<OnboardingDocumentDownloadActionResult>;
  onDocumentUpload: (payload: FormData) => Promise<OnboardingDocumentUploadActionResult>;
  onStepSave: (payload: FormData) => Promise<OnboardingFinishResult>;
  onLanding: () => void;
  onLogin: () => void;
}) {
  const {
    activeRole,
    clearFieldError,
    continueStep,
    currentStep,
    errors,
    form,
    isLastStep,
    pending,
    progress,
    reviewGroups,
    steps,
    submitError,
    submitSignup,
    uploadDocument,
    uploadPending,
    updateField,
    viewDocument,
    viewPending,
  } = useOnboardingForm({
    accountEmail,
    initialSnapshot,
    onFinish,
    onDocumentView,
    onDocumentUpload,
    onStepSave,
    role,
    roleSelected,
    setStep,
    step,
  });

  return (
    <div className="min-h-screen overflow-x-hidden bg-chalk">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-4 sm:px-6 lg:px-8">
        <Logo size={21} onClick={onLanding} />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">{headerPrompt}</span>
          <Btn variant="secondary" size="sm" onClick={onLogin}>{headerActionLabel}</Btn>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-[1240px] grid-cols-1 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[380px_1fr] lg:items-stretch lg:px-8">
        <aside className="relative overflow-hidden rounded-t-xl bg-[#0a0a0a] p-6 text-white shadow-panel sm:p-8 lg:rounded-l-xl lg:rounded-r-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.08)_1px,transparent_1px)] bg-[length:48px_48px]" />
          <div className="relative flex h-full flex-col">
            <div>
              <div className="eyebrow mb-5 text-brand">Join SupplyED</div>
              <h1 className="font-serif text-3xl leading-[1.08] sm:text-[40px]">
                {roleSelected ? signupHeroTitle(activeRole) : "Choose your SupplyED path."}
              </h1>
              <p className="mt-5 text-sm leading-7 text-white/65 sm:text-[15px]">
                {roleSelected
                  ? signupHeroCopy(activeRole)
                  : "Your email is verified. Now choose whether you are hiring talent, joining as a teacher, or setting up a school workspace."}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {steps.map((item, index) => {
                const itemStep = index + 1;
                const active = itemStep === currentStep;
                const complete = itemStep < currentStep;

                return (
                  <button
                    key={item.label}
                    className="flex w-full gap-3 text-left"
                    onClick={() => {
                      if (itemStep < currentStep) setStep(itemStep);
                    }}
                    type="button"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                      style={{
                        background: complete ? "var(--se)" : active ? "#fff" : "transparent",
                        borderColor: complete || active ? "var(--se)" : "rgba(255,255,255,0.25)",
                        color: complete ? "#fff" : active ? "var(--ink)" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {complete ? <Icon name="check" size={14} /> : itemStep}
                    </span>
                    <span>
                      <span className={active ? "block font-semibold text-white" : "block font-medium text-white/70"}>{item.label}</span>
                      <span className="block text-xs text-white/45">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto hidden rounded-lg border border-white/10 bg-white/5 p-4 lg:block">
              <div className="text-xs uppercase tracking-[1px] text-white/45">Current path</div>
              <div className="mt-1 font-serif text-2xl">{roleSelected ? roleLabel(activeRole) : "Role selection"}</div>
              <p className="mt-1 text-sm text-white/55">You can change this in the account step before submitting.</p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col rounded-b-xl border border-t-0 border-border bg-white p-5 shadow-(--shadow-xs) sm:p-8 lg:rounded-l-none lg:rounded-r-xl lg:border-l-0 lg:border-t">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <Tag>Step {currentStep} of {steps.length}</Tag>
              <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-[36px]">
                {roleSelected ? signupStepTitle(activeRole, currentStep) : "Choose account type"}
              </h2>
              <p className="mt-2 max-w-[640px] text-muted">{steps[currentStep - 1].description}</p>
            </div>
            <div className="w-full sm:w-[210px]">
              <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[1px] text-muted">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex-1">
            {currentStep === 1 ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
                      <Icon name="checkCircle" size={19} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-brand-dark">Account verified</div>
                      <div className="truncate text-sm text-brand-dark/75">{form.email || accountEmail || "Verified email"}</div>
                    </div>
                  </div>
                </div>

                <Field label="Choose account type" error={errors.accountRole} required>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {([
                      ["institution", "School / MAT", "building", "Post roles, review ranked matches, and manage compliance."],
                      ["teacher", "Supply teacher", "user", "Build your profile, find roles, and manage availability."],
                      ["individual", "Individual hirer", "heart", "Find verified teachers for yourself, your child, or another learner."],
                    ] as const).map(([value, title, icon, copy]) => {
                      const selected = roleSelected && activeRole === value;

                      return (
                        <button
                          key={value}
                          aria-pressed={selected}
                          className="rounded-xl border p-4 text-left transition hover:border-brand hover:bg-brand-tint sm:p-5"
                          onClick={() => {
                            setRole(value);
                            clearFieldError("accountRole");
                          }}
                          style={{ borderColor: selected ? "var(--se)" : "var(--border)", background: selected ? "var(--se-tint)" : "#fff" }}
                          type="button"
                        >
                          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand">
                            <Icon name={icon} size={20} />
                          </div>
                          <div className="font-serif text-xl">{title}</div>
                          <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="signup-name" error={errors.fullName} required>
                    <input id="signup-name" className={fieldClass(errors.fullName)} value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Your full name" />
                  </Field>
                  <Field label="Phone" htmlFor="signup-phone" error={errors.phone} required>
                    <input id="signup-phone" className={fieldClass(errors.phone)} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+44 7700 900000" inputMode="tel" />
                  </Field>
                  <Field label="Postcode" htmlFor="signup-postcode" error={errors.postcode} required>
                    <input id="signup-postcode" className={fieldClass(errors.postcode)} value={form.postcode} onChange={(event) => updateField("postcode", event.target.value.toUpperCase())} placeholder="M1 1AE" />
                  </Field>
                </div>

                {activeRole === "teacher" ? (
                  <div className="space-y-6 rounded-xl border border-border bg-chalk p-4 sm:p-5">
                    <div>
                      <h3 className="font-serif text-2xl leading-tight">Teaching profile</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        These details are sent to the instructor profile endpoint and used for matching after review.
                      </p>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                      <Field label="Primary subjects" error={errors.subjects} required>
                        <MultiSelectDropdown
                          error={Boolean(errors.subjects)}
                          options={subjects}
                          placeholder="Select primary subjects"
                          value={form.subjects}
                          onChange={(value) => updateField("subjects", value)}
                        />
                      </Field>
                      <Field label="Key stages" error={errors.keyStages} required>
                        <MultiSelectDropdown
                          error={Boolean(errors.keyStages)}
                          options={keyStages}
                          placeholder="Select key stages"
                          value={form.keyStages}
                          onChange={(value) => updateField("keyStages", value)}
                        />
                      </Field>
                    </div>

                    <Field label="Skills" hint="Optional, but useful for matching.">
                      <MultiSelectDropdown
                        options={teacherSkills}
                        placeholder="Select skills"
                        value={form.skills}
                        onChange={(value) => updateField("skills", value)}
                      />
                    </Field>

                    <div className="grid gap-x-4 sm:grid-cols-2 xl:grid-cols-3">
                      <Field label="Years of experience" htmlFor="experience" error={errors.yearsExperience} required>
                        <input id="experience" className={fieldClass(errors.yearsExperience)} value={form.yearsExperience} onChange={(event) => updateField("yearsExperience", event.target.value.replace(/[^\d]/g, ""))} placeholder="5" inputMode="numeric" />
                      </Field>
                      <Field label="Daily rate" htmlFor="daily-rate" error={errors.dailyRate} hint="Optional">
                        <input id="daily-rate" className={fieldClass(errors.dailyRate)} value={form.dailyRate} onChange={(event) => updateField("dailyRate", event.target.value.replace(/[^\d.]/g, ""))} placeholder="180" inputMode="decimal" />
                      </Field>
                      <Field label="Hourly rate" htmlFor="hourly-rate" error={errors.hourlyRate} hint="Optional">
                        <input id="hourly-rate" className={fieldClass(errors.hourlyRate)} value={form.hourlyRate} onChange={(event) => updateField("hourlyRate", event.target.value.replace(/[^\d.]/g, ""))} placeholder="35" inputMode="decimal" />
                      </Field>
                      <Field label="Currency" error={errors.currency}>
                        <SelectDropdown
                          error={Boolean(errors.currency)}
                          options={currencies}
                          placeholder="Select currency"
                          value={form.currency}
                          onChange={(value) => updateField("currency", value)}
                        />
                      </Field>
                      <Field label="Maximum travel distance" htmlFor="travel-distance" error={errors.maxTravelDistance} hint="Miles, optional">
                        <input id="travel-distance" className={fieldClass(errors.maxTravelDistance)} value={form.maxTravelDistance} onChange={(event) => updateField("maxTravelDistance", event.target.value.replace(/[^\d.]/g, ""))} placeholder="25" inputMode="decimal" />
                      </Field>
                      <Field label="Teaching reference number" htmlFor="trn" hint="Optional for now.">
                        <input id="trn" className="input" value={form.teachingReferenceNumber} onChange={(event) => updateField("teachingReferenceNumber", event.target.value)} placeholder="TRN number" />
                      </Field>
                    </div>

                    <Field label="Teaching bio" htmlFor="bio" error={errors.bio} required>
                      <textarea
                        id="bio"
                        className={areaClass(errors.bio)}
                        value={form.bio}
                        onChange={(event) => updateField("bio", event.target.value)}
                        placeholder="Describe your classroom style, specialist subjects, behaviour approach, and availability."
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep === 2 && activeRole === "institution" ? (
              <div className="space-y-6">
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="School or MAT name" htmlFor="school-name" error={errors.schoolName} required>
                    <input id="school-name" className={fieldClass(errors.schoolName)} value={form.schoolName} onChange={(event) => updateField("schoolName", event.target.value)} placeholder="Greenfield Primary School" />
                  </Field>
                  <Field label="Your role" htmlFor="contact-role" error={errors.contactRole} required>
                    <input id="contact-role" className={fieldClass(errors.contactRole)} value={form.contactRole} onChange={(event) => updateField("contactRole", event.target.value)} placeholder="Headteacher, HR lead, cover manager" />
                  </Field>
                  <Field label="School / trust domain" htmlFor="institution-domain" error={errors.institutionDomain} required>
                    <input id="institution-domain" className={fieldClass(errors.institutionDomain)} value={form.institutionDomain} onChange={(event) => updateField("institutionDomain", event.target.value.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase())} placeholder="greenfield.ac.uk" />
                  </Field>
                  <Field label="Registration ID" htmlFor="institution-registration-id" hint="Optional">
                    <input id="institution-registration-id" className="input" value={form.institutionRegistrationId} onChange={(event) => updateField("institutionRegistrationId", event.target.value)} placeholder="URN, company number, or trust ID" />
                  </Field>
                  <Field label="Address" htmlFor="institution-address" error={errors.institutionAddress} required>
                    <input id="institution-address" className={fieldClass(errors.institutionAddress)} value={form.institutionAddress} onChange={(event) => updateField("institutionAddress", event.target.value)} placeholder="1 School Lane" />
                  </Field>
                  <Field label="City" htmlFor="institution-city" error={errors.institutionCity} required>
                    <input id="institution-city" className={fieldClass(errors.institutionCity)} value={form.institutionCity} onChange={(event) => updateField("institutionCity", event.target.value)} placeholder="Manchester" />
                  </Field>
                  <Field label="County / region" htmlFor="authority" error={errors.localAuthority} required>
                    <input id="authority" className={fieldClass(errors.localAuthority)} value={form.localAuthority} onChange={(event) => updateField("localAuthority", event.target.value)} placeholder="Greater Manchester" />
                  </Field>
                  <Field label="Country" error={errors.institutionCountryCode}>
                    <SelectDropdown
                      error={Boolean(errors.institutionCountryCode)}
                      options={countryCodes}
                      placeholder="Select country"
                      value={form.institutionCountryCode}
                      onChange={(value) => updateField("institutionCountryCode", value)}
                    />
                  </Field>
                  <Field label="Typical pupil count" htmlFor="pupils" hint="Optional, helps estimate staffing needs.">
                    <input id="pupils" className="input" value={form.yearsExperience} onChange={(event) => updateField("yearsExperience", event.target.value.replace(/\D/g, ""))} placeholder="420" inputMode="numeric" />
                  </Field>
                </div>
                <Field label="Staffing needs" error={errors.coverTypes} required>
                  <MultiSelectDropdown
                    error={Boolean(errors.coverTypes)}
                    options={coverTypes}
                    placeholder="Select staffing needs"
                    value={form.coverTypes}
                    onChange={(value) => updateField("coverTypes", value)}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === 2 && activeRole === "teacher" ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
                      <Icon name="shield" size={19} />
                    </div>
                    <div>
                      <div className="font-semibold text-brand-dark">Instructor documents</div>
                      <p className="mt-1 text-sm leading-6 text-brand-dark/80">
                        Upload PDF, JPG, or PNG files only. Each file must be 10 MB or smaller.
                      </p>
                    </div>
                  </div>
                </div>

                <Field label="Enhanced DBS certificate number" htmlFor="dbs-number" error={errors.dbsNumber} required>
                  <input id="dbs-number" className={fieldClass(errors.dbsNumber)} value={form.dbsNumber} onChange={(event) => updateField("dbsNumber", event.target.value)} placeholder="Certificate number" />
                </Field>
                <div className="grid gap-4 xl:grid-cols-2">
                  <UploadCard
                    id="dbs-certificate-file"
                    title="DBS Certificate"
                    description="Upload the certificate file that matches the DBS number above."
                    icon="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    file={form.dbsCertificateFile}
                    error={errors.dbsCertificateFile}
                    pending={uploadPending === "dbsCertificateFile"}
                    viewPending={viewPending === "dbsCertificateFile"}
                    actionLabel="Upload certificate"
                    onFile={(file) => uploadDocument("dbsCertificateFile", file)}
                    onView={() => viewDocument("dbsCertificateFile", form.dbsCertificateFile)}
                  />
                  <UploadCard
                    id="identity-photo"
                    title="Photo ID (Passport / Driving Licence)"
                    description="Upload a clear passport, driving licence, or official photo ID."
                    icon="image"
                    accept=".pdf,.png,.jpg,.jpeg"
                    capture="environment"
                    file={form.identityPhoto}
                    error={errors.identityPhoto}
                    pending={uploadPending === "identityPhoto"}
                    viewPending={viewPending === "identityPhoto"}
                    actionLabel="Upload ID"
                    onFile={(file) => uploadDocument("identityPhoto", file)}
                    onView={() => viewDocument("identityPhoto", form.identityPhoto)}
                  />
                  <UploadCard
                    id="qualification-file"
                    title="Teaching Qualifications / QTS"
                    description="Upload a certificate or QTS evidence document."
                    icon="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    file={form.qualificationFile}
                    error={errors.qualificationFile}
                    pending={uploadPending === "qualificationFile"}
                    viewPending={viewPending === "qualificationFile"}
                    actionLabel="Upload qualification"
                    onFile={(file) => uploadDocument("qualificationFile", file)}
                    onView={() => viewDocument("qualificationFile", form.qualificationFile)}
                  />
                  <UploadCard
                    id="right-to-work-file"
                    title="Proof of Address"
                    description="Upload a recent bill, bank statement, or official address evidence."
                    icon="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    file={form.rightToWorkFile}
                    error={errors.rightToWorkFile}
                    pending={uploadPending === "rightToWorkFile"}
                    viewPending={viewPending === "rightToWorkFile"}
                    actionLabel="Upload evidence"
                    onFile={(file) => uploadDocument("rightToWorkFile", file)}
                    onView={() => viewDocument("rightToWorkFile", form.rightToWorkFile)}
                  />
                </div>
              </div>
            ) : null}

            {currentStep === 2 && activeRole === "individual" ? (
              <div className="space-y-6">
                <Field label="Who needs support?" error={errors.individualRelationship} required>
                  <SelectDropdown
                    error={Boolean(errors.individualRelationship)}
                    options={supportForOptions}
                    placeholder="Select who needs support"
                    value={form.individualRelationship}
                    onChange={(value) => updateField("individualRelationship", value)}
                  />
                </Field>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Field label="Subject needed" error={errors.subjects} required>
                    <MultiSelectDropdown
                      error={Boolean(errors.subjects)}
                      options={subjects}
                      placeholder="Select subject needs"
                      value={form.subjects}
                      onChange={(value) => updateField("subjects", value)}
                    />
                  </Field>
                  <Field label="Learner stage" error={errors.keyStages} required>
                    <SelectDropdown
                      error={Boolean(errors.keyStages)}
                      options={keyStages}
                      placeholder="Select learner stage"
                      value={form.keyStages[0] || ""}
                      onChange={(value) => updateField("keyStages", value ? [value] : [])}
                    />
                  </Field>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <Field label="Format" error={errors.learningMode} required>
                    <SelectDropdown
                      error={Boolean(errors.learningMode)}
                      options={learningModes}
                      placeholder="Select format"
                      value={form.learningMode}
                      onChange={(value) => updateField("learningMode", value)}
                    />
                  </Field>
                  <Field label="Preferred schedule" error={errors.preferredSchedule} required>
                    <SelectDropdown
                      error={Boolean(errors.preferredSchedule)}
                      options={preferredSchedules}
                      placeholder="Select schedule"
                      value={form.preferredSchedule}
                      onChange={(value) => updateField("preferredSchedule", value)}
                    />
                  </Field>
                  <Field label="Budget range" error={errors.budgetRange} required>
                    <SelectDropdown
                      error={Boolean(errors.budgetRange)}
                      options={budgetRanges}
                      placeholder="Select budget range"
                      value={form.budgetRange}
                      onChange={(value) => updateField("budgetRange", value)}
                    />
                  </Field>
                </div>

                <Field label="Learner notes" htmlFor="learner-notes" hint="Optional. Avoid sharing full child identity at signup.">
                  <textarea
                    id="learner-notes"
                    className="textarea min-h-[116px]"
                    value={form.learnerNotes}
                    onChange={(event) => updateField("learnerNotes", event.target.value)}
                    placeholder="Example: Year 5 learner needs confidence with fractions. Prefer calm, structured sessions after school."
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === 3 && activeRole === "institution" ? (
              <div className="space-y-6">
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Compliance lead" htmlFor="compliance-contact" error={errors.complianceContact} required>
                    <input id="compliance-contact" className={fieldClass(errors.complianceContact)} value={form.complianceContact} onChange={(event) => updateField("complianceContact", event.target.value)} placeholder="Name of safeguarding lead" />
                  </Field>
                  <Field label="Compliance email" htmlFor="compliance-email" error={errors.complianceEmail} required>
                    <input id="compliance-email" className={fieldClass(errors.complianceEmail)} value={form.complianceEmail} onChange={(event) => updateField("complianceEmail", event.target.value)} placeholder="safeguarding@school.org.uk" type="email" />
                  </Field>
                </div>
                <div className="rounded-xl border border-border bg-chalk p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
                      <Icon name="shield" size={19} />
                    </div>
                    <div>
                      <div className="font-semibold">Safeguarding responsibility</div>
                      <p className="mt-1 text-sm leading-6 text-muted">SupplyED can verify teacher documents, but schools remain responsible for local safeguarding and booking approvals.</p>
                    </div>
                  </div>
                  <Field error={errors.safeguardingConfirmed}>
                    <Checkbox checked={form.safeguardingConfirmed} onChange={(value) => updateField("safeguardingConfirmed", value)} label="I confirm this workspace will be managed by authorised school staff." />
                  </Field>
                </div>
              </div>
            ) : null}

            {currentStep === 3 && activeRole === "individual" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-chalk p-5">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand">
                      <Icon name="shield" size={20} />
                    </div>
                    <div className="font-semibold">Verified teacher access</div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Hirers see verification badges, while documents stay private for admin review and safeguarding checks.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-chalk p-5">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand">
                      <Icon name="message" size={20} />
                    </div>
                    <div className="font-semibold">Account-led communication</div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Requests, messages, bookings, and location details should stay under the adult account.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-white p-5">
                  <div className="space-y-4">
                    <Field error={errors.individualConsent}>
                      <Checkbox
                        checked={form.individualConsent}
                        onChange={(value) => updateField("individualConsent", value)}
                        label="I confirm I am authorised to arrange this learning support."
                      />
                    </Field>
                    <Field error={errors.safeguardingConfirmed}>
                      <Checkbox
                        checked={form.safeguardingConfirmed}
                        onChange={(value) => updateField("safeguardingConfirmed", value)}
                        label="I understand direct contact, messaging, and bookings should remain inside SupplyED."
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ) : null}

            {isLastStep ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
                      <Icon name="checkCircle" size={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-brand-dark">Ready to submit</div>
                      <p className="mt-1 text-sm leading-6 text-brand-dark/80">
                        Review the details below. Each section can be edited without losing the information you already entered.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-4">
                    {reviewGroups[0] ? (
                      <ReviewCard group={reviewGroups[0]} onEdit={() => setStep(reviewGroups[0].editStep)} />
                    ) : null}
                    {reviewGroups[2] ? (
                      <ReviewCard group={reviewGroups[2]} onEdit={() => setStep(reviewGroups[2].editStep)} />
                    ) : null}
                  </div>
                  {reviewGroups[1] ? (
                    <ReviewCard featured group={reviewGroups[1]} onEdit={() => setStep(reviewGroups[1].editStep)} />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {submitError ? (
            <div className="mt-6 rounded-xl border border-danger bg-danger-tint px-4 py-3 text-sm font-semibold text-danger">
              {submitError}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Btn variant="ghost" disabled={currentStep === 1 || Boolean(pending)} onClick={() => setStep(Math.max(1, currentStep - 1))}>Back</Btn>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="self-center text-xs font-semibold uppercase tracking-[1px] text-muted">Saved on continue</span>
              <Btn
                loading={pending === "step" || pending === "submit"}
                loadingLabel={isLastStep ? "Submitting" : "Saving step"}
                size="lg"
                iconRight="arrow"
                disabled={Boolean(uploadPending)}
                onClick={() => (isLastStep ? submitSignup() : continueStep())}
              >
                {isLastStep ? signupSubmitLabel(activeRole) : "Continue"}
              </Btn>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
