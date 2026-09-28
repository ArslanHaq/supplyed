import { Icon } from "../atoms";
import { PageHead } from "../molecules";

export function AdminDashboard() {
  return (
    <div className="app-page">
      <PageHead title="Administrator account" subtitle="Your admin role was recognised from the backend session." />
      <div className="card card-pad-lg max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
            <Icon name="shield" size={20} />
          </div>
          <div>
            <h2 className="font-serif text-2xl">Open the SupplyED admin panel</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Administrative moderation and account management live in the dedicated admin panel. This marketplace app will not send an admin account through teacher or school onboarding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
