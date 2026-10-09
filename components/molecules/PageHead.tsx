import type { ReactNode } from "react";

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="min-w-0">
        <h1 className="page-head-title">{title}</h1>
        {subtitle ? <p className="page-head-description">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  );
}
