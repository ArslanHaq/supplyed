"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { JobApplicationStatus } from "@/features/applications/types";
import type { Booking } from "@/features/bookings/types";
import { useTeacherDashboard } from "@/features/dashboard/use-teacher-dashboard";
import { filterDashboardBookings, formatDashboardDate, isDashboardBookingOngoing, summarizeDashboardApplications } from "@/features/dashboard/teacher-dashboard-data";
import { useRecommendedJobs } from "@/features/matching/use-matching";
import { formatPence } from "@/features/payments/schemas";
import { getFirstName } from "@/lib/user-display";
import type { RouteProps } from "@/types/supplyed";
import { Avatar, Btn, Icon, Tag, buttonClassName } from "../atoms";
import { MatchScorePanel, SectionLoader } from "../molecules";
import { DashboardMessages } from "./DashboardMessages";
import { RecentNotifications } from "./RecentNotifications";

type QueryState = { isLoading: boolean; isError: boolean; refetch: () => unknown };
const stages: { value: JobApplicationStatus; label: string; description: string }[] = [
  { value: "APPLIED", label: "Applied", description: "Your applications are with the schools. Review your proposals in My applications." },
  { value: "VIEWED", label: "Viewed", description: "Schools have opened these applications. Keep an eye on your messages for their next steps." },
  { value: "SHORTLISTED", label: "Shortlisted", description: "You are on the shortlist. Check your messages for updates from the school." },
  { value: "HIRED", label: "Hired", description: "These applications resulted in a hire. Your confirmed work is available in Bookings." },
  { value: "REJECTED", label: "Not selected", description: "These applications were not selected. Explore recommended roles for a new opportunity." },
];

