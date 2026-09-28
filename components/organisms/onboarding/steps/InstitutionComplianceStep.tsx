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

      {form.institutionType === "MAT_SCHOOL" ? (
        <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
          <div className="mb-2 font-semibold text-brand-dark">Trust signatory approval</div>
          <p className="mb-4 text-sm leading-6 text-brand-dark/80">
            We will email an authorised trust representative. The school can be submitted for review after they approve it.
          </p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Signatory name" htmlFor="signatory-name" error={errors.signatoryName} required>
              <input
                id="signatory-name"
                className={fieldClass(errors.signatoryName)}
                maxLength={200}
                value={form.signatoryName}
                onChange={(event) => updateField("signatoryName", event.target.value)}
                placeholder="Jane Smith"
              />
            </Field>
            <Field label="Signatory email" htmlFor="signatory-email" error={errors.signatoryEmail} required>
              <input
                id="signatory-email"
                className={fieldClass(errors.signatoryEmail)}
                maxLength={254}
                value={form.signatoryEmail}
                onChange={(event) => updateField("signatoryEmail", event.target.value)}
                placeholder="jane.smith@trust.org.uk"
                type="email"
              />
            </Field>
            <Field label="Signatory job title" htmlFor="signatory-job-title" error={errors.signatoryJobTitle} required>
              <input
                id="signatory-job-title"
                className={fieldClass(errors.signatoryJobTitle)}
                maxLength={150}
                value={form.signatoryJobTitle}
                onChange={(event) => updateField("signatoryJobTitle", event.target.value)}
                placeholder="Chief Financial Officer"
              />
            </Field>
          </div>
        </div>
      ) : null}

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
