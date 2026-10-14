import type { ReactNode } from "react";

import { Icon } from "./Icon";

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: ReactNode;
}) {
  // A native label lets the text hold links: clicking a link inside a label
  // follows the link without toggling the box.
  return (
    <label className="flex cursor-pointer items-center gap-2 text-left text-sm text-slate">
      <input
        checked={checked}
        className="peer sr-only"
        onChange={(event) => onChange?.(event.target.checked)}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong bg-white text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-1 data-[checked=true]:border-brand data-[checked=true]:bg-brand"
        data-checked={checked}
      >
        {checked ? <Icon name="check" size={11} /> : null}
      </span>
      <span>{label}</span>
    </label>
  );
}
