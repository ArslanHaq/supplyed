"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Button, Field, Icon } from "@/components/atoms";
import { MultiSelectDropdown, SelectDropdown } from "@/components/molecules/OptionDropdowns";
import { foundingInterestAction, type FoundingInterestActionState } from "@/features/contact/actions";
import {
  foundingSchoolCoverTypes,
  foundingSchoolRoles,
  foundingSchoolTiers,
  foundingTeacherKeyStages,
  foundingTeacherRoles,
  foundingTeacherSkills,
  foundingTeacherSubjects,
  schoolTypes,
  teacherAvailabilityOptions,
  teacherPhases,
} from "@/features/contact/founding-interest-options";
import {
  type FoundingSignupIntent,
  foundingSignupHref,
  readFoundingSignupType,
  saveFoundingSignupIntentFromForm,
} from "@/lib/founding-signup-intent";
import { startRouteLoading } from "@/lib/navigation-loading";

type FoundingInterestType = "SCHOOL" | "TEACHER";
type FormStep = 1 | 2;
type FoundingFormField =
  | "availability"
  | "bio"
  | "coverTypes"
  | "dailyRate"
  | "email"
  | "hourlyRate"
  | "institutionAddress"
  | "institutionCity"
  | "institutionDomain"
  | "keyStages"
  | "localAuthority"
  | "maxTravelDistance"
  | "message"
  | "name"
  | "organizationName"
  | "phone"
  | "phase"
  | "postcode"
  | "role"
  | "schoolType"
  | "skills"
  | "subjects"
  | "tier"
  | "typicalPupilCount"
  | "yearsExperience";
type FoundingFormErrors = Partial<Record<FoundingFormField, string>>;

type FoundingInterestFormProps = {
  campaign?: string;
  id?: string;
  source?: string;
  type: FoundingInterestType;
};

