import type { ReactNode } from "react";

import { useInstructorPublicProfile } from "@/features/public-profiles/use-public-profiles";
import { useInstructorReviews } from "@/features/reviews/use-reviews";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag, VerifyBadge } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { ProfileReviewsPanel, RatingStars } from "./ProfileReviewsPanel";

export function PublicTeacherProfilePage({ ctx, go }: Pick<RouteProps, "ctx" | "go">) {
  const profileQuery = useInstructorPublicProfile(ctx.teacherId);
  const reviewsQuery = useInstructorReviews(ctx.teacherId);
  const profile = profileQuery.data;

  if (!ctx.teacherId) return <ProfileState title="Choose a teacher" message="Open a teacher from an application or booking to view their profile." onBack={() => go("applications")} />;
  if (profileQuery.isLoading) return <div className="app-page profile-page teacher-public-profile"><SectionLoader rows={5} /></div>;
  if (!profile) return <ProfileState title="Teacher profile unavailable" message={profileQuery.error?.message || "This profile may be inactive or you may not have permission to view it."} onBack={() => go("applications")} onRetry={() => void profileQuery.refetch()} />;

  const location = [profile.city, profile.county].filter(Boolean).join(", ") || "Location not shared";

  return (
    <div className="app-page profile-page teacher-public-profile">
      <PageHead title="Teacher profile" subtitle="Experience, credentials and verified booking feedback" actions={<Btn icon="arrowLeft" variant="secondary" onClick={() => go("applications")}>Back to applications</Btn>} />

      <section className="profile-hero relative mb-6 overflow-hidden border">
        <div aria-hidden="true" className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <div className="rounded-full border-4 border-white shadow-lg"><Avatar name={profile.fullName} size="xl" src={profile.imageUrl} /></div>
              {profile.dbsVerified ? <div className="absolute -right-1 bottom-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-success text-white"><Icon name="check" size={15} /></div> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm">Supply teacher</span>
                {profile.dbsVerified ? <VerifyBadge /> : null}
              </div>
              <h1 className="font-heading text-3xl font-semibold leading-tight text-ink sm:text-[40px]">{profile.fullName}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate">
                <span className="flex items-center gap-1.5"><Icon className="text-brand" name="pin" size={15} />{location}</span>
                {profile.memberSince ? <span className="flex items-center gap-1.5"><Icon className="text-brand" name="calendar" size={15} />Member since {formatMonth(profile.memberSince)}</span> : null}
              </div>
            </div>
            <div className="w-full rounded-2xl border border-white bg-white/85 p-4 shadow-sm backdrop-blur sm:w-auto sm:min-w-48">
              <div className="flex items-center gap-3 sm:block sm:text-center">
                <div className="font-heading text-3xl font-semibold text-ink">{profile.ratingCount ? profile.ratingAverage.toFixed(1) : "New"}</div>
                <div><RatingStars className="mt-1" rating={profile.ratingAverage} size={17} /><div className="mt-1 text-xs text-muted">{profile.ratingCount ? `${profile.ratingCount} verified ${profile.ratingCount === 1 ? "review" : "reviews"}` : "Ready for a first booking"}</div></div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative grid border-t border-brand-tint-2 bg-white/75 sm:grid-cols-3">
          <ProfileMetric icon="award" label="Teaching experience" value={profile.experience == null ? "Not shared" : `${profile.experience} ${profile.experience === 1 ? "year" : "years"}`} />
          <ProfileMetric icon="file" label="Subjects" value={profile.subjects.length ? `${profile.subjects.length} listed` : "Not shared"} />
          <ProfileMetric icon="shield" label="Safeguarding" value={profile.dbsVerified ? "DBS verified" : "Awaiting verification"} />
        </div>
      </section>

      <div className="profile-detail-grid grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0">
          <ProfileSection description="A professional introduction from the teacher" icon="user" title="About this teacher">
            <p className="whitespace-pre-line text-[15px] leading-7 text-slate">{profile.bio || "This teacher has not added a public introduction yet. Their verified experience and teaching preferences are shown below."}</p>
          </ProfileSection>

          <section className="card mt-6 overflow-hidden">
            <div className="border-b border-border bg-surface-subtle px-5 py-5 sm:px-7"><SectionHeading description="Teaching areas and classroom strengths" icon="award" title="Expertise" /></div>
            <div className="grid gap-0 md:grid-cols-3">
              <ExpertiseGroup icon="file" label="Subjects" values={profile.subjects} />
              <ExpertiseGroup icon="users" label="Key stages" values={profile.keyStages} />
              <ExpertiseGroup icon="zap" label="Skills" values={profile.skills} />
            </div>
          </section>

          <ProfileReviewsPanel data={reviewsQuery.data} error={reviewsQuery.error} loading={reviewsQuery.isLoading} />
        </main>

        <aside className="profile-overview sidebar-panel overflow-hidden xl:sticky xl:top-6">
          <div className="border-b border-border px-6 py-5 text-white">
            <div className="flex items-center gap-2 text-base font-semibold"><Icon name="file" size={18} />Profile overview</div>
            <p className="mt-1 text-xs leading-5 text-white/65">Key information for your hiring decision</p>
          </div>
          <div className="p-6">
            <ProfileFact icon="award" label="Experience" value={profile.experience == null ? "Not shared" : `${profile.experience} years`} />
            <ProfileFact icon="pound" label="Daily rate" value={formatMoney(profile.dailyRate, profile.currency, "day")} />
            <ProfileFact icon="clock" label="Hourly rate" value={formatMoney(profile.hourlyRate, profile.currency, "hour")} />
            <ProfileFact icon="shield" label="DBS status" value={profile.dbsVerified ? "Verified" : "Not verified"} tone={profile.dbsVerified ? "success" : undefined} />
            <ProfileFact icon="pin" label="Location" value={location} />
          </div>
          <div className="border-t border-border bg-success-tint p-5">
            <div className="flex gap-3"><Icon className="mt-0.5 text-success" name="shield" size={20} /><div><div className="text-sm font-semibold text-ink">Trust and transparency</div><p className="mt-1 text-xs leading-5 text-slate">Reviews shown here come from completed bookings on SupplyEd.</p></div></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProfileSection({ children, description, icon, title }: { children: ReactNode; description: string; icon: string; title: string }) {
  return <section className="card overflow-hidden"><div className="border-b border-border bg-surface-subtle px-5 py-5 sm:px-7"><SectionHeading description={description} icon={icon} title={title} /></div><div className="p-5 sm:p-7">{children}</div></section>;
}

function SectionHeading({ description, icon, title }: { description: string; icon: string; title: string }) {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint text-brand"><Icon name={icon} size={19} /></div><div><h2 className="font-heading text-lg font-semibold text-ink">{title}</h2><p className="mt-0.5 text-xs text-muted">{description}</p></div></div>;
}

function ExpertiseGroup({ icon, label, values }: { icon: string; label: string; values: string[] }) {
  return <div className="border-b border-border p-5 last:border-b-0 sm:p-7 md:border-r md:border-b-0 md:last:border-r-0"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink"><Icon className="text-brand" name={icon} size={17} />{label}</div><div className="flex flex-wrap gap-2">{values.length ? values.map((value) => <Tag key={value} tone="ghost">{value}</Tag>) : <span className="text-sm text-muted">Not shared</span>}</div></div>;
}

function ProfileMetric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="flex items-center gap-3 border-b border-brand-tint-2 px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:px-7 sm:last:border-r-0"><div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-tint text-brand"><Icon name={icon} size={17} /></div><div><div className="text-xs text-muted">{label}</div><div className="font-semibold text-ink">{value}</div></div></div>;
}

function ProfileFact({ icon, label, tone, value }: { icon: string; label: string; tone?: "success"; value: string }) {
  return <div className="flex gap-3 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0"><div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-chalk text-brand"><Icon name={icon} size={15} /></div><div className="min-w-0"><div className="text-xs text-muted">{label}</div><div className={`mt-0.5 break-words text-sm font-semibold ${tone === "success" ? "text-success" : "text-ink"}`}>{value}</div></div></div>;
}

function ProfileState({ title, message, onBack, onRetry }: { title: string; message: string; onBack: () => void; onRetry?: () => void }) {
  return <div className="app-page profile-page teacher-public-profile"><div className="card card-pad-lg text-center" role="status"><h1 className="font-heading text-[26px]">{title}</h1><p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-muted">{message}</p><div className="mt-5 flex justify-center gap-2">{onRetry ? <Btn variant="secondary" onClick={onRetry}>Try again</Btn> : null}<Btn onClick={onBack}>Back</Btn></div></div></div>;
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}

function formatMoney(amount: number | null, currency: string | null, unit: string) {
  if (amount == null) return "Not shared";
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: (currency || "GBP").toUpperCase(), maximumFractionDigits: 2 }).format(amount);
  return `${formatted} / ${unit}`;
}
