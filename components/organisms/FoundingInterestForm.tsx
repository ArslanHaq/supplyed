"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Field, Icon } from "@/components/atoms";
import {
  type FoundingInterestActionState,
  type WaitlistField,
} from "@/features/contact/actions";
import { submitWaitlistAction } from "@/features/contact/waitlist-client";
import {
  coverBookingOptions,
  currentSupplyOptions,
  daysPerWeekOptions,
  supplyDaysOptions,
  waitlistSchoolAreas,
  waitlistSchoolRoles,
  waitlistSchoolTypes,
  waitlistTeacherAreas,
  waitlistTeacherRoles,
} from "@/features/contact/waitlist-options";
import { WaitlistConfirmation } from "./WaitlistConfirmation";

type InterestType = "SCHOOL" | "TEACHER";
type Props = {
  allowTypeSelection?: boolean;
  campaign?: string;
  id?: string;
  source?: string;
  type: InterestType;
  onAudienceChange?: (type: InterestType) => void;
};

export function FoundingInterestForm({
  allowTypeSelection = false,
  campaign,
  id = "founding-interest-form",
  source,
  type,
  onAudienceChange,
}: Props) {
  const [interestType, setInterestType] = useState(type);
  const selectedType = onAudienceChange ? type : interestType;
  return (
    <WaitlistForm
      key={selectedType}
      {...{ allowTypeSelection, campaign, id, source }}
      type={selectedType}
      onTypeChange={(nextType) => {
        setInterestType(nextType);
        onAudienceChange?.(nextType);
      }}
    />
  );
}

