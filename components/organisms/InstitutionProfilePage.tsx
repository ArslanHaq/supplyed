import { useInstitutionPublicProfile } from "@/features/public-profiles/use-public-profiles";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

export function InstitutionProfilePage({ ctx, go }: Pick<RouteProps, "ctx" | "go">) {
  const profileQuery = useInstitutionPublicProfile(ctx.institutionId);
  const profile = profileQuery.data;

  if (!ctx.institutionId) return <ProfileState title="Choose a school" message="Open a school from a booking or message to view its profile." onBack={() => go("bookings")} />;
  if (profileQuery.isLoading) return <div className="app-page"><SectionLoader rows={5} /></div>;
  if (!profile) return <ProfileState title="School profile unavailable" message={profileQuery.error?.message || "This profile may be inactive or you may not have permission to view it."} onBack={() => go("bookings")} onRetry={() => void profileQuery.refetch()} />;

  const location = [profile.address, profile.city, profile.county, profile.postalCode].filter(Boolean).join(", ");

  return (
    <div className="app-page">
      <PageHead title="School profile" subtitle="Public marketplace profile" actions={<Btn icon="arrowLeft" variant="secondary" onClick={() => go("bookings")}>Back to bookings</Btn>} />
      <div className="two-col">
        <div>
          <section className="card card-pad-lg mb-5"><div className="flex flex-wrap items-center gap-4"><Avatar name={profile.name} size="lg" src={profile.imageUrl} /><div className="min-w-[220px] flex-1"><div className="mb-1.5 flex flex-wrap items-center gap-2"><h1 className="font-heading text-[32px]">{profile.name}</h1>{profile.verified ? <Tag tone="green">Verified school</Tag> : null}</div><div className="flex items-center gap-1 text-sm text-muted"><Icon name="pin" size={13} />{location || "Location not shared"}</div></div></div></section>
          <section className="card card-pad-lg mb-5"><div className="section-title">Staffing needs</div><p className="leading-7 text-slate">{profile.staffingNeeds || "This school has not added public staffing details yet."}</p></section>
          <section className="card card-pad-lg"><div className="section-title">Cover types</div><div className="flex flex-wrap gap-2">{profile.coverTypes.length ? profile.coverTypes.map((type) => <Tag key={type} tone="ghost">{type}</Tag>) : <span className="text-sm text-muted">Not shared</span>}</div></section>
        </div>
        <aside className="sidebar-panel card-pad-lg self-start"><div className="section-title">School details</div><ProfileFact label="Type" value={profile.institutionType === "MAT_SCHOOL" ? "MAT school" : "Single school"} /><ProfileFact label="Trust" value={profile.trust?.name || "Independent"} /><ProfileFact label="Typical pupils" value={profile.typicalPupilCount == null ? "Not shared" : profile.typicalPupilCount.toLocaleString("en-GB")} /><ProfileFact label="Member since" value={profile.memberSince ? formatMonth(profile.memberSince) : "Not shared"} /></aside>
      </div>
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"><span className="text-sm text-muted">{label}</span><span className="text-right font-semibold">{value}</span></div>;
}

function ProfileState({ title, message, onBack, onRetry }: { title: string; message: string; onBack: () => void; onRetry?: () => void }) {
  return <div className="app-page"><div className="card card-pad-lg text-center" role="status"><h1 className="font-heading text-[26px]">{title}</h1><p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-muted">{message}</p><div className="mt-5 flex justify-center gap-2">{onRetry ? <Btn variant="secondary" onClick={onRetry}>Try again</Btn> : null}<Btn onClick={onBack}>Back</Btn></div></div></div>;
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}
