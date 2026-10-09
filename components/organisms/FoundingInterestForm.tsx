"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button, Field, Icon } from "@/components/atoms";
import { foundingInterestAction, type FoundingInterestActionState } from "@/features/contact/actions";
import {
  foundingSchoolRoles,
  foundingTeacherRoles,
  schoolTypes,
  teacherPhases,
} from "@/features/contact/founding-interest-options";

type FoundingInterestType = "SCHOOL" | "TEACHER";

type FoundingInterestFormProps = {
  allowTypeSelection?: boolean;
  campaign?: string;
  id?: string;
  source?: string;
  type: FoundingInterestType;
};

const initialValues = {
  email: "",
  message: "",
  name: "",
  organizationName: "",
  phone: "",
  phase: "",
  postcode: "",
  role: "",
  schoolType: "",
};
type InterestField = keyof typeof initialValues;

export function FoundingInterestForm({
  allowTypeSelection = false,
  campaign,
  id = "founding-interest-form",
  source,
  type,
}: FoundingInterestFormProps) {
  const [interestType, setInterestType] = useState(type);
  const [values, setValues] = useState(initialValues);
  const [editedFields, setEditedFields] = useState<InterestField[]>([]);
  const [state, formAction, pending] = useActionState(foundingInterestAction, null as FoundingInterestActionState);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const isSchool = interestType === "SCHOOL";
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const fieldError = (field: InterestField) => editedFields.includes(field) ? undefined : fieldErrors?.[field];
  const fieldId = (field: InterestField) => `${id}-${field}`;

  useEffect(() => {
    if (state?.ok) confirmationRef.current?.focus();
  }, [state]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const field = event.target.name as InterestField;
    const value = event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    setEditedFields((current) => current.includes(field) ? current : [...current, field]);
  }

  function selectInterestType(nextType: FoundingInterestType) {
    setInterestType(nextType);
    setValues((current) => ({ ...current, role: "" }));
    setEditedFields(Object.keys(initialValues) as InterestField[]);
  }

  if (state?.ok) {
    return (
      <div ref={confirmationRef} className="marketing-interest-confirmation" id={id} role="status" tabIndex={-1}>
        <span className="marketing-interest-confirmation-icon"><Icon name="checkCircle" size={27} /></span>
        <div className="eyebrow">Interest registered</div>
        <h2>{state.data.alreadyRegistered ? "You’re already on the list." : "Thanks for your interest."}</h2>
        <p>{state.message || "We’ve received your details and will be in touch before launch."}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="marketing-founding-form marketing-simple-interest text-left"
      id={id}
      onSubmit={() => setEditedFields([])}
    >
      <input name="type" type="hidden" value={interestType} />
      <input name="source" type="hidden" value={source ?? (isSchool ? "founding-schools-landing" : "founding-teachers-landing")} />
      {campaign ? <input name="campaign" type="hidden" value={campaign} /> : null}

      <div className="marketing-interest-heading">
        <span className="eyebrow">Be part of the founding community</span>
        <h2 className="mt-2 font-heading text-2xl">Register your interest</h2>
        <p className="mt-2 text-sm leading-6 text-muted">A few details so we can get in touch. No account or commitment needed.</p>
      </div>

      <fieldset className="marketing-interest-fields" disabled={pending}>
        <legend className="sr-only">{isSchool ? "School interest details" : "Teacher interest details"}</legend>

        {allowTypeSelection ? (
          <fieldset className="marketing-interest-type">
            <legend>I&apos;m interested as a</legend>
            <div>
              {([
                ["SCHOOL", "School or trust", "building"],
                ["TEACHER", "Teacher or support staff", "user"],
              ] as const).map(([value, label, icon]) => (
                <label className={interestType === value ? "is-selected" : ""} key={value}>
                  <input
                    checked={interestType === value}
                    name="interestAudience"
                    onChange={() => selectInterestType(value)}
                    type="radio"
                    value={value}
                  />
                  <Icon name={icon} size={18} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <Field error={fieldError("name")} htmlFor={fieldId("name")} label="Your name" required>
          <input aria-invalid={Boolean(fieldError("name"))} autoComplete="name" className="input" id={fieldId("name")} maxLength={120} minLength={2} name="name" onChange={updateField} placeholder={isSchool ? "Jane Smith" : "Sam Taylor"} required value={values.name} />
        </Field>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field error={fieldError("email")} htmlFor={fieldId("email")} label={isSchool ? "Work email" : "Email"} required>
            <input aria-invalid={Boolean(fieldError("email"))} autoComplete="email" className="input" id={fieldId("email")} maxLength={254} name="email" onChange={updateField} placeholder={isSchool ? "name@school.org.uk" : "you@email.com"} required type="email" value={values.email} />
          </Field>
          <Field error={fieldError("phone")} htmlFor={fieldId("phone")} label="Phone number" required>
            <input aria-invalid={Boolean(fieldError("phone"))} autoComplete="tel" className="input" id={fieldId("phone")} maxLength={32} name="phone" onChange={updateField} placeholder="07700 000000" required type="tel" value={values.phone} />
          </Field>
        </div>

        {isSchool ? (
          <Field error={fieldError("organizationName")} htmlFor={fieldId("organizationName")} label="School / trust name" required>
            <input aria-invalid={Boolean(fieldError("organizationName"))} autoComplete="organization" className="input" id={fieldId("organizationName")} maxLength={160} minLength={2} name="organizationName" onChange={updateField} placeholder="e.g. Greenfield Primary School" required value={values.organizationName} />
          </Field>
        ) : null}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field error={fieldError("role")} htmlFor={fieldId("role")} label="Your role" required>
            <select aria-invalid={Boolean(fieldError("role"))} className="select" id={fieldId("role")} name="role" onChange={updateField} required value={values.role}>
              <option value="">Select your role</option>
              {(isSchool ? foundingSchoolRoles : foundingTeacherRoles).map((role) => <option key={role}>{role}</option>)}
            </select>
          </Field>
          <Field error={fieldError("postcode")} htmlFor={fieldId("postcode")} label={isSchool ? "School postcode" : "Your postcode"} required>
            <input aria-invalid={Boolean(fieldError("postcode"))} autoComplete="postal-code" className="input" id={fieldId("postcode")} maxLength={20} minLength={2} name="postcode" onChange={updateField} placeholder={isSchool ? "e.g. BB1 1AA" : "e.g. M1 1AE"} required value={values.postcode} />
          </Field>
        </div>

        {isSchool ? (
          <Field error={fieldError("schoolType")} htmlFor={fieldId("schoolType")} label="School type" required>
            <select aria-invalid={Boolean(fieldError("schoolType"))} className="select" id={fieldId("schoolType")} name="schoolType" onChange={updateField} required value={values.schoolType}>
              <option value="">Select school type</option>
              {schoolTypes.map((schoolType) => <option key={schoolType}>{schoolType}</option>)}
            </select>
          </Field>
        ) : (
          <Field error={fieldError("phase")} htmlFor={fieldId("phase")} label="Phase you work in" required>
            <select aria-invalid={Boolean(fieldError("phase"))} className="select" id={fieldId("phase")} name="phase" onChange={updateField} required value={values.phase}>
              <option value="">Select phase</option>
              {teacherPhases.map((phase) => <option key={phase}>{phase}</option>)}
            </select>
          </Field>
        )}

        <Field error={fieldError("message")} hint="Optional" htmlFor={fieldId("message")} label="Anything you'd like us to know">
          <textarea
            aria-invalid={Boolean(fieldError("message"))}
            className="textarea min-h-[88px]"
            id={fieldId("message")}
            maxLength={2000}
            name="message"
            onChange={updateField}
            placeholder={isSchool ? "Tell us a little about your cover needs." : "Tell us what kind of work you’re looking for."}
            value={values.message}
          />
        </Field>

        {state?.message && editedFields.length === 0 ? (
          <div className="mb-4 rounded-lg border border-danger/20 bg-danger-tint p-3 text-sm leading-6 text-danger" role="alert">
            {state.message}
          </div>
        ) : null}

        <Button className="w-full" iconRight="arrow" loading={pending} loadingLabel="Sending your interest" size="lg" type="submit">
          Register interest
        </Button>
        <p className="mt-4 text-center text-xs leading-5 text-muted">We&apos;ll only use these details to contact you about SupplyED and the founding programme.</p>
      </fieldset>
    </form>
  );
}
