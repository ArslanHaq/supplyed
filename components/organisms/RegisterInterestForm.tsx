"use client";

import { useActionState, useEffect, useRef } from "react";

import { registerInterestAction } from "@/features/contact/actions";
import type { RegisterInterestActionState } from "@/features/contact/actions";

import { Button, Field, Icon } from "../atoms";

const initialState: RegisterInterestActionState = null;

export function RegisterInterestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(registerInterestAction, initialState);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="rounded-xl border border-border bg-white p-5 text-left shadow-(--shadow-xs) sm:p-7" noValidate>
        <div className="mb-5">
          <h3 className="font-serif text-2xl leading-tight">Register your school&apos;s interest</h3>
          <p className="mt-2 text-sm leading-6 text-muted">Two minutes. No commitment. We&apos;ll be in touch before launch.</p>
        </div>

        <Field label="School / Trust name" htmlFor="interest-school" error={errors?.schoolName} required>
          <input
            aria-invalid={Boolean(errors?.schoolName)}
            autoComplete="organization"
            className="input"
            id="interest-school"
            name="schoolName"
            placeholder="e.g. Greenfield Primary School"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="interest-name" error={errors?.contactName} required>
            <input
              aria-invalid={Boolean(errors?.contactName)}
              autoComplete="name"
              className="input"
              id="interest-name"
              name="contactName"
              placeholder="Jane Smith"
              required
            />
          </Field>

          <Field label="Role" htmlFor="interest-role" error={errors?.role} required>
            <div className="relative">
              <select
                aria-invalid={Boolean(errors?.role)}
                className="select appearance-none bg-white pr-10 transition hover:border-brand/50 hover:bg-chalk/40"
                defaultValue="Head Teacher"
                id="interest-role"
                name="role"
                required
              >
                <option>Head Teacher</option>
                <option>Deputy Head</option>
                <option>Cover Manager</option>
                <option>HR Lead</option>
                <option>MAT / Trust Lead</option>
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-chalk text-muted"
              >
                <Icon name="chevronDown" size={15} />
              </span>
            </div>
          </Field>
        </div>

        <Field label="Work email" htmlFor="interest-email" error={errors?.email} required>
          <input
            aria-invalid={Boolean(errors?.email)}
            autoComplete="email"
            className="input"
            id="interest-email"
            inputMode="email"
            name="email"
            placeholder="name@school.org.uk"
            required
            type="email"
          />
        </Field>

        <Button className="w-full text-white!" loading={pending} loadingLabel="Sending details" size="lg" type="submit">
          Register interest -&gt;
        </Button>

        {state?.message ? (
          <div
            className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${
              state.ok
                ? "border-success/20 bg-success-tint text-success"
                : "border-danger/20 bg-danger-tint text-danger"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs leading-5 text-muted">
          We only use this to contact you about SupplyED and founding-school onboarding.
        </p>
    </form>
  );
}
