"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button, Field, Icon } from "@/components/atoms";
import { foundingInterestAction, type FoundingInterestActionState } from "@/features/contact/actions";
import {
  foundingSchoolRoles,
  foundingSchoolTiers,
  foundingTeacherRoles,
  schoolTypes,
  teacherAvailabilityOptions,
  teacherPhases,
} from "@/features/contact/founding-interest-options";

type FoundingInterestType = "SCHOOL" | "TEACHER";

type FoundingInterestFormProps = {
  campaign?: string;
  source?: string;
  type: FoundingInterestType;
};

const initialState: FoundingInterestActionState = null;

function SelectField({
  defaultValue,
  error,
  id,
  label,
  name,
  options,
  required,
}: {
  defaultValue?: string;
  error?: string;
  id: string;
  label: string;
  name: string;
  options: readonly string[];
  required?: boolean;
}) {
  return (
    <Field error={error} htmlFor={id} label={label} required={required}>
      <div className="relative">
        <select
          aria-invalid={Boolean(error)}
          className="select appearance-none bg-white pr-10 transition hover:border-brand/50 hover:bg-chalk/40"
          defaultValue={defaultValue ?? ""}
          id={id}
          name={name}
          required={required}
        >
          <option disabled value="">
            Select {label.toLowerCase()}
          </option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-chalk text-muted"
        >
          <Icon name="chevronDown" size={15} />
        </span>
      </div>
    </Field>
  );
}

export function FoundingInterestForm({ campaign, source, type }: FoundingInterestFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(foundingInterestAction, initialState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const isSchool = type === "SCHOOL";

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-white p-5 text-left shadow-(--shadow-sm) sm:p-7"
      noValidate
    >
      <input name="type" type="hidden" value={type} />
      <input name="source" type="hidden" value={source ?? (isSchool ? "founding-schools-landing" : "founding-teachers-landing")} />
      {campaign ? <input name="campaign" type="hidden" value={campaign} /> : null}

      <div className="mb-5">
        <h2 className="font-serif text-2xl leading-tight">
          {isSchool ? "Register your school's interest" : "Register your teacher interest"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isSchool
            ? "Two minutes. No commitment. We'll be in touch before launch."
            : "Tell us where you work best, then we'll contact you about verification and launch access."}
        </p>
      </div>

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

        <Field error={errors?.phone} htmlFor="founding-phone" hint="Optional" label="Phone">
          <input
            aria-invalid={Boolean(errors?.phone)}
            autoComplete="tel"
            className="input"
            id="founding-phone"
            inputMode="tel"
            name="phone"
            placeholder="07700 000000"
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
          <SelectField error={errors?.schoolType} id="founding-school-type" label="School type" name="schoolType" options={schoolTypes} required />
        ) : (
          <SelectField error={errors?.phase} id="founding-phase" label="Phase you work in" name="phase" options={teacherPhases} required />
        )}
      </div>

      {isSchool ? (
        <SelectField
          defaultValue={foundingSchoolTiers[0]}
          error={errors?.tier}
          id="founding-tier"
          label="Tier of interest"
          name="tier"
          options={foundingSchoolTiers}
        />
      ) : (
        <SelectField
          defaultValue={teacherAvailabilityOptions[0]}
          error={errors?.availability}
          id="founding-availability"
          label="Availability you're looking for"
          name="availability"
          options={teacherAvailabilityOptions}
        />
      )}

      <Field
        error={errors?.message}
        htmlFor="founding-message"
        hint="Optional"
        label="Anything you'd like us to know"
      >
        <textarea
          aria-invalid={Boolean(errors?.message)}
          className="textarea min-h-[116px]"
          id="founding-message"
          name="message"
          placeholder={
            isSchool
              ? "e.g. roughly how many supply days you cover per term, or your biggest frustration with agencies"
              : "e.g. subjects and key stages you cover, how far you'll travel, or your biggest frustration with agency work"
          }
        />
      </Field>

      <Button className="w-full text-white!" loading={pending} loadingLabel="Sending details" size="lg" type="submit">
        {isSchool ? "Register interest ->" : "Send teacher interest ->"}
      </Button>

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

      <p className="mt-4 text-center text-xs leading-5 text-muted">
        We only use this to contact you about SupplyED onboarding and founding cohort access.
      </p>
    </form>
  );
}
