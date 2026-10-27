"use client";

import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useBookings } from "@/features/bookings/use-bookings";
import { useProfileApplications, useProfileJobs, useProfileReviews } from "@/features/my-profile/use-my-profile";
import type { ProfilePagination, ReviewDirection } from "@/features/my-profile/types";
import { useSettingsProfile } from "@/features/settings/use-settings";
import type { SettingsProfileSnapshot } from "@/features/settings/types";
import type { RouteProps } from "@/types/supplyed";
import { Avatar, Btn, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { RatingStars } from "./ProfileReviewsPanel";
import "../styles/my-profile.css";

type ActivityTab = "jobs" | "applications" | "bookings" | "reviews";
const PAGE_SIZE = 6;

export function MyProfilePage({ go, role }: Pick<RouteProps, "go" | "role">) {
  const school = role === "institution";
  const [activeTab, setActiveTab] = useState<ActivityTab>(school ? "jobs" : "applications");
  const [jobPage, setJobPage] = useState(1);
  const [applicationPage, setApplicationPage] = useState(1);
  const [bookingPage, setBookingPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [direction, setDirection] = useState<ReviewDirection>("received");
  const profileQuery = useSettingsProfile();
  const jobsQuery = useProfileJobs({ page: jobPage, limit: PAGE_SIZE }, school);
  const applicationsQuery = useProfileApplications({ page: applicationPage, limit: PAGE_SIZE });
  const bookingsQuery = useBookings({ page: bookingPage, limit: PAGE_SIZE });
  const reviewsQuery = useProfileReviews({ page: reviewPage, limit: PAGE_SIZE, direction });
  const profile = profileQuery.data;
  const tabs: Array<{ id: ActivityTab; label: string; icon: string; count?: number }> = [
    ...(school ? [{ id: "jobs" as const, label: "Posted jobs", icon: "file", count: jobsQuery.data?.pagination.total }] : []),
    { id: "applications", label: "Applications", icon: "users", count: applicationsQuery.data?.pagination.total },
    { id: "bookings", label: "Bookings", icon: "calendar", count: bookingsQuery.data?.pagination.total },
    { id: "reviews", label: "Reviews", icon: "star", count: reviewsQuery.data ? reviewsQuery.data.receivedTotal + reviewsQuery.data.givenTotal : undefined },
  ];

  function openActivity(tab: ActivityTab, reviewDirection?: ReviewDirection) {
    setActiveTab(tab);
    if (reviewDirection) { setDirection(reviewDirection); setReviewPage(1); }
    document.getElementById("my-profile-activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (profileQuery.isLoading) return <div className="app-page my-profile"><PageHead title="My Profile" subtitle="Loading your profile and account history" /><SectionLoader rows={5} /></div>;
  if (!profile) return <div className="app-page my-profile"><PageHead title="My Profile" /><QueryContent query={profileQuery} empty title="Profile details are unavailable" emptyText="Your account details could not be loaded." /></div>;

  const identity = school ? profile.institution : profile.instructor;
  const name = (school ? profile.institution?.name : profile.instructor?.fullName) || profile.user.name || "Your profile";
  const location = [identity?.city, identity?.county].filter(Boolean).join(", ");
  const verified = school ? profile.institution?.verified : profile.instructor?.dbsVerified;
  const publicId = identity?.id;
  const rating = reviewsQuery.data?.averageReceived;
  const received = reviewsQuery.data?.receivedTotal;

  return (
    <div className="app-page my-profile">
      <PageHead title="My Profile" subtitle="Your details, work and feedback, together in one place." actions={<Btn icon="edit" variant="secondary" onClick={() => go("settings")}>Edit profile</Btn>} />

      <section className="my-profile-hero" aria-label="Profile summary">
        <div className="my-profile-hero-main">
          <div className="my-profile-avatar"><Avatar name={name} src={identity?.imageUrl} size="xl" /></div>
          <div className="my-profile-identity">
            <div className="my-profile-eyebrow"><Icon name={school ? "building" : "award"} size={14} />{school ? "School account" : "Teaching professional"}</div>
            <h2>{name}</h2>
            <div className="my-profile-meta">
              {location ? <span><Icon name="pin" size={14} />{location}</span> : null}
              {profile.user.createdAt || identity?.createdAt ? <span><Icon name="calendar" size={14} />Joined {dateLabel(profile.user.createdAt || identity?.createdAt, true)}</span> : null}
            </div>
            <div className="my-profile-badges"><StatusBadge status={profile.applicationStatus} />{verified ? <Tag tone="green"><Icon name="shield" size={12} /> {school ? "Verified school" : "DBS verified"}</Tag> : null}<span className="my-profile-private"><Icon name="lock" size={12} />Only you can see this page</span></div>
          </div>
          <div className="my-profile-reputation">
            <span className="my-profile-eyebrow">Your reputation</span>
            <strong>{rating != null ? rating.toFixed(1) : received === 0 ? "New" : "—"}<small>{rating != null ? " / 5" : ""}</small></strong>
            <RatingStars rating={rating ?? 0} size={17} />
            <button type="button" onClick={() => openActivity("reviews", "received")}>{received == null ? "View reviews" : `${received} ${received === 1 ? "review" : "reviews"} received`} <Icon name="arrowRight" size={13} /></button>
          </div>
        </div>
        <div className="my-profile-hero-footer"><span><Icon name="user" size={15} />Your account overview</span>{publicId ? <Btn size="sm" variant="ghost" iconRight="arrowRight" onClick={() => school ? go("institution-profile", { institutionId: publicId }) : go("teacher-profile", { teacherId: publicId })}>View public profile</Btn> : <Btn size="sm" variant="ghost" onClick={() => go("settings")}>Complete profile</Btn>}</div>
      </section>

      <div className="my-profile-stats">
        {school ? <ProfileStat icon="file" label="Posted jobs" value={jobsQuery.data?.pagination.total} hint="Across all job statuses" onClick={() => openActivity("jobs")} /> : <ProfileStat icon="users" label="Applications" value={applicationsQuery.data?.pagination.total} hint="Your complete application history" onClick={() => openActivity("applications")} />}
        {school ? <ProfileStat icon="users" label="Applications received" value={applicationsQuery.data?.pagination.total} hint="Across all your posted jobs" onClick={() => openActivity("applications")} /> : <ProfileStat icon="calendar" label="Bookings" value={bookingsQuery.data?.pagination.total} hint="Upcoming and past placements" onClick={() => openActivity("bookings")} />}
        {school ? <ProfileStat icon="calendar" label="Bookings" value={bookingsQuery.data?.pagination.total} hint="Your complete booking history" onClick={() => openActivity("bookings")} /> : <ProfileStat icon="star" label="Reviews received" value={received} hint="Feedback from schools" onClick={() => openActivity("reviews", "received")} />}
        <ProfileStat icon={school ? "star" : "message"} label={school ? "Reviews received" : "Reviews given"} value={school ? received : reviewsQuery.data?.givenTotal} hint={school ? "Feedback from teachers" : "Feedback you have shared"} onClick={() => openActivity("reviews", school ? "received" : "given")} />
      </div>

      <nav className="my-profile-section-nav" aria-label="Profile sections"><a href="#my-profile-details"><Icon name="user" size={16} />Profile details</a><a href="#my-profile-activity"><Icon name="grid" size={16} />Work and feedback</a></nav>
      <div className="my-profile-columns">
        <section className="my-profile-details" aria-label="My profile details" data-role={role} id="my-profile-details">
          <ProfileDetails profile={profile} school={school} onEdit={() => go("settings")} onSecurity={() => go("security")} />
        </section>

        <div className="my-profile-history" id="my-profile-activity">
          <section className="my-profile-section my-profile-activity">
            <div className="my-profile-section-heading"><div><span className="my-profile-eyebrow">Your workspace history</span><h2>Work and feedback</h2><p>Explore each part of your SupplyED activity.</p></div><Icon name="grid" size={21} /></div>
            <div className="my-profile-tabs" role="tablist" aria-label="Profile activity">
              {tabs.map((tab, index) => <button key={tab.id} id={`profile-tab-${tab.id}`} aria-controls={`profile-panel-${tab.id}`} aria-selected={activeTab === tab.id} role="tab" tabIndex={activeTab === tab.id ? 0 : -1} type="button" onClick={() => setActiveTab(tab.id)} onKeyDown={event => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                setActiveTab(tabs[next].id);
                document.getElementById(`profile-tab-${tabs[next].id}`)?.focus();
              }}><Icon name={tab.icon} size={16} />{tab.label}{tab.count != null ? <span>{tab.count}</span> : null}</button>)}
            </div>
            <div className="my-profile-tab-panel" id={`profile-panel-${activeTab}`} aria-labelledby={`profile-tab-${activeTab}`} role="tabpanel" tabIndex={0}>
              {activeTab === "jobs" ? <>
                <ActivityHeading title="Your posted jobs" description="All your roles, including drafts and closed jobs." action={<Btn size="sm" variant="secondary" iconRight="arrowRight" onClick={() => go("dashboard")}>Manage jobs</Btn>} />
                <QueryContent query={jobsQuery} empty={!jobsQuery.data?.jobs.length} title="No jobs posted yet" emptyText="Your job listings will appear here when you create your first role." action={<Btn size="sm" icon="plus" onClick={() => go("post-job")}>Post a job</Btn>}>
                  <div className="my-profile-records">{jobsQuery.data?.jobs.map(job => <article className="my-profile-record" key={job.id}>
                    <div className="my-profile-record-icon"><Icon name="file" size={19} /></div><div className="my-profile-record-copy"><div className="my-profile-record-top"><h3>{job.title}</h3><StatusBadge status={job.status || "DRAFT"} /></div><p>{[job.subject, job.city].filter(Boolean).join(" · ")}</p><div className="my-profile-record-meta"><span>{job.date}</span><span>{money(job.payAmount ?? job.rate, "GBP", job.payType)}</span></div><div className="my-profile-record-actions"><Btn size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("applications", { jobId: job.id })}>View applications</Btn><Btn size="sm" variant="ghost" onClick={() => go("post-job", { jobId: job.id })}>Manage job</Btn></div></div>
                  </article>)}</div><ProfilePaginationControl pagination={jobsQuery.data?.pagination} busy={jobsQuery.isFetching} onChange={setJobPage} label="Posted jobs" />
                </QueryContent>
              </> : null}

              {activeTab === "applications" ? <>
                <ActivityHeading title={school ? "Applications to your jobs" : "Your applications"} description={school ? "Applicants across your active and past roles." : "Keep track of every role you have applied for."} action={<Btn size="sm" variant="secondary" iconRight="arrowRight" onClick={() => go("applications")}>Open applications</Btn>} />
                <QueryContent query={applicationsQuery} empty={!applicationsQuery.data?.applications.length} title="No applications yet" emptyText={school ? "Applications will appear here when teachers apply to your jobs." : "Apply for a role and follow its progress here."}>
                  <div className="my-profile-records">{applicationsQuery.data?.applications.map(application => <article className="my-profile-record" key={application.id}>
                    <div className="my-profile-record-icon"><Icon name="users" size={19} /></div><div className="my-profile-record-copy"><div className="my-profile-record-top"><h3>{school ? application.instructor?.fullName || "Teacher" : application.jobTitle || "Job no longer public"}</h3><StatusBadge status={application.status} /></div><p>{school ? application.jobTitle : application.schoolName || "Hiring school"}</p><div className="my-profile-record-meta"><span>Applied {dateLabel(application.createdAt)}</span>{school && application.instructor?.city ? <span>{application.instructor.city}</span> : null}</div><div className="my-profile-record-actions">{school ? <Btn size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("applications", { jobId: application.jobId, applicationId: application.id })}>View application</Btn> : application.jobAvailable ? <Btn size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("job-detail", { jobId: application.jobId })}>View job</Btn> : <Btn size="sm" variant="ghost" onClick={() => go("applications", { applicationId: application.id })}>View application</Btn>}{school && application.instructorId ? <Btn size="sm" variant="ghost" onClick={() => go("teacher-profile", { teacherId: application.instructorId })}>Teacher profile</Btn> : null}</div></div>
                  </article>)}</div><ProfilePaginationControl pagination={applicationsQuery.data?.pagination} busy={applicationsQuery.isFetching} onChange={setApplicationPage} label="Applications" />
                </QueryContent>
              </> : null}

              {activeTab === "bookings" ? <>
                <ActivityHeading title="Your bookings" description="Confirmed, completed and cancelled placements." action={<Btn size="sm" variant="secondary" iconRight="arrowRight" onClick={() => go("bookings")}>Open bookings</Btn>} />
                <QueryContent query={bookingsQuery} empty={!bookingsQuery.data?.bookings.length} title="No bookings yet" emptyText="Your placements will appear here once a booking is confirmed.">
                  <div className="my-profile-records">{bookingsQuery.data?.bookings.map(booking => <article className="my-profile-record" key={booking.id}>
                    <div className="my-profile-record-icon"><Icon name="calendar" size={19} /></div><div className="my-profile-record-copy"><div className="my-profile-record-top"><h3>{booking.job.title}</h3><StatusBadge status={booking.status} /></div><p>{school ? booking.instructor.fullName || "Teacher" : booking.institution.name || "School"}</p><div className="my-profile-record-meta"><span>{dateRange(booking.startDate, booking.endDate)}</span><span>{money(booking.payAmount, "GBP", booking.payType)}</span></div><div className="my-profile-record-actions"><Btn size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("bookings", { jobId: booking.job.id })}>Manage booking</Btn><Btn size="sm" variant="ghost" onClick={() => school ? go("teacher-profile", { teacherId: booking.instructor.id }) : go("institution-profile", { institutionId: booking.institution.id })}>{school ? "Teacher profile" : "School profile"}</Btn></div></div>
                  </article>)}</div><ProfilePaginationControl pagination={bookingsQuery.data?.pagination} busy={bookingsQuery.isFetching} onChange={setBookingPage} label="Bookings" />
                </QueryContent>
              </> : null}

              {activeTab === "reviews" ? <>
                <ActivityHeading title="Your reviews" description="Feedback received and feedback you have shared after bookings." />
                <div className="my-profile-review-switch" aria-label="Review direction" role="group">{(["received", "given"] as const).map(value => <button type="button" key={value} aria-pressed={direction === value} onClick={() => { setDirection(value); setReviewPage(1); }}>Reviews {value}<span>{reviewsQuery.data ? value === "received" ? reviewsQuery.data.receivedTotal : reviewsQuery.data.givenTotal : "—"}</span></button>)}</div>
                <QueryContent query={reviewsQuery} empty={!reviewsQuery.data?.reviews.length} title={`No reviews ${direction} yet`} emptyText={direction === "given" ? "Reviews you submit from completed bookings will appear here." : "Feedback from your completed bookings will appear here."} action={direction === "given" ? <Btn size="sm" variant="secondary" onClick={() => go("bookings")}>Go to bookings</Btn> : undefined}>
                  <div className="my-profile-records">{reviewsQuery.data?.reviews.map(review => <article className="my-profile-review" key={review.id}>
                    <div className="my-profile-record-top"><div className="my-profile-review-person"><Avatar name={review.partyName} size="sm" /><div><h3>{direction === "given" ? `To ${review.partyName}` : review.partyName}</h3><p>{direction === "given" ? "Your feedback" : "Verified booking feedback"}</p></div></div><div className="my-profile-review-rating"><RatingStars rating={review.rating} size={16} /><span>{review.rating.toFixed(1)} / 5</span></div></div>
                    {review.comment ? <p className="my-profile-review-comment">{review.comment}</p> : <p className="my-profile-review-comment text-muted">Rating only · no written comment</p>}
                    <div className="my-profile-record-meta"><span><Icon name="file" size={13} />{review.jobTitle}</span><span>{dateLabel(review.createdAt)}</span></div><div className="my-profile-record-actions"><Btn size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("bookings", { jobId: review.jobId })}>View booking</Btn><Btn size="sm" variant="ghost" onClick={() => school ? go("teacher-profile", { teacherId: review.partyId }) : go("institution-profile", { institutionId: review.partyId })}>{school ? "Teacher profile" : "School profile"}</Btn></div>
                  </article>)}</div><ProfilePaginationControl pagination={reviewsQuery.data?.pagination} busy={reviewsQuery.isFetching} onChange={setReviewPage} label={`Reviews ${direction}`} />
                </QueryContent>
              </> : null}
            </div>
          </section>
          <div className="my-profile-shortcuts"><button type="button" onClick={() => go("billing")}><span className="my-profile-record-icon"><Icon name="pound" size={20} /></span><span><strong>{school ? "Billing and invoices" : "Earnings and payouts"}</strong><small>{school ? "View payments for your bookings" : "Manage your payment details"}</small></span><Icon name="arrowRight" size={17} /></button><button type="button" onClick={() => go("messaging")}><span className="my-profile-record-icon"><Icon name="message" size={20} /></span><span><strong>Your conversations</strong><small>Continue messages about your work</small></span><Icon name="arrowRight" size={17} /></button></div>
        </div>
      </div>
    </div>
  );
}