function WaitlistForm({
  allowTypeSelection,
  campaign,
  id = "founding-interest-form",
  source,
  type,
  onTypeChange,
}: Props & { onTypeChange: (type: InterestType) => void }) {
  const [state, action, pending] = useActionState(
    submitWaitlistAction,
    null as FoundingInterestActionState,
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [founding, setFounding] = useState(false);
  const school = type === "SCHOOL";
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const fieldId = (field: string) => `${id}-${field}`;
  function input(
    name: WaitlistField,
    label: string,
    placeholder: string,
    options: {
      type?: string;
      autoComplete?: string;
      optional?: boolean;
      maxLength?: number;
    } = {},
  ) {
    return (
      <Field
        label={label}
        htmlFor={fieldId(name)}
        error={errors?.[name]}
        required={!options.optional}
      >
        <input
          aria-invalid={Boolean(errors?.[name])}
          autoComplete={options.autoComplete}
          className="input"
          id={fieldId(name)}
          maxLength={options.maxLength ?? 120}
          name={name}
          onChange={(e) =>
            setValues((current) => ({ ...current, [name]: e.target.value }))
          }
          placeholder={placeholder}
          required={!options.optional}
          type={options.type ?? "text"}
          value={values[name] ?? ""}
        />
      </Field>
    );
  }
  function select(
    name: WaitlistField,
    label: string,
    options: readonly string[],
  ) {
    return (
      <Field
        label={label}
        htmlFor={fieldId(name)}
        error={errors?.[name]}
        required
      >
        <select
          aria-invalid={Boolean(errors?.[name])}
          className="select"
          id={fieldId(name)}
          name={name}
          onChange={(e) =>
            setValues((current) => ({ ...current, [name]: e.target.value }))
          }
          required
          value={values[name] ?? ""}
        >
          <option value="">Select an option</option>
          {options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  if (state?.ok)
    return (
      <WaitlistConfirmation
        result={state.data}
        firstName={
          school ? (values.name ?? "").split(" ")[0] : (values.firstName ?? "")
        }
        email={values.email?.trim() ?? ""}
        type={type}
        id={id}
      />
    );
  return (
    <form action={action} className="waitlist-form" id={id}>
      <input name="type" type="hidden" value={type} />
      <input
        name="source"
        type="hidden"
        value={
          source ??
          (school ? "founding-schools-landing" : "founding-teachers-landing")
        }
      />
      {campaign ? (
        <input name="campaign" type="hidden" value={campaign} />
      ) : null}
      <div className="waitlist-form-heading">
        <span className="eyebrow">Be one of the first in</span>
        <h2>
          {allowTypeSelection
            ? "Join the waitlist"
            : `Join the ${school ? "schools" : "teacher"} waitlist`}
        </h2>
        <p>
          No checks and no commitment. We&apos;ll invite the first cohort ahead
          of the pilot.
        </p>
      </div>
      <fieldset className="waitlist-form-fields" disabled={pending}>
        <legend className="sr-only">
          {school ? "School" : "Teacher"} waitlist details
        </legend>
        {allowTypeSelection ? (
          <div
            className="waitlist-audience"
            aria-label="Join as a school or teacher"
          >
            <button
              aria-pressed={school}
              onClick={() => onTypeChange("SCHOOL")}
              type="button"
            >
              <Icon name="building" size={17} /> I&apos;m a school
            </button>
            <button
              aria-pressed={!school}
              onClick={() => onTypeChange("TEACHER")}
              type="button"
            >
              <Icon name="user" size={17} /> I&apos;m a teacher
            </button>
          </div>
        ) : null}
        {school ? (
          <>
            {input(
              "organizationName",
              "School name",
              "e.g. St Mary’s CE Primary",
              { autoComplete: "organization", maxLength: 160 },
            )}
            <div className="waitlist-field-grid">
              {input("name", "Your name", "Full name", {
                autoComplete: "name",
              })}
              {select("role", "Your role", waitlistSchoolRoles)}
            </div>
            {input("email", "Work email", "name@school.org.uk", {
              type: "email",
              autoComplete: "email",
              maxLength: 254,
            })}
            <div className="waitlist-field-grid">
              {select("area", "Area", waitlistSchoolAreas)}
              {select("schoolType", "School type", waitlistSchoolTypes)}
            </div>
            {select(
              "supplyDaysPerTerm",
              "Supply days per term (roughly)",
              supplyDaysOptions,
            )}
            {select(
              "coverBookingMethod",
              "How you book cover now",
              coverBookingOptions,
            )}
            <label className="waitlist-checkbox">
              <input
                checked={founding}
                name="foundingProgrammeInterest"
                onChange={(e) => setFounding(e.target.checked)}
                type="checkbox"
              />
              <span>
                I&apos;d like to hear about the Founding Schools Programme (20
                places).
              </span>
            </label>
          </>
        ) : (
          <>
            <div className="waitlist-field-grid">
              {input("firstName", "First name", "First name", {
                autoComplete: "given-name",
                maxLength: 60,
              })}
              {input("lastName", "Last name", "Last name", {
                autoComplete: "family-name",
                maxLength: 60,
              })}
            </div>
            {input("email", "Email", "you@email.com", {
              type: "email",
              autoComplete: "email",
              maxLength: 254,
            })}
            {input("phone", "Mobile number (optional)", "e.g. 07700 900123", {
              type: "tel",
              autoComplete: "tel",
              optional: true,
              maxLength: 32,
            })}
            <div className="waitlist-field-grid">
              {select("role", "I work as a", waitlistTeacherRoles)}
              {select("area", "Where you’ll work", waitlistTeacherAreas)}
            </div>
            {select(
              "currentSupply",
              "Are you doing supply now?",
              currentSupplyOptions,
            )}
            {select(
              "daysPerWeek",
              "How many days a week would you want?",
              daysPerWeekOptions,
            )}
            <label className="waitlist-checkbox">
              <input
                aria-invalid={Boolean(errors?.emailConsent)}
                checked={consent}
                name="emailConsent"
                onChange={(e) => setConsent(e.target.checked)}
                required
                type="checkbox"
              />
              <span>
                Email me about the first cohort and SupplyED&apos;s launch. I
                can unsubscribe any time.
              </span>
            </label>
            {errors?.emailConsent ? (
              <p className="text-danger text-sm" role="alert">
                {errors.emailConsent}
              </p>
            ) : null}
          </>
        )}
        {state && !state.ok ? (
          <p className="waitlist-form-error" role="alert">
            {state.message}
          </p>
        ) : null}
        <Button
          className="w-full"
          loading={pending}
          loadingLabel="Joining the waitlist"
          iconRight="arrow"
          size="lg"
          type="submit"
        >
          Join the {school ? "schools" : "teacher"} waitlist
        </Button>
        <p className="waitlist-form-privacy">
          We&apos;ll only email you about SupplyED&apos;s launch and first
          cohort. See our <Link href="/terms#privacy">privacy information</Link>
          .
        </p>
      </fieldset>
    </form>
  );
}
