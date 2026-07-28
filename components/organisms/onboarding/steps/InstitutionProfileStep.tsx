import { Field } from "../../../atoms";
import { SelectDropdown } from "../../../molecules/OptionDropdowns";
import { countryCodes } from "../constants";
import type { AccountStepProps } from "../step-types";
import { fieldClass } from "../utils";
import { AccountBasicsStep } from "./AccountBasicsStep";

export function InstitutionProfileStep(props: AccountStepProps) {
  const { errors, form, updateField } = props.controller;

  return (
    <AccountBasicsStep {...props}>
      <div className="space-y-6 rounded-xl border border-border bg-chalk p-4 sm:p-5">
        <div>
          <h3 className="font-serif text-2xl leading-tight">Institution profile</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            These fields create the school or MAT profile in the backend before review.
          </p>
        </div>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="School or MAT name" htmlFor="school-name" error={errors.schoolName} required>
            <input
              id="school-name"
              className={fieldClass(errors.schoolName)}
              value={form.schoolName}
              onChange={(event) => updateField("schoolName", event.target.value)}
              placeholder="Greenfield Primary School"
            />
          </Field>
          <Field label="School / trust domain" htmlFor="institution-domain" error={errors.institutionDomain} required>
            <input
              id="institution-domain"
              className={fieldClass(errors.institutionDomain)}
              value={form.institutionDomain}
              onChange={(event) => updateField("institutionDomain", event.target.value.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase())}
              placeholder="greenfield.ac.uk"
            />
          </Field>
          <Field label="Address" htmlFor="institution-address" error={errors.institutionAddress} required>
            <input
              id="institution-address"
              className={fieldClass(errors.institutionAddress)}
              value={form.institutionAddress}
              onChange={(event) => updateField("institutionAddress", event.target.value)}
              placeholder="1 School Lane"
            />
          </Field>
          <Field label="City" htmlFor="institution-city" error={errors.institutionCity} required>
            <input
              id="institution-city"
              className={fieldClass(errors.institutionCity)}
              value={form.institutionCity}
              onChange={(event) => updateField("institutionCity", event.target.value)}
              placeholder="Manchester"
            />
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
        </div>
      </div>
    </AccountBasicsStep>
  );
}
