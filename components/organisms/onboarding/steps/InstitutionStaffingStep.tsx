import { Field, Icon } from "../../../atoms";
import type { StepComponentProps } from "../step-types";
import { areaClass, fieldClass } from "../utils";

export function InstitutionStaffingStep({ controller }: StepComponentProps) {
  const { errors, form, updateField } = controller;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="building" size={19} />
          </div>
          <div>
            <div className="font-semibold text-brand-dark">School workspace details</div>
            <p className="mt-1 text-sm leading-6 text-brand-dark/80">
              These details update the institution profile and help the team review your workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Your role" htmlFor="contact-role" error={errors.contactRole} required>
          <input
            id="contact-role"
            className={fieldClass(errors.contactRole)}
            value={form.contactRole}
            onChange={(event) => updateField("contactRole", event.target.value)}
            placeholder="Headteacher, HR lead, cover manager"
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
        <Field label="County / region" htmlFor="authority" hint="Optional">
          <input
            id="authority"
            className="input"
            value={form.localAuthority}
            onChange={(event) => updateField("localAuthority", event.target.value)}
            placeholder="Greater Manchester"
          />
        </Field>
      </div>

      <Field
        label="Staffing needs"
        htmlFor="staffing-needs"
        error={errors.staffingNeeds}
        hint="Maximum 1000 characters."
        required
      >
        <textarea
          id="staffing-needs"
          className={areaClass(errors.staffingNeeds)}
          value={form.staffingNeeds}
          onChange={(event) => updateField("staffingNeeds", event.target.value)}
          placeholder="Example: Same-day cover for primary classes, long-term maths supply, intervention support, and occasional SEN cover."
        />
      </Field>
    </div>
  );
}