const initialState: FoundingInterestActionState = null;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\s-]{10,}$/;
const domainPattern = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;
function readFormString(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFormStringArray(data: FormData, key: string) {
  return data
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isOneOf(value: string, options: readonly string[]) {
  return options.includes(value);
}

function isNonNegativeNumber(value: string) {
  if (!value) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase() ?? "";
}

function SelectField({
  defaultValue,
  error,
  id,
  label,
  hint,
  name,
  onValueChange,
  options,
  placeholder,
  required,
}: {
  defaultValue?: string;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  name: FoundingFormField;
  onValueChange?: (field: FoundingFormField) => void;
  options: readonly string[];
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  function handleChange(nextValue: string) {
    setValue(nextValue);
    onValueChange?.(name);
  }

  return (
    <Field error={error} hint={hint} htmlFor={id} label={label} required={required}>
      <SelectDropdown
        error={Boolean(error)}
        id={id}
        onChange={handleChange}
        options={options}
        placeholder={placeholder ?? `Select ${label.toLowerCase()}`}
        value={value}
      />
      <input name={name} type="hidden" value={value} />
    </Field>
  );
}

function MultiDropdownField({
  error,
  hint,
  id,
  label,
  name,
  onValueChange,
  options,
  placeholder,
  required,
}: {
  error?: string;
  hint?: string;
  id: string;
  label: string;
  name: FoundingFormField;
  onValueChange?: (field: FoundingFormField) => void;
  options: readonly string[];
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState<string[]>([]);

  function handleChange(nextValue: string[]) {
    setValue(nextValue);
    onValueChange?.(name);
  }

  return (
    <Field error={error} hint={hint} htmlFor={id} label={label} required={required}>
      <MultiSelectDropdown
        error={Boolean(error)}
        id={id}
        onChange={handleChange}
        options={options}
        placeholder={placeholder ?? `Select ${label.toLowerCase()}`}
        value={value}
      />
      {value.map((item) => (
        <input key={item} name={name} type="hidden" value={item} />
      ))}
    </Field>
  );
}

function StepButton({
  active,
  complete,
  icon,
  label,
  onClick,
  step,
}: {
  active: boolean;
  complete: boolean;
  icon: string;
  label: string;
  onClick: () => void;
  step: number;
}) {
  return (
    <button
      aria-current={active ? "step" : undefined}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-ink text-white shadow-(--shadow-xs)" : "text-slate hover:bg-chalk"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          active ? "bg-white/15 text-white" : complete ? "bg-brand text-white" : "bg-chalk text-muted"
        }`}
      >
        {complete ? <Icon name="check" size={12} /> : step}
      </span>
      <Icon name={icon} size={15} />
      <span>{label}</span>
    </button>
  );
}

function PanelIntro({ copy, icon, title }: { copy: string; icon: string; title: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <h3 className="font-serif text-2xl leading-tight">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{copy}</p>
      </div>
    </div>
  );
}

export function FoundingInterestForm({ campaign, id, source, type }: FoundingInterestFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submittedIntentRef = useRef<FoundingSignupIntent | undefined>(undefined);
  const [activeFormStep, setActiveFormStep] = useState<FormStep>(1);
  const [clientErrors, setClientErrors] = useState<FoundingFormErrors>({});
  const [dismissedServerErrors, setDismissedServerErrors] = useState<Partial<Record<FoundingFormField, string>>>({});
  const [state, formAction, pending] = useActionState(foundingInterestAction, initialState);
  const serverErrors = state && !state.ok ? state.fieldErrors : undefined;
  const serverErrorKey = useMemo(() => JSON.stringify(serverErrors ?? {}), [serverErrors]);
  const errors = useMemo(() => {
    const visibleServerErrors = { ...(serverErrors ?? {}) };

    Object.keys(dismissedServerErrors).forEach((field) => {
      if (dismissedServerErrors[field as FoundingFormField] === serverErrorKey) {
        delete visibleServerErrors[field as FoundingFormField];
      }
    });

    return { ...visibleServerErrors, ...clientErrors };
  }, [clientErrors, dismissedServerErrors, serverErrorKey, serverErrors]);
  const isSchool = type === "SCHOOL";
  const stepTwoLabel = isSchool ? "School profile" : "Teacher profile";

  const clearFieldError = useCallback((field: FoundingFormField) => {
    setClientErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
    setDismissedServerErrors((current) => {
      if (current[field] === serverErrorKey) return current;
      return { ...current, [field]: serverErrorKey };
    });
  }, [serverErrorKey]);

  const captureSignupIntent = useCallback(() => {
    if (!formRef.current) return undefined;

    const intent = saveFoundingSignupIntentFromForm(formRef.current, type);
    if (intent) {
      submittedIntentRef.current = intent;
    }

    return intent;
  }, [type]);

  function collectStepErrors(step: FormStep) {
    if (!formRef.current) return {};

    const data = new FormData(formRef.current);
    const nextErrors: FoundingFormErrors = {};
    const email = readFormString(data, "email").toLowerCase();
    const phone = readFormString(data, "phone");

    if (step === 1) {
      if (isSchool) {
        const organizationName = readFormString(data, "organizationName");
        if (organizationName.length < 2) nextErrors.organizationName = "Enter the school or trust name.";
        else if (organizationName.length > 160) nextErrors.organizationName = "Use 160 characters or fewer.";
      }

      const name = readFormString(data, "name");
      if (name.length < 2) nextErrors.name = "Enter your name.";
      else if (name.length > 120) nextErrors.name = "Use 120 characters or fewer.";

      const role = readFormString(data, "role");
      if (!role) nextErrors.role = "Choose your role.";
      else if (!isOneOf(role, isSchool ? foundingSchoolRoles : foundingTeacherRoles)) nextErrors.role = "Choose a valid role.";

      if (!emailPattern.test(email)) nextErrors.email = isSchool ? "Use a valid work email address." : "Use a valid email address.";
      else if (email.length > 254) nextErrors.email = "Use 254 characters or fewer.";

      if (!phone) nextErrors.phone = "Enter a contact number.";
      else if (phone.length > 32) nextErrors.phone = "Use 32 characters or fewer.";
      else if (!phonePattern.test(phone)) nextErrors.phone = "Use a valid contact number.";

      const postcode = readFormString(data, "postcode");
      if (postcode.length < 2) nextErrors.postcode = "Enter a postcode.";
      else if (postcode.length > 20) nextErrors.postcode = "Use 20 characters or fewer.";

      if (isSchool) {
        const schoolType = readFormString(data, "schoolType");
        if (!isOneOf(schoolType, schoolTypes)) nextErrors.schoolType = "Choose the school type.";
      } else {
        const phase = readFormString(data, "phase");
        if (!isOneOf(phase, teacherPhases)) nextErrors.phase = "Choose the phase you work in.";

        const availability = readFormString(data, "availability");
        if (availability && !isOneOf(availability, teacherAvailabilityOptions)) {
          nextErrors.availability = "Choose a valid availability option.";
        }
      }
    }

    if (step === 2) {
      const message = readFormString(data, "message");
      if (message.length > 2000) nextErrors.message = "Use 2000 characters or fewer.";

      if (isSchool) {
        const tier = readFormString(data, "tier");
        if (tier && !isOneOf(tier, foundingSchoolTiers)) nextErrors.tier = "Choose a valid tier.";

        const institutionDomain = normalizeDomain(readFormString(data, "institutionDomain"));
        if (institutionDomain && !domainPattern.test(institutionDomain)) {
          nextErrors.institutionDomain = "Use a valid domain, for example greenfield.ac.uk.";
        }

        const institutionAddress = readFormString(data, "institutionAddress");
        if (institutionAddress.length > 180) nextErrors.institutionAddress = "Use 180 characters or fewer.";

        const institutionCity = readFormString(data, "institutionCity");
        if (institutionCity.length > 100) nextErrors.institutionCity = "Use 100 characters or fewer.";

        const localAuthority = readFormString(data, "localAuthority");
        if (localAuthority.length > 100) nextErrors.localAuthority = "Use 100 characters or fewer.";

        const coverTypes = readFormStringArray(data, "coverTypes");
        if (coverTypes.some((coverType) => !isOneOf(coverType, foundingSchoolCoverTypes))) {
          nextErrors.coverTypes = "Choose valid staffing needs.";
        }
      } else {
        const subjects = readFormStringArray(data, "subjects");
        if (subjects.some((subject) => !isOneOf(subject, foundingTeacherSubjects))) {
          nextErrors.subjects = "Choose valid subjects.";
        }

        const keyStages = readFormStringArray(data, "keyStages");
        if (keyStages.some((keyStage) => !isOneOf(keyStage, foundingTeacherKeyStages))) {
          nextErrors.keyStages = "Choose valid key stages.";
        }

        const skills = readFormStringArray(data, "skills");
        if (skills.some((skill) => !isOneOf(skill, foundingTeacherSkills))) nextErrors.skills = "Choose valid skills.";

        const yearsExperience = readFormString(data, "yearsExperience").replace(/[^\d]/g, "");
        const dailyRate = readFormString(data, "dailyRate").replace(/[^\d.]/g, "");
        const hourlyRate = readFormString(data, "hourlyRate").replace(/[^\d.]/g, "");
        const maxTravelDistance = readFormString(data, "maxTravelDistance").replace(/[^\d.]/g, "");
        if (yearsExperience && !isNonNegativeNumber(yearsExperience)) nextErrors.yearsExperience = "Experience cannot be negative.";
        if (dailyRate && !isNonNegativeNumber(dailyRate)) nextErrors.dailyRate = "Daily rate cannot be negative.";
        if (hourlyRate && !isNonNegativeNumber(hourlyRate)) nextErrors.hourlyRate = "Hourly rate cannot be negative.";
        if (maxTravelDistance && !isNonNegativeNumber(maxTravelDistance)) nextErrors.maxTravelDistance = "Travel distance cannot be negative.";

        const bio = readFormString(data, "bio");
        if (bio.length > 1200) nextErrors.bio = "Use 1200 characters or fewer.";
      }
    }

    return nextErrors;
  }

  function validateFinalSubmit() {
    const stepOneErrors = collectStepErrors(1);
    const stepTwoErrors = collectStepErrors(2);
    const nextErrors = { ...stepOneErrors, ...stepTwoErrors };

    setClientErrors(nextErrors);

    if (Object.keys(stepOneErrors).length > 0) {
      setActiveFormStep(1);
    }

    return Object.keys(nextErrors).length === 0;
  }

  function goToProfileStep() {
    setActiveFormStep(2);
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function handleStepContinue(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    goToProfileStep();
  }

  function handleFieldChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    const name = target.name as FoundingFormField;
    if (!name) return;

    clearFieldError(name);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (activeFormStep === 1) {
      event.preventDefault();
      goToProfileStep();
      return;
    }

    if (!validateFinalSubmit()) {
      event.preventDefault();
      return;
    }

    captureSignupIntent();
  }

  useEffect(() => {
    if (!state) return;

    if (!state.ok) {
      return;
    }

    const signupType = readFoundingSignupType(type);
    if (!signupType) return;

    const intent = submittedIntentRef.current ?? captureSignupIntent();

    if (formRef.current) {
      formRef.current.reset();
    }

    startRouteLoading();
    router.push(foundingSignupHref(signupType, intent?.email));
  }, [captureSignupIntent, router, state, type]);

  return (
    <form
      id={id}
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-white text-left shadow-(--shadow-sm)"
      noValidate
      onChange={handleFieldChange}
      onSubmit={handleSubmit}
    >
      <input name="type" type="hidden" value={type} />
      <input name="source" type="hidden" value={source ?? (isSchool ? "founding-schools-landing" : "founding-teachers-landing")} />
      {campaign ? <input name="campaign" type="hidden" value={campaign} /> : null}

      <div className="rounded-t-xl border-b border-border bg-chalk/45 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="eyebrow mb-2 text-brand">{isSchool ? "Founding school" : "Founding teacher"}</div>
            <h2 className="font-serif text-2xl leading-tight">
              {isSchool ? "Start Your School Signup" : "Start Your Teacher Signup"}
            </h2>
            <p className="mt-2 max-w-[560px] text-sm leading-6 text-muted">
              Share the right details now so account creation and onboarding feel connected.
            </p>
          </div>
          <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-white px-3 text-xs font-bold uppercase tracking-[0.9px] text-brand">
            {activeFormStep} / 2
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-white p-1">
          <StepButton
            active={activeFormStep === 1}
            complete={activeFormStep > 1}
            icon="user"
            label="Contact"
            onClick={() => setActiveFormStep(1)}
            step={1}
          />
          <StepButton
            active={activeFormStep === 2}
            complete={false}
            icon={isSchool ? "building" : "award"}
            label="Profile"
            onClick={goToProfileStep}
            step={2}
          />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <section aria-hidden={activeFormStep !== 1} className={activeFormStep === 1 ? "block" : "hidden"}>
          <PanelIntro
            copy={isSchool ? "These details connect the interest record to the school account." : "These details connect the interest record to the teacher account."}
            icon="user"
            title="Contact details"
          />

          {isSchool ? (
            <Field error={errors?.organizationName} htmlFor="founding-organization" label="School / Trust name" required>
              <input
                aria-invalid={Boolean(errors?.organizationName)}
                autoComplete="organization"
                className="input"
                id="founding-organization"
                name="organizationName"
                placeholder="e.g. Greenfield Primary School"
                required
              />
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={errors?.name} htmlFor="founding-name" label="Your name" required>
              <input
                aria-invalid={Boolean(errors?.name)}
                autoComplete="name"
                className="input"
                id="founding-name"
                name="name"
                placeholder={isSchool ? "Jane Smith" : "Sam Taylor"}
                required
              />
            </Field>

            <SelectField
              error={errors?.role}
              id="founding-role"
              label="Role"
              name="role"
              onValueChange={clearFieldError}
              options={isSchool ? foundingSchoolRoles : foundingTeacherRoles}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={errors?.email} htmlFor="founding-email" label={isSchool ? "Work email" : "Email"} required>
              <input
                aria-invalid={Boolean(errors?.email)}
                autoComplete="email"
                className="input"
                id="founding-email"
                inputMode="email"
                name="email"
                placeholder={isSchool ? "name@school.org.uk" : "you@email.com"}
                required
                type="email"
              />
            </Field>

            <Field error={errors?.phone} htmlFor="founding-phone" label="Phone" required>
              <input
                aria-invalid={Boolean(errors?.phone)}
                autoComplete="tel"
                className="input"
                id="founding-phone"
                inputMode="tel"
                name="phone"
                placeholder="07700 000000"
                required
                type="tel"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              error={errors?.postcode}
              hint={isSchool ? undefined : "We use this to match you to schools within your travel range."}
              htmlFor="founding-postcode"
              label={isSchool ? "School postcode" : "Your postcode"}
              required
            >
              <input
                aria-invalid={Boolean(errors?.postcode)}
                autoComplete="postal-code"
                className="input"
                id="founding-postcode"
                name="postcode"
                placeholder={isSchool ? "e.g. BB1 1AA" : "e.g. M1 1AE"}
                required
              />
            </Field>

            {isSchool ? (
              <SelectField
                error={errors?.schoolType}
                id="founding-school-type"
                label="School type"
                name="schoolType"
                onValueChange={clearFieldError}
                options={schoolTypes}
                required
              />
            ) : (
              <SelectField
                error={errors?.phase}
                id="founding-phase"
                label="Phase you work in"
                name="phase"
                onValueChange={clearFieldError}
                options={teacherPhases}
                required
              />
            )}
          </div>

          {!isSchool ? (
            <SelectField
              error={errors?.availability}
              id="founding-availability"
              label="Availability you're looking for"
              name="availability"
              onValueChange={clearFieldError}
              options={teacherAvailabilityOptions}
            />
          ) : null}
        </section>

        <section aria-hidden={activeFormStep !== 2} className={activeFormStep === 2 ? "block" : "hidden"}>
          <PanelIntro
            copy={
              isSchool
                ? "Optional details here will prefill the school details step after verification."
                : "Optional details here will prefill the teacher profile step after verification."
            }
            icon={isSchool ? "building" : "award"}
            title={stepTwoLabel}
          />

          {isSchool ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  error={errors?.tier}
                  hint="Optional"
                  id="founding-tier"
                  label="Tier of interest"
                  name="tier"
                  onValueChange={clearFieldError}
                  options={foundingSchoolTiers}
                />
                <Field error={errors?.institutionDomain} hint="Optional" htmlFor="founding-institution-domain" label="School / trust domain">
                  <input
                    aria-invalid={Boolean(errors?.institutionDomain)}
                    autoComplete="url"
                    className="input"
                    id="founding-institution-domain"
                    inputMode="url"
                    name="institutionDomain"
                    placeholder="greenfield.ac.uk"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field error={errors?.institutionAddress} hint="Optional" htmlFor="founding-institution-address" label="School address">
                  <input
                    aria-invalid={Boolean(errors?.institutionAddress)}
                    autoComplete="street-address"
                    className="input"
                    id="founding-institution-address"
                    name="institutionAddress"
                    placeholder="1 School Lane"
                  />
                </Field>
                <Field error={errors?.institutionCity} hint="Optional" htmlFor="founding-institution-city" label="City">
                  <input
                    aria-invalid={Boolean(errors?.institutionCity)}
                    autoComplete="address-level2"
                    className="input"
                    id="founding-institution-city"
                    name="institutionCity"
                    placeholder="Manchester"
                  />
                </Field>
                <Field error={errors?.localAuthority} hint="Optional" htmlFor="founding-local-authority" label="County / region">
                  <input
                    aria-invalid={Boolean(errors?.localAuthority)}
                    autoComplete="address-level1"
                    className="input"
                    id="founding-local-authority"
                    name="localAuthority"
                    placeholder="Greater Manchester"
                  />
                </Field>
                <Field error={errors?.typicalPupilCount} htmlFor="founding-pupil-count" hint="Optional" label="Typical pupil count">
                  <input
                    aria-invalid={Boolean(errors?.typicalPupilCount)}
                    className="input"
                    id="founding-pupil-count"
                    inputMode="numeric"
                    name="typicalPupilCount"
                    placeholder="420"
                  />
                </Field>
              </div>

              <MultiDropdownField
                error={errors?.coverTypes}
                hint="Optional"
                id="founding-cover-types"
                label="Staffing needs"
                name="coverTypes"
                onValueChange={clearFieldError}
                options={foundingSchoolCoverTypes}
                placeholder="Select staffing needs"
              />
            </>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <MultiDropdownField
                  error={errors?.subjects}
                  hint="Optional"
                  id="founding-subjects"
                  label="Primary subjects"
                  name="subjects"
                  onValueChange={clearFieldError}
                  options={foundingTeacherSubjects}
                  placeholder="Select primary subjects"
                />
                <MultiDropdownField
                  error={errors?.keyStages}
                  hint="Optional"
                  id="founding-key-stages"
                  label="Key stages"
                  name="keyStages"
                  onValueChange={clearFieldError}
                  options={foundingTeacherKeyStages}
                  placeholder="Select key stages"
                />
              </div>

              <MultiDropdownField
                error={errors?.skills}
                hint="Optional"
                id="founding-skills"
                label="Skills"
                name="skills"
                onValueChange={clearFieldError}
                options={foundingTeacherSkills}
                placeholder="Select skills"
              />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field error={errors?.yearsExperience} hint="Optional" htmlFor="founding-years-experience" label="Years of experience">
                  <input
                    aria-invalid={Boolean(errors?.yearsExperience)}
                    className="input"
                    id="founding-years-experience"
                    inputMode="numeric"
                    name="yearsExperience"
                    placeholder="5"
                  />
                </Field>
                <Field error={errors?.dailyRate} htmlFor="founding-daily-rate" hint="Optional" label="Daily rate">
                  <input
                    aria-invalid={Boolean(errors?.dailyRate)}
                    className="input"
                    id="founding-daily-rate"
                    inputMode="decimal"
                    name="dailyRate"
                    placeholder="180"
                  />
                </Field>
                <Field error={errors?.hourlyRate} htmlFor="founding-hourly-rate" hint="Optional" label="Hourly rate">
                  <input
                    aria-invalid={Boolean(errors?.hourlyRate)}
                    className="input"
                    id="founding-hourly-rate"
                    inputMode="decimal"
                    name="hourlyRate"
                    placeholder="35"
                  />
                </Field>
                <Field error={errors?.maxTravelDistance} htmlFor="founding-travel-distance" hint="Miles, optional" label="Travel distance">
                  <input
                    aria-invalid={Boolean(errors?.maxTravelDistance)}
                    className="input"
                    id="founding-travel-distance"
                    inputMode="decimal"
                    name="maxTravelDistance"
                    placeholder="25"
                  />
                </Field>
              </div>

              <Field error={errors?.bio} hint="Optional" htmlFor="founding-bio" label="Teaching bio">
                <textarea
                  aria-invalid={Boolean(errors?.bio)}
                  className="textarea min-h-[118px]"
                  id="founding-bio"
                  name="bio"
                  placeholder="Describe your classroom style, specialist subjects, behaviour approach, and availability."
                />
              </Field>
            </>
          )}

          <Field error={errors?.message} htmlFor="founding-message" hint="Optional" label="Anything you'd like us to know">
            <textarea
              aria-invalid={Boolean(errors?.message)}
              className="textarea min-h-[104px]"
              id="founding-message"
              name="message"
              placeholder={
                isSchool
                  ? "e.g. roughly how many supply days you cover per term, or your biggest frustration with agencies"
                  : "e.g. preferred roles, travel constraints, or anything useful for matching"
              }
            />
          </Field>
        </section>

        {state?.message ? (
          <div
            className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${
              state.ok ? "border-success/20 bg-success-tint text-success" : "border-danger/20 bg-danger-tint text-danger"
            }`}
            role="status"
          >
            {state.message}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 rounded-b-xl border-t border-border bg-chalk/45 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Button
          className={activeFormStep === 1 ? "invisible" : ""}
          disabled={pending}
          icon="arrowLeft"
          onClick={() => setActiveFormStep(1)}
          variant="ghost"
        >
          Back
        </Button>
        <Button
          className="w-full text-white! sm:w-auto"
          iconRight="arrow"
          loading={activeFormStep === 2 && pending}
          loadingLabel="Sending details"
          onClick={activeFormStep === 1 ? handleStepContinue : undefined}
          size="lg"
          type={activeFormStep === 1 ? "button" : "submit"}
        >
          {activeFormStep === 1 ? "Continue" : isSchool ? "Continue to school signup" : "Continue to teacher signup"}
        </Button>
      </div>
    </form>
  );
}