export function TeacherDashboard({ go, state }: Pick<RouteProps, "go" | "state">) {
  const data = useTeacherDashboard();
  const jobsQuery = useRecommendedJobs({ limit: 3 });
  const [period, setPeriod] = useState<"week" | "month" | "all">("all");
  const [stage, setStage] = useState<JobApplicationStatus>("APPLIED");
  const profile = data.profileQuery.data?.instructor;
  const firstName = getFirstName(profile?.fullName || state.accountName, state.signupEmail);
  const upcoming = data.upcomingBookings;
  const schedule = filterDashboardBookings(upcoming, period, data.now);
  const nextBooking = upcoming[0];
  const summary = data.applicationSummary ?? summarizeDashboardApplications([]);
  const selectedStage = stages.find((item) => item.value === stage)!;
  const profileTasks = data.profileTasks ?? [];
  const profileDone = profileTasks.filter((task) => task.complete).length;
  const balance = data.balanceQuery.data;
  const payoutAccount = data.payoutAccountQuery.data;
  const readyForBalance = payoutAccount?.ready === true;
  const refreshing = data.isRefreshing || jobsQuery.isFetching;

  function refresh() { void data.refresh(); void jobsQuery.refetch(); }

  return (
    <div className="app-page teacher-home">
      <header className="teacher-home-header">
        <div><p className="teacher-eyebrow"><span /> Your teaching workspace</p><h1>Welcome back, {firstName}.</h1><p>Your next placement, latest opportunities and everything in between.</p></div>
        <div className="teacher-header-actions"><Btn variant="secondary" icon="refresh" loading={refreshing} loadingLabel="Refreshing" onClick={refresh}>Refresh</Btn><Btn icon="search" onClick={() => go("find-jobs")}>Find work</Btn></div>
      </header>

      <section className="teacher-metrics" aria-label="Your teaching overview">
        <Metric icon="calendar" label="Upcoming bookings" value={metricValue(data.bookingsQuery, upcoming.length)} caption="Confirmed and ongoing" onClick={() => go("bookings")} />
        <Metric icon="file" label="Active applications" value={metricValue(data.applicationsQuery, summary.active)} caption="Applied through shortlist" onClick={() => go("applications")} />
        <Metric icon="mail" label="Invitations to review" value={metricValue(data.invitationsQuery, data.pendingInvitations.length)} caption="Schools interested in you" onClick={() => go("job-invitations")} />
        <Metric icon="star" label="School rating" value={metricValue(data.profileQuery, !profile ? "—" : profile.ratingCount && profile.ratingAverage != null ? `${profile.ratingAverage.toFixed(1)} / 5` : "Not rated")} caption={profile?.ratingCount ? `${profile.ratingCount} ${profile.ratingCount === 1 ? "review" : "reviews"} from schools` : "Build your teaching reputation"} onClick={() => go("my-profile")} />
      </section>

      <div className="teacher-home-columns">
        <div className="teacher-main-column">
          <section className="teacher-next" aria-label="Your next placement">
            <div className="teacher-next-top"><span className="teacher-next-label"><Icon name="calendar" size={15} /> YOUR NEXT PLACEMENT</span>{!data.bookingsQuery.isLoading && !data.bookingsQuery.isError && nextBooking ? <span className="teacher-next-status"><span /> {isDashboardBookingOngoing(nextBooking, data.now) ? "Today / ongoing" : "Confirmed"}</span> : null}</div>
            {data.bookingsQuery.isLoading ? <div className="teacher-next-loading" role="status">Checking your upcoming work…</div> : data.bookingsQuery.isError ? <div className="teacher-next-copy"><h2>Let’s check your bookings</h2><p>Your schedule is temporarily unavailable.</p><Btn variant="secondary" onClick={() => void data.bookingsQuery.refetch()}>Try again</Btn></div> : nextBooking ? <>
              <div className="teacher-next-body"><DateTile value={nextBooking.startDate} /><div className="teacher-next-copy"><h2>{nextBooking.job.title}</h2><p>{nextBooking.institution.name || "School placement"}</p><div className="teacher-next-meta"><span><Icon name="pin" size={14} /> {location(nextBooking)}</span><span><Icon name="clock" size={14} /> {dateRange(nextBooking.startDate, nextBooking.endDate)}</span></div></div></div>
              <div className="teacher-next-footer"><span><strong>{formatRate(nextBooking.payAmount, nextBooking.payType)}</strong><small>Agreed booking rate</small></span><Btn variant="secondary" iconRight="arrowRight" onClick={() => go("bookings", { bookingId: nextBooking.id })}>View booking</Btn></div>
            </> : <div className="teacher-next-copy teacher-next-empty"><h2>Your next classroom is waiting.</h2><p>Explore roles suited to your experience. Your confirmed bookings will appear here.</p><Btn variant="secondary" iconRight="arrowRight" onClick={() => go("find-jobs")}>Explore teaching roles</Btn></div>}
          </section>

          <Panel title="Your schedule" subtitle="Confirmed placements · UK school dates" action={<Btn variant="ghost" size="sm" onClick={() => go("bookings")}>All bookings <Icon name="arrowRight" size={14} /></Btn>}>
            <div className="teacher-schedule-toolbar"><div className="teacher-segmented" role="group" aria-label="Schedule period">{([['all', 'Upcoming'], ['week', 'This week'], ['month', 'This month']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div><span className="teacher-count">{!data.bookingsQuery.isLoading && !data.bookingsQuery.isError ? `${schedule.length} ${schedule.length === 1 ? "booking" : "bookings"}` : ""}</span></div>
            <QueryContent query={data.bookingsQuery} label="bookings">{schedule.length ? <div className="teacher-schedule-list">{schedule.slice(0, 4).map((booking) => <button className="teacher-schedule-row" type="button" key={booking.id} onClick={() => go("bookings", { bookingId: booking.id })}><DateTile value={booking.startDate} /><span className="teacher-row-copy"><strong>{booking.job.title}</strong><span>{booking.institution.name || "School placement"} · {location(booking)}</span><small>{dateRange(booking.startDate, booking.endDate)}</small></span><span className="teacher-row-rate">{formatRate(booking.payAmount, booking.payType)}</span><Icon name="chevronRight" size={17} /></button>)}{schedule.length > 4 ? <p className="teacher-list-note">Showing your next 4 placements. Open All bookings for the full list.</p> : null}</div> : <Empty icon="calendar" title={period === "all" ? "No upcoming placements" : `No bookings ${period === "week" ? "this week" : "this month"}`} message="Your confirmed work will appear here as schools book you." action={<Btn variant="ghost" size="sm" onClick={() => go("find-jobs")}>Find your next role</Btn>} />}</QueryContent>
          </Panel>

          <Panel title="Application progress" subtitle="See where your applications stand" action={<Btn variant="ghost" size="sm" onClick={() => go("applications")}>My applications <Icon name="arrowRight" size={14} /></Btn>}>
            <QueryContent query={data.applicationsQuery} label="applications"><div className="teacher-pipeline"><div className="teacher-pipeline-heading"><strong>{summary.total}<span> total applications</span></strong><span>{summary.counts.HIRED} hired</span></div><div className="teacher-pipeline-bar" aria-hidden="true">{stages.map((item) => <span key={item.value} data-stage={item.value} style={{ flex: summary.counts[item.value] }} />)}</div><div className="teacher-stage-grid" role="group" aria-label="Application stage">{stages.map((item) => <button key={item.value} type="button" aria-pressed={stage === item.value} onClick={() => setStage(item.value)}><span className="teacher-stage-dot" data-stage={item.value} /><strong>{summary.counts[item.value]}</strong><span>{item.label}</span></button>)}</div><div className="teacher-stage-detail" aria-live="polite"><Icon name={stage === "HIRED" ? "checkCircle" : "file"} size={19} /><p><strong>{summary.counts[stage]} {selectedStage.label.toLowerCase()}</strong>{selectedStage.description}</p></div></div></QueryContent>
          </Panel>

          <Panel title="Schools want to hear from you" subtitle="Review direct invitations before they expire" action={<Btn variant="ghost" size="sm" onClick={() => go("job-invitations")}>All invitations <Icon name="arrowRight" size={14} /></Btn>}>
            <QueryContent query={data.invitationsQuery} label="invitations">{data.pendingInvitations.length ? <div className="teacher-invitation-list">{data.pendingInvitations.slice(0, 3).map((invitation) => <article key={invitation.id} className="teacher-invitation"><div className="teacher-invitation-heading"><Avatar name={invitation.institution.name} src={invitation.institution.imageUrl} /><div><h3>{invitation.job.title}</h3><p>{invitation.institution.name}</p></div><Tag tone="amber">Awaiting response</Tag></div><div className="teacher-invitation-meta"><span>{dateRange(invitation.job.startDate, invitation.job.endDate)}</span><strong>{formatRate(invitation.job.payAmount, invitation.job.payType)}</strong></div>{invitation.message ? <p className="teacher-invitation-message">{invitation.message}</p> : null}<div className="teacher-invitation-footer"><span><Icon name="clock" size={13} /> Reply by {formatDashboardDate(invitation.expiresAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}</span><Btn size="sm" variant="secondary" iconRight="arrowRight" onClick={() => go("job-invitations", { invitationId: invitation.id })}>Review invitation</Btn></div></article>)}</div> : <Empty icon="mail" title="You’re up to date" message="New invitations from schools will appear here. Keep your profile current to help schools find you." />}</QueryContent>
          </Panel>

          <Panel title="Recommended for you" subtitle="Roles matched to your experience and preferences" action={<Btn variant="ghost" size="sm" onClick={() => go("find-jobs")}>Explore roles <Icon name="arrowRight" size={14} /></Btn>}>
            <QueryContent query={jobsQuery} label="recommended roles">{jobsQuery.data?.jobs.length ? <div className="teacher-jobs">{jobsQuery.data.jobs.map(({ job, match }) => <article className="teacher-job" key={job.id}><div className="teacher-job-top"><div><div className="teacher-job-tags">{job.urgent ? <Tag tone="amber">Urgent cover</Tag> : null}{job.subject ? <Tag tone="ghost">{job.subject}</Tag> : null}{job.keyStage ? <Tag tone="ghost">{job.keyStage}</Tag> : null}</div><h3><button type="button" onClick={() => go("job-detail", { jobId: job.id })}>{job.title}</button></h3><p>{job.school === "Hiring account" ? "School details in role" : job.school} · {[job.city, job.county].filter(Boolean).join(", ") || "Location to confirm"}</p></div><strong className="teacher-job-pay">{formatRate(job.payAmount, job.payType)}</strong></div><div className="teacher-job-bottom"><span><Icon name="calendar" size={14} /> {dateRange(job.startDate, job.endDate)}</span><Btn size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("job-detail", { jobId: job.id })}>View role</Btn></div><MatchScorePanel match={match} /></article>)}</div> : <Empty icon="search" title="No recommendations just yet" message="Check available roles or update your subjects and travel preferences to help us find suitable matches." action={<Btn size="sm" variant="secondary" onClick={() => go("find-jobs")}>Browse available roles</Btn>} />}</QueryContent>
          </Panel>
        </div>

        <aside className="teacher-side-column" aria-label="Your account and updates">
          <Panel title="Your teaching profile" action={<button className="teacher-icon-button" type="button" aria-label="Edit teaching profile" onClick={() => go("settings")}><Icon name="edit" size={17} /></button>}>
            <QueryContent query={data.profileQuery} label="your profile">{profile ? <div className="teacher-profile-content"><div className="teacher-profile-identity"><Avatar name={profile.fullName} src={profile.imageUrl} size="lg" /><div><h3>{profile.fullName}</h3><p>{[profile.city, profile.county].filter(Boolean).join(", ") || "Your teaching profile"}</p></div></div><div className="teacher-profile-tags"><Tag tone={profile.status === "approved" ? "green" : "amber"}>{profile.status === "approved" ? "Profile approved" : profile.status.replaceAll("_", " ")}</Tag>{profile.dbsVerified ? <Tag tone="green">DBS verified</Tag> : null}</div><div className="teacher-profile-subjects">{profile.subjects.slice(0, 4).join(" · ") || "Add your teaching subjects"}</div><div className="teacher-profile-checklist"><div className="teacher-checklist-heading"><strong>Profile essentials</strong><span>{profileDone}/{profileTasks.length} added</span></div>{profileTasks.map((task) => <button key={task.id} type="button" className="teacher-checklist-item" data-complete={task.complete} onClick={() => go("settings")}><Icon name={task.complete ? "checkCircle" : "plus"} size={16} /><span>{task.label}</span>{!task.complete ? <span className="teacher-add-label">Add</span> : <span className="sr-only">Added</span>}</button>)}</div><Btn variant="secondary" className="w-full" onClick={() => go("my-profile")}>View my profile</Btn>{data.profileQuery.data?.user.phoneVerified === false ? <p className="teacher-phone-note"><Icon name="shield" size={14} /> Phone verification is optional.<button type="button" onClick={() => go("settings")}>Verify in settings</button></p> : null}</div> : <Empty icon="user" title="Profile unavailable" message="Open settings to check your teaching profile." action={<Btn variant="secondary" size="sm" onClick={() => go("settings")}>Open settings</Btn>} />}</QueryContent>
          </Panel>

          <Panel title="Your payouts" subtitle="Money ready for payout" action={<Icon name="pound" size={20} />}>
            <QueryContent query={data.payoutAccountQuery} label="payout details">{readyForBalance ? <QueryContent query={data.balanceQuery} label="your balance"><div className="teacher-payout"><span className="teacher-payout-label">Available balance</span><strong>{balance ? formatPence(balance.availablePence) : "—"}</strong><div className="teacher-payout-pending"><span>Pending balance</span><b>{balance ? formatPence(balance.pendingPence) : "—"}</b></div><p>Available funds follow your payout schedule. This is your current balance, not monthly earnings.</p><Link className={buttonClassName({ variant: "secondary", className: "w-full" })} href="/billing">Manage payouts <Icon name="arrowRight" size={15} /></Link></div></QueryContent> : <div className="teacher-payout"><span className="teacher-payout-setup"><Icon name="pound" size={22} /></span><h3>{payoutAccount?.connected ? "Finish your payout setup" : "Get ready to get paid"}</h3><p>{payoutAccount?.connected ? "Check your payout account for any remaining details or verification steps." : "Connect your payout account so you can receive payments for your teaching work."}</p><Link className={buttonClassName({ variant: "secondary", className: "w-full" })} href="/billing">{payoutAccount?.connected ? "Check payout setup" : "Set up payouts"} <Icon name="arrowRight" size={15} /></Link></div>}</QueryContent>
          </Panel>

          <section className="teacher-message-section" aria-label="Your conversations"><div className="teacher-section-heading"><div><h2>Your conversations</h2><p>Stay in touch with schools</p></div><button type="button" className="teacher-icon-button" aria-label="Open all messages" onClick={() => go("messaging")}><Icon name="arrowRight" size={18} /></button></div><DashboardMessages go={go} /></section>
          <RecentNotifications />
          <div className="teacher-dashboard-footnote"><Icon name="shield" size={15} /><span>Your dashboard reflects your account’s latest available data.</span></div>
        </aside>
      </div>
    </div>
  );
}

function metricValue(query: QueryState, value: string | number) { return query.isLoading ? "…" : query.isError ? "—" : String(value); }
function Metric({ icon, label, value, caption, onClick }: { icon: string; label: string; value: string; caption: string; onClick: () => void }) {
  return <button className="teacher-metric" type="button" onClick={onClick}><span className="teacher-metric-top"><span>{label}</span><span className="teacher-metric-icon"><Icon name={icon} size={18} /></span></span><strong>{value}</strong><span className="teacher-metric-caption">{value === "—" ? "Temporarily unavailable" : caption}<Icon name="arrowRight" size={14} /></span></button>;
}
function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="teacher-panel" aria-label={title}><header className="teacher-section-heading"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</header>{children}</section>;
}
function QueryContent({ query, label, children }: { query: QueryState; label: string; children: ReactNode }) {
  if (query.isLoading) return <div className="teacher-panel-loading" role="status" aria-label={`Loading ${label}`}><SectionLoader rows={2} /></div>;
  if (query.isError) return <div className="teacher-panel-error" role="alert"><Icon name="refresh" size={20} /><div><strong>We couldn’t load {label}</strong><p>Please try again in a moment.</p></div><Btn variant="secondary" size="sm" onClick={() => void query.refetch()}>Retry</Btn></div>;
  return <>{children}</>;
}
function Empty({ icon, title, message, action }: { icon: string; title: string; message: string; action?: ReactNode }) {
  return <div className="teacher-empty"><span><Icon name={icon} size={23} /></span><h3>{title}</h3><p>{message}</p>{action}</div>;
}
function DateTile({ value }: { value?: string | null }) {
  const valid = value && Number.isFinite(Date.parse(value));
  return <span className="teacher-date-tile" aria-hidden="true"><small>{valid ? formatDashboardDate(value, { day: undefined, month: "short" }) : "DATE"}</small><strong>{valid ? formatDashboardDate(value, { day: "2-digit", month: undefined }) : "—"}</strong><small>{valid ? formatDashboardDate(value, { day: undefined, month: undefined, weekday: "short" }) : "TBC"}</small></span>;
}
function dateRange(start?: string | null, end?: string | null) {
  const first = formatDashboardDate(start, { year: "numeric" });
  const last = end ? formatDashboardDate(end, { year: "numeric" }) : first;
  return first === last ? first : `${first} – ${last}`;
}
function formatRate(amount?: number | null, type?: string | null) {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "Pay to confirm";
  const value = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(amount);
  return `${value}${type === "hourly" ? " / hour" : type === "daily" ? " / day" : type === "fixed" ? " fixed" : ""}`;
}
function location(booking: Booking) { return [booking.job.city, booking.job.county].filter(Boolean).join(", ") || "Location in booking details"; }
