"use client";

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type ControlProps = {
  id?: string;
  children?: ReactNode;
  value?: unknown;
  type?: string;
  onChange?: unknown;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
};

function findControl(nodes: ReactNode, htmlFor?: string): ReactElement<ControlProps> | undefined {
  for (const child of Children.toArray(nodes)) {
    if (!isValidElement<ControlProps>(child)) continue;
    const props = child.props;
    const native = typeof child.type === "string" && ["input", "select", "textarea"].includes(child.type) && props.type !== "hidden";
    const custom = typeof child.type !== "string" && "value" in props && "onChange" in props;
    if ((native || custom) && (!htmlFor || !props.id || props.id === htmlFor)) return child;
    const nested = findControl(props.children, htmlFor);
    if (nested) return nested;
  }
}

function associateControl(nodes: ReactNode, target: ReactElement<ControlProps>, attributes: Partial<ControlProps>): ReactNode {
  return Children.map(nodes, (child) => {
    if (!isValidElement<ControlProps>(child)) return child;
    // Children.toArray assigns keys, so props identity identifies the original control.
    if (child.props === target.props) return cloneElement(child, attributes);
    return child.props.children ? cloneElement(child, { children: associateControl(child.props.children, target, attributes) }) : child;
  });
}

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
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const messageId = `${generatedId}-message`;
  const target = findControl(children, htmlFor);
  const controlId = target?.props.id || htmlFor || `${generatedId}-control`;
  // Link controls inside layout wrappers without changing validation rules.
  const controls = target ? associateControl(children, target, {
    id: controlId,
    "aria-labelledby": target.props["aria-labelledby"] || (label ? labelId : undefined),
    "aria-describedby": [target.props["aria-describedby"], error || hint ? messageId : undefined].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : target.props["aria-invalid"],
    "aria-required": required || target.props["aria-required"],
  }) : children;
  return (
    <div className="form-field mb-5 min-w-0" data-invalid={error ? true : undefined}>
      {label ? (
        <label id={labelId} className="field-label mb-2 block text-[13px] font-semibold leading-5 text-graphite" htmlFor={target || htmlFor ? controlId : undefined}>
          {label}
          {required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {controls}
      {error ? <div id={messageId} className="mt-2 text-xs font-medium leading-5 text-danger" role="alert">{error}</div> : null}
      {!error && hint ? <div id={messageId} className="mt-2 text-xs leading-5 text-muted">{hint}</div> : null}
    </div>
  );
}
