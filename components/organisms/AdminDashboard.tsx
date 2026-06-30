import { Btn, Stat } from "../atoms";
import { PageHead } from "../molecules";

export function AdminDashboard() {
  return (
    <div className="app-page">
      <PageHead title="Admin console" subtitle="Compliance, reviews, and marketplace quality at a glance." actions={<><Btn variant="secondary">Export report</Btn><Btn>Review queue</Btn></>} />
      <div className="grid-4 mb-7">
        <Stat value="142" label="Pending reviews" delta="18 urgent" />
        <Stat value="8,412" label="Active teachers" delta="+96 this week" />
        <Stat value="2,138" label="Partner schools" delta="+12 this week" />
        <Stat value="94%" label="Roles filled within 2h" delta="Healthy" />
      </div>
      <div className="two-col">
        <div className="card card-pad-lg"><div className="section-title">Compliance queue</div>{[["Sarah Johnson", "Right to Work review"], ["Amina Hassan", "QTS verification"], ["Northfield Academy", "School onboarding"]].map(([name, task]) => <div key={name} className="flex items-center justify-between border-b border-border py-3"><div><div className="font-medium">{name}</div><div className="text-xs text-muted">{task}</div></div><Btn size="sm">Open</Btn></div>)}</div>
        <div className="card card-pad-lg"><div className="section-title">Trust metrics</div>{[["DBS verified", "99.2%"], ["Teacher response within 10m", "81%"], ["Disputes this month", "0.7%"], ["Average rating", "4.9"]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-border py-2.5"><span>{label}</span><span className="font-semibold">{value}</span></div>)}</div>
      </div>
    </div>
  );
}
