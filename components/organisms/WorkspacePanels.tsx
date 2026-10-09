import type { ReactNode } from "react";

import { Icon } from "../atoms";

/** A consistent focal point for workspace guidance and the next useful action. */
export function WorkspaceCallout({ action, children, eyebrow, icon, title }: {
  action?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  icon: string;
  title: string;
}) {
  return (
    <section className="workspace-callout">
      <span aria-hidden="true" className="workspace-callout-icon"><Icon name={icon} size={24} /></span>
      <div className="workspace-callout-copy">
        <p className="workspace-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <div className="workspace-callout-description">{children}</div>
      </div>
      {action ? <div className="workspace-callout-action">{action}</div> : null}
    </section>
  );
}

export function WorkspaceEmptyState({ action, icon = "file", message, title }: {
  action?: ReactNode;
  icon?: string;
  message: string;
  title: string;
}) {
  return (
    <div className="workspace-empty card" role="status">
      <span aria-hidden="true" className="workspace-empty-icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action ? <div className="workspace-empty-action">{action}</div> : null}
    </div>
  );
}

/** Counts always come from the data already shown on the current screen. */
export function WorkspaceSummary({ items, label }: {
  items: Array<{ label: string; value: ReactNode }>;
  label: string;
}) {
  return (
    <section aria-label={label} className="workspace-summary">
      <p className="workspace-summary-heading">{label}</p>
      <dl>
        {items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl>
    </section>
  );
}
