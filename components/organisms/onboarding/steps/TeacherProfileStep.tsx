import { Field } from "../../../atoms";
import { MultiSelectDropdown, SelectDropdown } from "../../../molecules/OptionDropdowns";
import { currencies, keyStages, subjects, teacherSkills } from "../constants";
import type { AccountStepProps } from "../step-types";
import { areaClass, fieldClass } from "../utils";
import { AccountBasicsStep } from "./AccountBasicsStep";

export function TeacherProfileStep(props: AccountStepProps) {
  const { errors, form, updateField } = props.controller;

  return (
    <AccountBasicsStep {...props}>
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
            <input
              id="experience"
              className={fieldClass(errors.yearsExperience)}
              value={form.yearsExperience}
              onChange={(event) => updateField("yearsExperience", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="5"
              inputMode="numeric"
            />
          </Field>
          <Field label="Daily rate" htmlFor="daily-rate" error={errors.dailyRate} hint="Optional">
            <input
              id="daily-rate"
              className={fieldClass(errors.dailyRate)}
              value={form.dailyRate}
              onChange={(event) => updateField("dailyRate", event.target.value.replace(/[^\d.]/g, ""))}
              placeholder="180"
              inputMode="decimal"
            />
          </Field>
          <Field label="Hourly rate" htmlFor="hourly-rate" error={errors.hourlyRate} hint="Optional">
            <input
              id="hourly-rate"
              className={fieldClass(errors.hourlyRate)}
              value={form.hourlyRate}
              onChange={(event) => updateField("hourlyRate", event.target.value.replace(/[^\d.]/g, ""))}
              placeholder="35"
              inputMode="decimal"
            />
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
            <input
              id="travel-distance"
              className={fieldClass(errors.maxTravelDistance)}
              value={form.maxTravelDistance}
              onChange={(event) => updateField("maxTravelDistance", event.target.value.replace(/[^\d.]/g, ""))}
              placeholder="25"
              inputMode="decimal"
            />
          </Field>
          <Field label="Teaching reference number" htmlFor="trn" hint="Optional for now.">
            <input
              id="trn"
              className="input"
              value={form.teachingReferenceNumber}
              onChange={(event) => updateField("teachingReferenceNumber", event.target.value)}
              placeholder="TRN number"
            />
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
    </AccountBasicsStep>
  );
}
