import { Field } from "../../../atoms";
import { CountryCityFields } from "../CountryCityFields";
import { PostcodeLookup } from "../../../molecules";
import { MultiSelectDropdown } from "../../../molecules/OptionDropdowns";
import { coverTypes } from "../constants";
import type { StepComponentProps } from "../step-types";
import { fieldClass } from "../utils";

export function InstitutionDetailsStep({ controller }: StepComponentProps) {
  const { errors, form, updateField } = controller;

  return (
    <div className="space-y-6">
      <Field label="School type" htmlFor="institution-type" error={errors.institutionType} required>
        <select
          id="institution-type"
          className={fieldClass(errors.institutionType)}
          value={form.institutionType}
          onChange={(event) => {
            const value = event.target.value === "MAT_SCHOOL" ? "MAT_SCHOOL" : "SINGLE_SCHOOL";
            updateField("institutionType", value);
            if (value === "SINGLE_SCHOOL") {
              updateField("trustName", "");
              updateField("trustCompanyNumber", "");
              updateField("signatoryName", "");
              updateField("signatoryEmail", "");
              updateField("signatoryJobTitle", "");
            }
          }}
        >
          <option value="SINGLE_SCHOOL">Single school</option>
          <option value="MAT_SCHOOL">Part of a multi-academy trust</option>
        </select>
      </Field>

      {form.institutionType === "MAT_SCHOOL" ? (
        <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
          <div className="mb-4 font-semibold text-brand-dark">Multi-academy trust details</div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Trust name" htmlFor="trust-name" error={errors.trustName} required>
              <input
                id="trust-name"
                className={fieldClass(errors.trustName)}
                maxLength={200}
                value={form.trustName}
                onChange={(event) => updateField("trustName", event.target.value)}
                placeholder="Oak Learning Trust"
              />
            </Field>
            <Field label="Companies House number" htmlFor="trust-company-number" error={errors.trustCompanyNumber} hint="Optional, but recommended so schools join the correct trust.">
              <input
                id="trust-company-number"
                className={fieldClass(errors.trustCompanyNumber)}
                maxLength={16}
                value={form.trustCompanyNumber}
                onChange={(event) => updateField("trustCompanyNumber", event.target.value.toUpperCase())}
                placeholder="08123456"
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <div className="onboarding-field-heading"><h3>About your school</h3><p>Your organisation and location details.</p></div>
        <Field label="School name" htmlFor="school-name" error={errors.schoolName} required>
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
        <Field label="School domain" htmlFor="institution-domain" error={errors.institutionDomain} required>
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
        <PostcodeLookup
          error={errors.postcode}
          hint="Fills in the town from the postcode."
          id="institution-postcode"
          label="School postal code"
          onChange={(value) => updateField("postcode", value)}
          onSelect={(selection) => {
            updateField("postcode", selection.postcode);
            updateField("institutionCountryCode", "GB");
            if (selection.city) updateField("institutionCity", selection.city);
          }}
          placeholder="M1 1AE"
          required
          value={form.postcode}
        />
        <Field label="Address" htmlFor="institution-address" error={errors.institutionAddress} required>
          <input
            id="institution-address"
            className={fieldClass(errors.institutionAddress)}
            value={form.institutionAddress}
            onChange={(event) => updateField("institutionAddress", event.target.value)}
            placeholder="1 School Lane"
          />
        </Field>
        <CountryCityFields
          city={form.institutionCity}
          cityError={errors.institutionCity}
          cityId="institution-city"
          cityRequired
          countryCode={form.institutionCountryCode}
          countryError={errors.institutionCountryCode}
          countryRequired
          onCityChange={(value) => updateField("institutionCity", value)}
          onCountryChange={(value) => {
            updateField("institutionCountryCode", value);
            updateField("institutionCity", "");
          }}
        />
        <Field label="Typical pupil count" htmlFor="pupils" hint="Optional, helps estimate staffing needs.">
          <input
            id="pupils"
            className="input"
            value={form.typicalPupilCount}
            onChange={(event) => updateField("typicalPupilCount", event.target.value.replace(/\D/g, ""))}
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
