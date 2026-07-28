import { Checkbox, Field, Icon } from "../../../atoms";
import type { StepComponentProps } from "../step-types";
import { fieldClass } from "../utils";

export function InstitutionComplianceStep({ controller }: StepComponentProps) {
  const { errors, form, updateField } = controller;

  return (
    <div className="space-y-6">
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Compliance lead" htmlFor="compliance-contact" error={errors.complianceContact} required>
          <input
            id="compliance-contact"
            className={fieldClass(errors.complianceContact)}
            value={form.complianceContact}
            onChange={(event) => updateField("complianceContact", event.target.value)}
            placeholder="Name of safeguarding lead"
          />
        </Field>
        <Field label="Compliance email" htmlFor="compliance-email" error={errors.complianceEmail} required>
          <input
            id="compliance-email"
            className={fieldClass(errors.complianceEmail)}
            value={form.complianceEmail}
            onChange={(event) => updateField("complianceEmail", event.target.value)}
            placeholder="safeguarding@school.org.uk"
            type="email"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-chalk p-5">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="shield" size={19} />
          </div>
          <div>
            <div className="font-semibold">Safeguarding responsibility</div>
            <p className="mt-1 text-sm leading-6 text-muted">
              SupplyED can verify teacher documents, but schools remain responsible for local safeguarding and booking approvals.
            </p>
          </div>
        </div>
        <Field error={errors.safeguardingConfirmed}>
          <Checkbox
            checked={form.safeguardingConfirmed}
            onChange={(value) => updateField("safeguardingConfirmed", value)}
            label="I confirm this workspace will be managed by authorised school staff."
          />
        </Field>
      </div>
    </div>
  );
}
