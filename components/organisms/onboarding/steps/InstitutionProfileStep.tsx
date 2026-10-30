import { Field } from "../../../atoms";
import { PostcodeLookup } from "../../../molecules/PostcodeLookup";
import { CountryCityFields } from "../CountryCityFields";
import type { AccountStepProps } from "../step-types";
import { fieldClass } from "../utils";
import { AccountBasicsStep } from "./AccountBasicsStep";

export function InstitutionProfileStep(props: AccountStepProps) {
  const { errors, form, updateField } = props.controller;

  return (
    <AccountBasicsStep {...props}>
      <div className="onboarding-field-section space-y-6">
        <div>
          <h3 className="font-heading text-2xl leading-tight">Institution profile</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Add your school or trust details so we can review your profile.
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
          <PostcodeLookup id="institution-postcode" error={errors.postcode} required value={form.postcode}
            onChange={(value) => updateField("postcode", value)} onSelect={(selection) => {
              updateField("postcode", selection.postcode);
              updateField("institutionCountryCode", selection.countryCode);
              updateField("institutionCity", selection.city);
              updateField("localAuthority", selection.county);
            }} />
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
        </div>
      </div>
    </AccountBasicsStep>
  );
}
