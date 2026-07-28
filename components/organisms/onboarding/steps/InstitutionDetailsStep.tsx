import { Field } from "../../../atoms";
import { MultiSelectDropdown, SelectDropdown } from "../../../molecules/OptionDropdowns";
import { countryCodes, coverTypes } from "../constants";
import type { StepComponentProps } from "../step-types";
import { fieldClass } from "../utils";

export function InstitutionDetailsStep({ controller }: StepComponentProps) {
  const { errors, form, updateField } = controller;

  return (
    <div className="space-y-6">
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
        <Field label="Your role" htmlFor="contact-role" error={errors.contactRole} required>
          <input
            id="contact-role"
            className={fieldClass(errors.contactRole)}
            value={form.contactRole}
            onChange={(event) => updateField("contactRole", event.target.value)}
            placeholder="Headteacher, HR lead, cover manager"
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
        <Field label="Registration ID" htmlFor="institution-registration-id" hint="Optional">
          <input
            id="institution-registration-id"
            className="input"
            value={form.institutionRegistrationId}
            onChange={(event) => updateField("institutionRegistrationId", event.target.value)}
            placeholder="URN, company number, or trust ID"
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
        <Field label="County / region" htmlFor="authority" error={errors.localAuthority} required>
          <input
            id="authority"
            className={fieldClass(errors.localAuthority)}
            value={form.localAuthority}
            onChange={(event) => updateField("localAuthority", event.target.value)}
            placeholder="Greater Manchester"
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
        <Field label="Typical pupil count" htmlFor="pupils" hint="Optional, helps estimate staffing needs.">
          <input
            id="pupils"
            className="input"
            value={form.yearsExperience}
            onChange={(event) => updateField("yearsExperience", event.target.value.replace(/\D/g, ""))}
            placeholder="420"
            inputMode="numeric"
          />
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
  );
}
