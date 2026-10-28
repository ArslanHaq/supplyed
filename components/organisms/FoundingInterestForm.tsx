"use client";
import { useRateLimit } from "@/lib/rate-limit";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Checkbox, Field, Icon } from "@/components/atoms";
import { DynamicSelect } from "@/components/molecules/DynamicDropdown";
import type { DropdownName } from "@/features/dropdowns/types";
import { PhoneInput } from "@/components/molecules/PhoneInput";
import { validateUkPhone } from "@/lib/uk-validation";
import {
  type FoundingInterestActionState,
  type WaitlistField,
} from "@/features/contact/actions";
import { submitWaitlistAction } from "@/features/contact/waitlist-client";
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
  const retryAfter = useRateLimit();
  const [state, action, pending] = useActionState(
    submitWaitlistAction,
    null as FoundingInterestActionState,
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [founding, setFounding] = useState(false);
  const school = type === "SCHOOL";
  const invalidPhone = !school && !validateUkPhone(values.phone).valid;
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
    collection: DropdownName,
  ) {
    return (
      <Field
        label={label}
        htmlFor={fieldId(name)}
        error={errors?.[name]}
        required
      >
        <DynamicSelect
          aria-invalid={Boolean(errors?.[name])}
          disabled={pending || Boolean(retryAfter)}
          error={Boolean(errors?.[name])}
          id={fieldId(name)}
          name={name}
          onChange={(value) =>
            setValues((current) => ({ ...current, [name]: value }))
          }
          collection={collection}
          required
          value={values[name] ?? ""}
        />
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
    <form action={action} className="waitlist-form" id={id} noValidate onSubmit={(event) => { if (invalidPhone) event.preventDefault(); }}>
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
      <fieldset className="waitlist-form-fields" disabled={pending || Boolean(retryAfter)}>
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
              {select("role", "Your role", "waitlistSchoolRole")}
            </div>
            {input("email", "Work email", "name@school.org.uk", {
              type: "email",
              autoComplete: "email",
              maxLength: 254,
            })}
            <div className="waitlist-field-grid">
              {select("area", "Area", "waitlistSchoolArea")}
              {select("schoolType", "School type", "waitlistSchoolType")}
            </div>
            {select(
              "supplyDaysPerTerm",
              "Supply days per term (roughly)",
              "supplyDaysPerTerm",
            )}
            {select(
              "coverBookingMethod",
              "How you book cover now",
              "coverBookingMethod",
            )}
            <Checkbox
              checked={founding}
              className="waitlist-checkbox"
              disabled={pending || Boolean(retryAfter)}
              label="I'd like to hear about the Founding Schools Programme (20 places)."
              name="foundingProgrammeInterest"
              onChange={setFounding}
            />
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
            <PhoneInput
              disabled={pending || Boolean(retryAfter)}
              error={errors?.phone}
              id={fieldId("phone")}
              label="UK phone number (optional)"
              name="phone"
              onChange={(phone) => setValues((current) => ({ ...current, phone }))}
              placeholder="e.g. 07400 123456 or 020 7946 0018"
              value={values.phone ?? ""}
            />
            <div className="waitlist-field-grid">
              {select("role", "I work as a", "waitlistTeacherRole")}
              {select("area", "Where you’ll work", "waitlistTeacherArea")}
            </div>
            {select(
              "currentSupply",
              "Are you doing supply now?",
              "currentSupply",
            )}
            {select(
              "daysPerWeek",
              "How many days a week would you want?",
              "daysPerWeek",
            )}
            <Checkbox
              aria-invalid={Boolean(errors?.emailConsent)}
              checked={consent}
              className="waitlist-checkbox"
              disabled={pending || Boolean(retryAfter)}
              label="Email me about the first cohort and SupplyED's launch. I can unsubscribe any time."
              name="emailConsent"
              onChange={setConsent}
              required
            />
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
          disabled={invalidPhone || Boolean(retryAfter)}
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
