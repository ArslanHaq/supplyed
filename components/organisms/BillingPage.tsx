import { Btn, Tag } from "../atoms";
import { PageHead } from "../molecules";

export function BillingPage() {
  return (
    <div className="app-page">
      <PageHead title="Billing & plan" subtitle="Manage subscription, invoices, and account spend." actions={<Btn variant="secondary" icon="download">Export invoices</Btn>} />
      <div className="two-col">
        <div className="card card-pad-lg">
          <Tag>Pro plan</Tag>
          <div className="mt-3 font-serif text-4xl">£99 / month</div>
          <div className="text-muted">Unlimited job posts, compliance tools, messaging, and AI matching.</div>
          <div className="progress mt-[18px]"><div className="progress-fill" style={{ width: "58%" }} /></div>
          <div className="mt-[18px] flex flex-wrap gap-2"><Btn>Update payment method</Btn><Btn variant="secondary">Change plan</Btn></div>
        </div>
        <div className="card card-pad-lg">
          <div className="section-title">Recent invoices</div>
          {[["INV-2041", "Mar 2026", "£99"], ["INV-1978", "Feb 2026", "£99"], ["INV-1922", "Jan 2026", "£99"]].map(([id, month, amount]) => (
            <div key={id} className="flex items-center justify-between border-b border-border py-3"><div><div className="font-medium">{id}</div><div className="text-xs text-muted">{month}</div></div><div className="flex items-center gap-2"><span>{amount}</span><Btn variant="ghost" size="sm" icon="download">PDF</Btn></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
