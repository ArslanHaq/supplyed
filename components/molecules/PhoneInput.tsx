"use client";

import { useState, type ClipboardEvent, type DragEvent, type FocusEvent, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import PhoneNumberInput from "react-phone-number-input/input-core";
import metadata from "libphonenumber-js/metadata.max.json";
import type { Value } from "react-phone-number-input";
import { ukPhoneEdit, ukPhonePaste } from "@/lib/uk-phone-input";
import { validateUkPhone } from "@/lib/uk-validation";
import { Field } from "../atoms";

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue"> & {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  action?: ReactNode;
};

/** UK-only entry, with a fixed calling code and library-managed formatting. */
export function PhoneInput({ value, onChange, error, label = "Phone number", action, required, id, onBlur, ...props }: PhoneInputProps) {
  const [touched, setTouched] = useState(false);
  const [rejectedInput, setRejectedInput] = useState(false);
  const validation = validateUkPhone(value, { required });
  const editableValue = ukPhoneEdit(value);
  const shownError = rejectedInput ? "Only UK phone numbers are accepted. Use a UK mobile or landline." : error || ((touched || (value && editableValue === false)) ? validation.error : undefined);
  function acceptInput() { setTouched(true); setRejectedInput(false); }
  function pasteNumber(raw: string) {
    const phone = ukPhonePaste(raw);
    if (phone === false) { setRejectedInput(true); return; }
    acceptInput();
    onChange(phone);
  }
  const input = (
      <PhoneNumberInput {...props} id={id} type="tel" autoComplete="tel" inputMode="tel"
        country="GB" international withCountryCallingCode metadata={metadata}
        className={`input ${shownError ? "border-danger" : ""}`} required={required}
        placeholder="+44 7400 123456" value={(editableValue || undefined) as Value | undefined} aria-invalid={Boolean(shownError)}
        onChange={(phone) => { acceptInput(); onChange(phone ?? ""); }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          const input = event.currentTarget;
          if ((event.key === "Backspace" || event.key === "Delete") && (input.selectionStart ?? 0) <= 3 && (input.selectionEnd ?? 0) <= 3) event.preventDefault();
          props.onKeyDown?.(event);
        }}
        onBeforeInput={(event: FormEvent<HTMLInputElement>) => {
          const data = (event.nativeEvent as InputEvent).data;
          if (!data) return;
          const input = event.currentTarget;
          const proposed = input.value.slice(0, input.selectionStart ?? 0) + data + input.value.slice(input.selectionEnd ?? 0);
          if (ukPhoneEdit(proposed) === false) { event.preventDefault(); setRejectedInput(true); }
        }}
        onPaste={(event: ClipboardEvent<HTMLInputElement>) => { event.preventDefault(); pasteNumber(event.clipboardData.getData("text")); }}
        onDrop={(event: DragEvent<HTMLInputElement>) => { event.preventDefault(); pasteNumber(event.dataTransfer.getData("text")); }}
        onBlur={(event: FocusEvent<HTMLInputElement>) => { setTouched(true); onBlur?.(event); }} />
  );
  return (
    <Field label={label} htmlFor={id} required={required} error={shownError} hint="United Kingdom only. +44 is fixed. Enter the number without its first 0, or paste a full UK number.">
      {action ? <div className="phone-input-controls">{input}<div className="phone-input-action">{action}</div></div> : input}
    </Field>
  );
}
