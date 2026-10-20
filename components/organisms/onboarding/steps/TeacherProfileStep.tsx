import { DynamicMultiSelect, DynamicSelect } from "@/components/molecules/DynamicDropdown";

import { TeachingSelectionFields } from "@/components/molecules/TeachingSelectionFields";
import { Field } from "../../../atoms";
import type { AccountStepProps } from "../step-types";
import { areaClass, fieldClass } from "../utils";
import { AccountBasicsStep } from "./AccountBasicsStep";

export function TeacherProfileStep(props: AccountStepProps) {
  const { errors, form, updateField } = props.controller;

  return (
    <AccountBasicsStep {...props}>
      <div className="onboarding-field-section space-y-6">
        <div>
          <h3 className="font-heading text-2xl leading-tight">Teaching profile</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Tell schools about your teaching experience, subjects and availability.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <TeachingSelectionFields otherSkills={form.otherSkills} otherSkillError={errors.otherSkills} otherSubjects={form.otherSubjects} otherError={errors.otherSubjects} subjects={form.subjects} skills={form.skills} subjectError={errors.subjects} skillError={errors.skills} onChange={(subjects, skills, otherSubjects, otherSkills) => { updateField("subjects", subjects); updateField("skills", skills); updateField("otherSkills", otherSkills); updateField("otherSubjects", otherSubjects); }} />
          <Field label="Key stages" error={errors.keyStages} required>
            <DynamicMultiSelect
              error={Boolean(errors.keyStages)}
              collection="keyStage"
              placeholder="Select key stages"
              value={form.keyStages}
              onChange={(value) => updateField("keyStages", value)}
            />
          </Field>
        </div>



        <div className="grid gap-x-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="onboarding-field-heading"><h3>Experience and preferences</h3><p>Your experience, preferred rates and travel distance.</p></div>
          <Field label="Years of experience" htmlFor="experience" error={errors.yearsExperience} required>
            <input
              id="experience"
              className={fieldClass(errors.yearsExperience)}
              value={form.yearsExperience}
              onChange={(event) => updateField("yearsExperience", event.target.value)}
              placeholder="5"
              inputMode="numeric"
            />
          </Field>
          <Field label="Daily rate" htmlFor="daily-rate" error={errors.dailyRate} hint="Optional">
            <input
              id="daily-rate"
              className={fieldClass(errors.dailyRate)}
              value={form.dailyRate}
              onChange={(event) => updateField("dailyRate", event.target.value)}
              placeholder="180"
              inputMode="decimal"
            />
          </Field>
          <Field label="Hourly rate" htmlFor="hourly-rate" error={errors.hourlyRate} hint="Optional">
            <input
              id="hourly-rate"
              className={fieldClass(errors.hourlyRate)}
              value={form.hourlyRate}
              onChange={(event) => updateField("hourlyRate", event.target.value)}
              placeholder="35"
              inputMode="decimal"
            />
          </Field>
          <Field label="Currency" error={errors.currency}>
            <DynamicSelect
              error={Boolean(errors.currency)}
              collection="currency"
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
              onChange={(event) => updateField("maxTravelDistance", event.target.value)}
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
