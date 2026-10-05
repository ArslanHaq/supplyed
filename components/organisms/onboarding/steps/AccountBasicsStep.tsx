import type { ReactNode } from "react";

import { Field, Icon } from "../../../atoms";
import { PostcodeLookup } from "../../../molecules";
import { CountryCityFields } from "../CountryCityFields";
import type { AccountStepProps } from "../step-types";
import { fieldClass } from "../utils";

const accountRoleOptions = [
  ["institution", "School / MAT", "building", "Post roles, review ranked matches, and manage compliance."],
  ["teacher", "Supply teacher", "user", "Build your profile, find roles, and manage availability."],
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
            <div className="font-semibold text-brand-dark">Email verified</div>
            <div className="truncate text-sm text-brand-dark/75">{form.email || accountEmail || "Verified email"}</div>
          </div>
        </div>
      </div>

      {!roleSelected ? (
        <Field label="Choose account type" error={errors.accountRole} required>
          <div className="grid gap-3 lg:grid-cols-2">
            {accountRoleOptions.map(([value, title, icon, copy]) => {
              const selected = activeRole === value;

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
                    <Icon name={icon as "building" | "user" | "heart"} size={20} />
                  </div>
                  <div className="font-serif text-xl">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
                </button>
              );
            })}
          </div>
        </Field>
      ) : null}

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
        <Field label="Phone number" htmlFor="signup-phone" error={errors.phone} required
          hint="Use your country code. Numbers without a country code are treated as UK numbers.">
          <input
            autoComplete="tel"
            className={fieldClass(errors.phone)}
            disabled={Boolean(controller.pending)}
            id="signup-phone"
            inputMode="tel"
            maxLength={30}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+44 7700 900000"
            type="tel"
            value={form.phone}
          />
        </Field>
        {roleSelected && activeRole !== "institution" ? (
          <>
            <PostcodeLookup
              error={errors.postcode}
              id="signup-location"
              label="Postal code"
              onChange={(value) => updateField("postcode", value)}
              onSelect={(selection) => {
                updateField("postcode", selection.postcode);
                updateField("profileCountryCode", "GB");
                if (selection.city) updateField("profileCity", selection.city);
              }}
              placeholder="M1 1AE"
              required
              value={form.postcode}
            />
            <CountryCityFields
              city={form.profileCity}
              cityError={errors.profileCity}
              cityId="signup-city"
              cityRequired
              countryCode={form.profileCountryCode}
              countryError={errors.profileCountryCode}
              countryRequired
              onCityChange={(value) => updateField("profileCity", value)}
              onCountryChange={(value) => {
                updateField("profileCountryCode", value);
                updateField("profileCity", "");
              }}
            />
          </>
        ) : null}
      </div>

      {children}
    </div>
  );
}
