import type { InstructorPublicProfile } from "@/features/public-profiles/types";
import { useInstructorPublicProfile } from "@/features/public-profiles/use-public-profiles";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag, VerifyBadge } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

export function PublicTeacherProfilePage({ ctx, go }: Pick<RouteProps, "ctx" | "go">) {
  const profileQuery = useInstructorPublicProfile(ctx.teacherId);
  const profile = profileQuery.data;

  if (!ctx.teacherId) return <ProfileState title="Choose a teacher" message="Open a teacher from an application or booking to view their profile." onBack={() => go("applications")} />;
  if (profileQuery.isLoading) return <div className="app-page"><SectionLoader rows={5} /></div>;
  if (!profile) return <ProfileState title="Teacher profile unavailable" message={profileQuery.error?.message || "This profile may be inactive or you may not have permission to view it."} onBack={() => go("applications")} onRetry={() => void profileQuery.refetch()} />;

  const location = [profile.city, profile.county].filter(Boolean).join(", ") || "Location not shared";

  return (
    <div className="app-page">
      <PageHead title="Teacher profile" subtitle="Public marketplace profile" actions={<Btn icon="arrowLeft" variant="secondary" onClick={() => go("applications")}>Back to applications</Btn>} />
      <div className="two-col">
        <div>
          <section className="card card-pad-lg mb-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={profile.fullName} size="lg" src={profile.imageUrl} />
              <div className="min-w-[220px] flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2"><h1 className="font-heading text-[32px]">{profile.fullName}</h1>{profile.dbsVerified ? <VerifyBadge /> : null}</div>
                <div className="flex flex-wrap gap-4 text-sm text-muted"><span className="flex items-center gap-1"><Icon name="pin" size={13} />{location}</span><span>{formatRating(profile)}</span>{profile.memberSince ? <span>Member since {formatMonth(profile.memberSince)}</span> : null}</div>
              </div>
            </div>
          </section>
          <section className="card card-pad-lg mb-5"><div className="section-title">About</div><p className="leading-7 text-slate">{profile.bio || "This teacher has not added a public bio yet."}</p></section>
          <section className="card card-pad-lg"><ProfileTags label="Subjects" values={profile.subjects} /><ProfileTags className="mt-5" label="Key stages" values={profile.keyStages} /><ProfileTags className="mt-5" label="Skills" values={profile.skills} /></section>
        </div>
        <aside className="sidebar-panel card-pad-lg self-start"><div className="section-title">Experience & rates</div><ProfileFact label="Experience" value={profile.experience == null ? "Not shared" : `${profile.experience} years`} /><ProfileFact label="Daily rate" value={formatMoney(profile.dailyRate, profile.currency, "day")} /><ProfileFact label="Hourly rate" value={formatMoney(profile.hourlyRate, profile.currency, "hour")} /><ProfileFact label="DBS" value={profile.dbsVerified ? "Verified" : "Not verified"} /></aside>
      </div>
    </div>
  );
}

function ProfileTags({ className = "", label, values }: { className?: string; label: string; values: string[] }) {
  return <div className={className}><div className="section-title">{label}</div><div className="flex flex-wrap gap-2">{values.length ? values.map((value) => <Tag key={value} tone="ghost">{value}</Tag>) : <span className="text-sm text-muted">Not shared</span>}</div></div>;
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"><span className="text-sm text-muted">{label}</span><span className="text-right font-semibold">{value}</span></div>;
}

function ProfileState({ title, message, onBack, onRetry }: { title: string; message: string; onBack: () => void; onRetry?: () => void }) {
  return <div className="app-page"><div className="card card-pad-lg text-center" role="status"><h1 className="font-heading text-[26px]">{title}</h1><p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-muted">{message}</p><div className="mt-5 flex justify-center gap-2">{onRetry ? <Btn variant="secondary" onClick={onRetry}>Try again</Btn> : null}<Btn onClick={onBack}>Back</Btn></div></div></div>;
}

function formatRating(profile: InstructorPublicProfile) {
  return profile.ratingCount ? `${profile.ratingAverage.toFixed(1)} / 5 (${profile.ratingCount} reviews)` : "No reviews yet";
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}

function formatMoney(amount: number | null, currency: string | null, unit: string) {
  if (amount == null) return "Not shared";
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: (currency || "GBP").toUpperCase(), maximumFractionDigits: 2 }).format(amount);
  return `${formatted} / ${unit}`;
}
