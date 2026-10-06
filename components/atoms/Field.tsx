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
    <div className="mb-5 min-w-0">
      {label ? (
        <label className="mb-2 block text-[13px] font-semibold leading-5 text-graphite" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="mt-2 text-xs font-medium leading-5 text-danger">{error}</div> : null}
      {!error && hint ? <div className="mt-2 text-xs leading-5 text-muted">{hint}</div> : null}
    </div>
  );
}
