import type { ReactNode } from "react";

import { useInstitutionPublicProfile } from "@/features/public-profiles/use-public-profiles";
import { useInstitutionReviews } from "@/features/reviews/use-reviews";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { ProfileReviewsPanel, RatingStars } from "./ProfileReviewsPanel";

export function InstitutionProfilePage({ ctx, go }: Pick<RouteProps, "ctx" | "go">) {
  const profileQuery = useInstitutionPublicProfile(ctx.institutionId);
  const reviewsQuery = useInstitutionReviews(ctx.institutionId);
  const profile = profileQuery.data;

  const goBack = () => ctx.jobId ? go("job-detail", { jobId: ctx.jobId }) : go("bookings");

  if (!ctx.institutionId) return <ProfileState title="Choose a school" message="Open a school from a job, booking, or message to view its profile." onBack={goBack} />;
  if (profileQuery.isLoading) return <div className="app-page profile-page institution-public-profile"><SectionLoader rows={5} /></div>;
  if (!profile) return <ProfileState title="School profile unavailable" message={profileQuery.error?.message || "This profile may be inactive or you may not have permission to view it."} onBack={goBack} onRetry={() => void profileQuery.refetch()} />;

  const location = [profile.address, profile.city, profile.county, profile.postalCode].filter(Boolean).join(", ");

  const rating = reviewsQuery.data?.averageRating ?? 0;
  const reviewCount = reviewsQuery.data?.total ?? 0;

  return (
    <div className="app-page profile-page institution-public-profile">
      <PageHead title="School profile" subtitle="School information, staffing preferences and verified feedback" actions={<Btn icon="arrowLeft" variant="secondary" onClick={goBack}>{ctx.jobId ? "Back to job" : "Back to bookings"}</Btn>} />

      <section className="profile-hero relative mb-6 overflow-hidden border">
        <div aria-hidden="true" className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <div className="rounded-2xl border-4 border-white shadow-lg [&>div]:rounded-xl"><Avatar name={profile.name} size="xl" src={profile.imageUrl} /></div>
              {profile.verified ? <div className="absolute -right-1 bottom-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-success text-white"><Icon name="check" size={15} /></div> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm">Hiring school</span>
                {profile.verified ? <Tag tone="green">Verified school</Tag> : null}
              </div>
              <h1 className="font-heading text-3xl font-semibold leading-tight text-ink sm:text-[40px]">{profile.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate">
                <span className="flex items-center gap-1.5"><Icon className="text-brand" name="pin" size={15} />{location || "Location not shared"}</span>
                {profile.memberSince ? <span className="flex items-center gap-1.5"><Icon className="text-brand" name="calendar" size={15} />Member since {formatMonth(profile.memberSince)}</span> : null}
              </div>
            </div>
            <div className="w-full rounded-2xl border border-white bg-white/85 p-4 shadow-sm backdrop-blur sm:w-auto sm:min-w-48">
              <div className="flex items-center gap-3 sm:block sm:text-center">
                <div className="font-heading text-3xl font-semibold text-ink">{reviewCount ? rating.toFixed(1) : "New"}</div>
                <div><RatingStars className="mt-1" rating={rating} size={17} /><div className="mt-1 text-xs text-muted">{reviewCount ? `${reviewCount} verified ${reviewCount === 1 ? "review" : "reviews"}` : "Ready for a first booking"}</div></div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative grid border-t border-brand-tint-2 bg-white/75 sm:grid-cols-3">
          <ProfileMetric icon="building" label="School type" value={profile.institutionType === "MAT_SCHOOL" ? "MAT school" : "Single school"} />
          <ProfileMetric icon="users" label="Typical pupil count" value={profile.typicalPupilCount == null ? "Not shared" : profile.typicalPupilCount.toLocaleString("en-GB")} />
          <ProfileMetric icon="shield" label="Marketplace status" value={profile.verified ? "Verified school" : "Verification pending"} />
        </div>
      </section>

      <div className="profile-detail-grid grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0">
          <ProfileSection description="What this school looks for when hiring" icon="search" title="Staffing needs">
            <p className="whitespace-pre-line text-[15px] leading-7 text-slate">{profile.staffingNeeds || "This school has not added a public staffing summary yet. School details and preferred cover types are shown below."}</p>
          </ProfileSection>

          <section className="card mt-6 overflow-hidden">
            <div className="border-b border-border bg-surface-subtle px-5 py-5 sm:px-7"><SectionHeading description="The types of teaching cover this school books" icon="calendar" title="Cover opportunities" /></div>
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap gap-2.5">
                {profile.coverTypes.length ? profile.coverTypes.map((type) => <div className="flex items-center gap-2 rounded-xl border border-border bg-chalk px-3.5 py-2.5 text-sm font-medium text-slate" key={type}><Icon className="text-brand" name="checkCircle" size={16} />{formatCoverType(type)}</div>) : <span className="text-sm text-muted">Cover preferences have not been shared.</span>}
              </div>
            </div>
          </section>

          <ProfileReviewsPanel data={reviewsQuery.data} error={reviewsQuery.error} loading={reviewsQuery.isLoading} />
        </main>

        <aside className="profile-overview sidebar-panel overflow-hidden xl:sticky xl:top-6">
          <div className="border-b border-border px-6 py-5 text-white">
            <div className="flex items-center gap-2 text-base font-semibold"><Icon name="building" size={18} />School overview</div>
            <p className="mt-1 text-xs leading-5 text-white/65">Details to help teachers book with confidence</p>
          </div>
          <div className="p-6">
            <ProfileFact icon="building" label="School type" value={profile.institutionType === "MAT_SCHOOL" ? "MAT school" : "Single school"} />
            <ProfileFact icon="users" label="Trust or group" value={profile.trust?.name || "Independent school"} />
            <ProfileFact icon="users" label="Typical pupil count" value={profile.typicalPupilCount == null ? "Not shared" : profile.typicalPupilCount.toLocaleString("en-GB")} />
            <ProfileFact icon="pin" label="Address" value={location || "Not shared"} />
            <ProfileFact icon="calendar" label="SupplyEd member since" value={profile.memberSince ? formatMonth(profile.memberSince) : "Not shared"} />
            <ProfileFact icon="shield" label="Verification" value={profile.verified ? "Verified" : "Pending"} tone={profile.verified ? "success" : undefined} />
          </div>
          <div className="border-t border-border bg-success-tint p-5">
            <div className="flex gap-3"><Icon className="mt-0.5 text-success" name="shield" size={20} /><div><div className="text-sm font-semibold text-ink">Book with confidence</div><p className="mt-1 text-xs leading-5 text-slate">Profile status and reviews help teachers understand who they will be working with.</p></div></div>
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

function ProfileMetric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="flex items-center gap-3 border-b border-brand-tint-2 px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:px-7 sm:last:border-r-0"><div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-tint text-brand"><Icon name={icon} size={17} /></div><div><div className="text-xs text-muted">{label}</div><div className="font-semibold text-ink">{value}</div></div></div>;
}

function ProfileFact({ icon, label, tone, value }: { icon: string; label: string; tone?: "success"; value: string }) {
  return <div className="flex gap-3 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0"><div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-chalk text-brand"><Icon name={icon} size={15} /></div><div className="min-w-0"><div className="text-xs text-muted">{label}</div><div className={`mt-0.5 break-words text-sm font-semibold ${tone === "success" ? "text-success" : "text-ink"}`}>{value}</div></div></div>;
}

function ProfileState({ title, message, onBack, onRetry }: { title: string; message: string; onBack: () => void; onRetry?: () => void }) {
  return <div className="app-page profile-page institution-public-profile"><div className="card card-pad-lg text-center" role="status"><h1 className="font-heading text-[26px]">{title}</h1><p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-muted">{message}</p><div className="mt-5 flex justify-center gap-2">{onRetry ? <Btn variant="secondary" onClick={onRetry}>Try again</Btn> : null}<Btn onClick={onBack}>Back</Btn></div></div></div>;
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}

function formatCoverType(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
