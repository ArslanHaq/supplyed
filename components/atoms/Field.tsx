import type { ReactNode } from "react";

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
  required,
}: {
  label?: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-4">
      {label ? (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.9px] text-[var(--slate)]" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-1 text-[var(--red)]">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="mt-1.5 text-xs font-medium text-[var(--red)]">{error}</div> : null}
      {!error && hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}
