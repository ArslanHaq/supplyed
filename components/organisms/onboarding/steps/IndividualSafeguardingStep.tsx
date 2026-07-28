import { Checkbox, Field, Icon } from "../../../atoms";
import type { StepComponentProps } from "../step-types";

export function IndividualSafeguardingStep({ controller }: StepComponentProps) {
  const { errors, form, updateField } = controller;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-chalk p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="shield" size={20} />
          </div>
          <div className="font-semibold">Verified teacher access</div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Hirers see verification badges, while documents stay private for verification review and safeguarding checks.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-chalk p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="message" size={20} />
          </div>
          <div className="font-semibold">Account-led communication</div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Requests, messages, bookings, and location details should stay under the adult account.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="space-y-4">
          <Field error={errors.individualConsent}>
            <Checkbox
              checked={form.individualConsent}
              onChange={(value) => updateField("individualConsent", value)}
              label="I confirm I am authorised to arrange this learning support."
            />
          </Field>
          <Field error={errors.safeguardingConfirmed}>
            <Checkbox
              checked={form.safeguardingConfirmed}
              onChange={(value) => updateField("safeguardingConfirmed", value)}
              label="I understand direct contact, messaging, and bookings should remain inside SupplyED."
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
