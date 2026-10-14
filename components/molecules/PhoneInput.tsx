"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { validateUkPhone } from "@/lib/uk-validation";
import { Field } from "../atoms";

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  action?: ReactNode;
};

/** Accept UK national or +44 format; validity does not prove phone ownership. */
export function PhoneInput({ value, onChange, error, label = "Phone number", action, required, id, onBlur, ...props }: PhoneInputProps) {
  const [touched, setTouched] = useState(false);
  const validation = validateUkPhone(value, { required });
  const shownError = error || (touched ? validation.error : undefined);
  const input = (
      <input {...props} id={id} type="tel" autoComplete="tel" inputMode="tel" maxLength={40}
        className={`input ${shownError ? "border-danger" : ""}`} required={required}
        placeholder="07400 123456" value={value} aria-invalid={Boolean(shownError)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => { setTouched(true); if (validation.valid && value) onChange(validation.value); onBlur?.(event); }} />
  );
  return (
    <Field label={label} htmlFor={id} required={required} error={shownError} hint="United Kingdom (+44) only. Enter a UK mobile or landline, with 0 or +44 at the start.">
      {action ? <div className="phone-input-controls">{input}<div className="phone-input-action">{action}</div></div> : input}
    </Field>
  );
}