function ProfileDetails({ profile, school, onEdit, onSecurity }: { profile: SettingsProfileSnapshot; school: boolean; onEdit: () => void; onSecurity: () => void }) {
  const person = profile.instructor;
  const institution = profile.institution;
  const identity = school ? institution : person;
  return <>
    <DetailSection title={school ? "About your school" : "About you"} icon={school ? "building" : "user"}><p className="my-profile-about">{(school ? institution?.staffingNeeds.join(", ") : person?.bio) || "Add an introduction in your profile settings."}</p><Btn className="mt-4" size="sm" variant="ghost" icon="edit" onClick={onEdit}>Update details</Btn></DetailSection>
    <DetailSection title="Account details" icon="user"><dl className="my-profile-facts"><Fact label="Account name" value={profile.user.name} /><Fact label="Email" value={profile.user.email} /><Fact label="Email verification" value={profile.user.emailVerified ? "Verified" : "Not verified"} /><Fact label="Phone" value={profile.user.phone} /><Fact label="Phone verification" value={profile.user.phoneVerified ? "Verified" : "Not verified"} /><Fact label="Account status" value={statusLabel(profile.applicationStatus)} /><Fact label="Member since" value={dateLabel(profile.user.createdAt)} /><Fact label="Last sign-in" value={dateLabel(profile.user.lastLogin)} /></dl></DetailSection>
    <DetailSection title="Location" icon="pin"><dl className="my-profile-facts"><Fact label="Address" value={identity?.address} /><Fact label="City or town" value={identity?.city} /><Fact label="County" value={identity?.county} /><Fact label="Postcode" value={identity?.postalCode} /><Fact label="Country" value={identity?.countryCode === "GB" ? "United Kingdom" : identity?.countryCode} />{!school ? <Fact label="Travel distance" value={person?.maxTravelDistance ? `${person.maxTravelDistance} miles` : undefined} /> : null}</dl></DetailSection>
    {school ? <>
      <DetailSection title="School details" icon="building"><dl className="my-profile-facts"><Fact label="Your role" value={institution?.userRole} /><Fact label="Pupil count" value={institution?.typicalPupilCount} /><Fact label="Registration number" value={institution?.registrationId} /><Fact label="School domain" value={institution?.domain} /><Fact label="Verification" value={institution?.verified ? "Verified" : "Not verified"} /></dl><DetailTags label="Cover types" values={institution?.coverTypes.map(statusLabel) ?? []} /></DetailSection>
      <DetailSection title="Safeguarding and compliance" icon="shield"><dl className="my-profile-facts"><Fact label="Compliance contact" value={institution?.complianceContact} /><Fact label="Compliance email" value={institution?.complianceEmail} /><Fact label="Safeguarding" value={institution?.safeguardingConfirmed ? "Confirmed" : "Not confirmed"} /></dl></DetailSection>
    </> : <>
      <DetailSection title="Teaching expertise" icon="award"><dl className="my-profile-facts"><Fact label="Experience" value={person?.experience !== "" && person?.experience != null ? `${person.experience} years` : undefined} /><Fact label="DBS verification" value={person?.dbsVerified ? "Verified" : "Not verified"} /></dl><DetailTags label="Subjects" values={person?.subjects ?? []} /><DetailTags label="Key stages" values={person?.keyStages ?? []} /><DetailTags label="Skills" values={person?.skills ?? []} /></DetailSection>
      <DetailSection title="Your rates" icon="pound"><dl className="my-profile-facts"><Fact label="Daily rate" value={money(person?.dailyRate, person?.currency, "daily")} /><Fact label="Hourly rate" value={money(person?.hourlyRate, person?.currency, "hourly")} /><Fact label="Currency" value={person?.currency} /></dl></DetailSection>
    </>}
    <DetailSection title="Account security" icon="lock"><dl className="my-profile-facts"><Fact label="Two-factor authentication" value={profile.user.twoFactorEnabled ? "Enabled" : "Not enabled"} /><Fact label="Profile updated" value={dateLabel(identity?.updatedAt || profile.user.updatedAt)} /></dl><Btn className="mt-4" size="sm" variant="ghost" iconRight="arrowRight" onClick={onSecurity}>Manage security</Btn></DetailSection>
  </>;
}

function DetailSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return <section className="my-profile-section"><div className="my-profile-detail-heading"><Icon name={icon} size={17} /><h2>{title}</h2></div><div className="my-profile-detail-body">{children}</div></section>;
}
function Fact({ label, value }: { label: string; value?: string | null }) { return <div><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>; }
function DetailTags({ label, values }: { label: string; values: string[] }) { return <div className="my-profile-detail-tags"><h3>{label}</h3><div>{values.length ? values.map(value => <Tag tone="ghost" key={value}>{value}</Tag>) : <span className="text-sm text-muted">Not provided</span>}</div></div>; }
function ProfileStat({ icon, label, value, hint, onClick }: { icon: string; label: string; value?: number; hint: string; onClick: () => void }) { return <button className="my-profile-stat" onClick={onClick} type="button"><span className="my-profile-stat-top"><span className="my-profile-record-icon"><Icon name={icon} size={18} /></span><Icon name="arrowRight" size={15} /></span><strong>{value == null ? "—" : value.toLocaleString("en-GB")}</strong><span className="my-profile-stat-label">{label}</span><small>{hint}</small></button>; }
function ActivityHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="my-profile-activity-heading"><div><h3>{title}</h3><p>{description}</p></div>{action}</div>; }
function StatusBadge({ status }: { status: string }) { const tone = ["approved", "ACTIVE", "CONFIRMED", "COMPLETED", "HIRED"].includes(status) ? "green" : ["REJECTED", "CANCELLED", "NO_SHOW", "rejected", "suspended"].includes(status) ? "red" : "ghost"; return <Tag tone={tone}>{statusLabel(status)}</Tag>; }

