import type { InputHTMLAttributes, ReactNode } from "react";

import { Icon } from "./Icon";

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label: ReactNode;
}) {
  // A native label lets the text hold links: clicking a link inside a label
  // follows the link without toggling the box.
  return (
    <label className={`flex min-h-9 items-center gap-2 text-left text-sm text-slate ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className ?? ""}`}>
      <input
        {...props}
        checked={checked}
        disabled={disabled}
        id={id}
        className="peer sr-only"
        onChange={(event) => onChange?.(event.target.checked)}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-(--radius-check) border border-border-strong bg-surface text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-1 peer-checked:border-brand-dark peer-checked:bg-brand-dark peer-checked:[&>svg]:visible peer-aria-invalid:border-danger"
        data-checked={checked}
      >
        <Icon name="check" size={11} className="invisible" />
      </span>
      <span>{label}</span>
    </label>
  );
}
