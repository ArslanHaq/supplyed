import { Field } from "../../../atoms";
import { MultiSelectDropdown, SelectDropdown } from "../../../molecules/OptionDropdowns";
import { budgetRanges, keyStages, learningModes, preferredSchedules, subjects, supportForOptions } from "../constants";
import type { StepComponentProps } from "../step-types";

export function IndividualLearnerNeedsStep({ controller }: StepComponentProps) {
  const { errors, form, updateField } = controller;

  return (
    <div className="space-y-6">
      <Field label="Who needs support?" error={errors.individualRelationship} required>
        <SelectDropdown
          error={Boolean(errors.individualRelationship)}
          options={supportForOptions}
          placeholder="Select who needs support"
          value={form.individualRelationship}
          onChange={(value) => updateField("individualRelationship", value)}
        />
      </Field>

      <div className="grid gap-6 xl:grid-cols-2">
        <Field label="Subject needed" error={errors.subjects} required>
          <MultiSelectDropdown
            error={Boolean(errors.subjects)}
            options={subjects}
            placeholder="Select subject needs"
            value={form.subjects}
            onChange={(value) => updateField("subjects", value)}
          />
        </Field>
        <Field label="Learner stage" error={errors.keyStages} required>
          <SelectDropdown
            error={Boolean(errors.keyStages)}
            options={keyStages}
            placeholder="Select learner stage"
            value={form.keyStages[0] || ""}
            onChange={(value) => updateField("keyStages", value ? [value] : [])}
          />
        </Field>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Field label="Format" error={errors.learningMode} required>
          <SelectDropdown
            error={Boolean(errors.learningMode)}
            options={learningModes}
            placeholder="Select format"
            value={form.learningMode}
            onChange={(value) => updateField("learningMode", value)}
          />
        </Field>
        <Field label="Preferred schedule" error={errors.preferredSchedule} required>
          <SelectDropdown
            error={Boolean(errors.preferredSchedule)}
            options={preferredSchedules}
            placeholder="Select schedule"
            value={form.preferredSchedule}
            onChange={(value) => updateField("preferredSchedule", value)}
          />
        </Field>
        <Field label="Budget range" error={errors.budgetRange} required>
          <SelectDropdown
            error={Boolean(errors.budgetRange)}
            options={budgetRanges}
            placeholder="Select budget range"
            value={form.budgetRange}
            onChange={(value) => updateField("budgetRange", value)}
          />
        </Field>
      </div>

      <Field label="Learner notes" htmlFor="learner-notes" hint="Optional. Avoid sharing full child identity at signup.">
        <textarea
          id="learner-notes"
          className="textarea min-h-[116px]"
          value={form.learnerNotes}
          onChange={(event) => updateField("learnerNotes", event.target.value)}
          placeholder="Example: Year 5 learner needs confidence with fractions. Prefer calm, structured sessions after school."
        />
      </Field>
    </div>
  );
}