function QueryContent({ query, empty, title, emptyText, action, children }: { query: Pick<UseQueryResult, "isLoading" | "isError" | "isFetching" | "refetch">; empty: boolean; title: string; emptyText: string; action?: ReactNode; children?: ReactNode }) {
  if (query.isLoading) return <div className="my-profile-loading" role="status" aria-label="Loading profile activity"><SectionLoader rows={3} /></div>;
  if (query.isError) return <div className="my-profile-empty" role="alert"><Icon name="help" size={26} /><h3>This section could not be loaded</h3><p>Please try again to see your latest information.</p><Btn size="sm" variant="secondary" onClick={() => void query.refetch()}>Try again</Btn></div>;
  if (empty) return <div className="my-profile-empty"><span className="my-profile-record-icon"><Icon name="file" size={24} /></span><h3>{title}</h3><p>{emptyText}</p>{action}</div>;
  return <div aria-busy={query.isFetching}>{query.isFetching ? <p className="my-profile-refresh" role="status">Updating your activity…</p> : null}{children}</div>;
}
function ProfilePaginationControl({ pagination, busy, onChange, label }: { pagination?: ProfilePagination; busy: boolean; onChange: (page: number) => void; label: string }) {
  if (!pagination || pagination.total === 0) return null;
  return <nav className="my-profile-pagination" aria-label={`${label} pages`}><span>{(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span>{pagination.totalPages > 1 ? <div><Btn size="sm" variant="secondary" disabled={busy || pagination.page <= 1} onClick={() => onChange(pagination.page - 1)}>Previous</Btn><span>Page {pagination.page} of {pagination.totalPages}</span><Btn size="sm" variant="secondary" disabled={busy || !pagination.hasNextPage} onClick={() => onChange(pagination.page + 1)}>Next</Btn></div> : null}</nav>;
}
function statusLabel(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function dateLabel(value?: string | null, monthOnly = false) { if (!value || !Number.isFinite(Date.parse(value))) return "Not provided"; return new Intl.DateTimeFormat("en-GB", { ...(monthOnly ? {} : { day: "numeric" as const }), month: "short", year: "numeric" }).format(new Date(value)); }
function dateRange(start?: string | null, end?: string | null) { if (!start) return "Dates to be confirmed"; return end && end !== start ? `${dateLabel(start)} – ${dateLabel(end)}` : dateLabel(start); }
function money(value?: string | number | null, currency = "GBP", unit?: string | null) { if (value == null || value === "" || !Number.isFinite(Number(value))) return "Not provided"; let amount: string; try { amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP", maximumFractionDigits: 2 }).format(Number(value)); } catch { amount = `${currency} ${value}`; } return `${amount}${unit === "daily" ? " / day" : unit === "hourly" ? " / hour" : unit === "fixed" ? " fixed" : ""}`; }
