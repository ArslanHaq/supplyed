import type { ReactNode } from "react";

import { Field, Icon } from "../../../atoms";
import type { AccountStepProps } from "../step-types";
import { fieldClass } from "../utils";

const accountRoleOptions = [
  ["institution", "School / MAT", "building", "Post roles, review ranked matches, and manage compliance."],
  ["teacher", "Supply teacher", "user", "Build your profile, find roles, and manage availability."],
  ["individual", "Individual hirer", "heart", "Find verified teachers for yourself, your child, or another learner."],
] as const;

export function AccountBasicsStep({
  accountEmail,
  children,
  controller,
  roleSelected,
  setRole,
}: AccountStepProps & {
  children?: ReactNode;
}) {
  const { activeRole, clearFieldError, errors, form, updateField } = controller;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="checkCircle" size={19} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-brand-dark">Account verified</div>
            <div className="truncate text-sm text-brand-dark/75">{form.email || accountEmail || "Verified email"}</div>
          </div>
        </div>
      </div>

      <Field label="Choose account type" error={errors.accountRole} required>
        <div className="grid gap-3 lg:grid-cols-3">
          {accountRoleOptions.map(([value, title, icon, copy]) => {
            const selected = roleSelected && activeRole === value;

            return (
              <button
                key={value}
                aria-pressed={selected}
                className="rounded-xl border p-4 text-left transition hover:border-brand hover:bg-brand-tint sm:p-5"
                onClick={() => {
                  setRole(value);
                  clearFieldError("accountRole");
                }}
                style={{
                  background: selected ? "var(--se-tint)" : "#fff",
                  borderColor: selected ? "var(--se)" : "var(--border)",
                }}
                type="button"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand">
                  <Icon name={icon} size={20} />
                </div>
                <div className="font-serif text-xl">{title}</div>
                <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="signup-name" error={errors.fullName} required>
          <input
            id="signup-name"
            className={fieldClass(errors.fullName)}
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            placeholder="Your full name"
          />
        </Field>
        <Field label="Phone" htmlFor="signup-phone" error={errors.phone} required>
          <input
            id="signup-phone"
            className={fieldClass(errors.phone)}
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+44 7700 900000"
            inputMode="tel"
          />
        </Field>
        <Field label="Postalcode / location" htmlFor="signup-location" error={errors.postcode} required>
          <input
            id="signup-location"
            className={fieldClass(errors.postcode)}
            value={form.postcode}
            onChange={(event) => updateField("postcode", event.target.value)}
            placeholder="M1 1AE or Manchester"
          />
        </Field>
      </div>

      {children}
    </div>
  );
}
