import { seedMessages } from "@/data/supplyed";
import { useMyApplications } from "@/features/applications/use-applications";
import type { JobApplication } from "@/features/applications/types";
import { useJobs } from "@/features/jobs/use-jobs";
import { getFirstName } from "@/lib/user-display";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stat, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

export function TeacherDashboard({ go, state }: Pick<RouteProps, "go" | "state">) {
  const firstName = getFirstName(state.accountName, state.signupEmail);
  const jobsQuery = useJobs();
  const applicationsQuery = useMyApplications({ limit: 5 });
  const recommendedJobs = jobsQuery.data ?? [];
  const applications = applicationsQuery.data?.applications ?? [];
  const nextApplication = applications.find((application) => application.status === "HIRED" || application.status === "INTERVIEW") ?? applications[0];

  return (
    <div className="app-page">
      <PageHead title={`Morning, ${firstName}`} subtitle={`${recommendedJobs.length} open roles - ${applications.length} applications tracked`} actions={<><Btn variant="secondary" icon="calendar" onClick={() => go("calendar")}>My calendar</Btn><Btn icon="search" onClick={() => go("find-jobs")}>Find jobs</Btn></>} />
      <div className="grid-4 mb-7">
        <Stat value="£3,240" label="Earned this month" delta="+£185 yesterday" />
        <Stat value="12" label="Days booked" delta="3 this week" />
        <Stat value="4.9★" label="Average rating" delta="47 reviews" />
        <Stat value={String(applications.length)} label="Applications" delta="Synced from backend" />
      </div>
      <div className="two-col">
        <div>
          <div className="section-title">Up next</div>
          {applicationsQuery.isLoading ? <SectionLoader rows={1} /> : <NextApplicationCard application={nextApplication} go={go} />}
          <div className="section-title">Recommended for you</div>
          <div className="flex flex-col gap-3">
            {jobsQuery.isLoading ? <SectionLoader rows={3} /> : null}
            {!jobsQuery.isLoading && recommendedJobs.length === 0 ? (
              <div className="card card-pad text-muted">No active roles are available right now.</div>
            ) : null}
            {recommendedJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="card card-pad flex cursor-pointer flex-wrap items-center gap-4" onClick={() => go("job-detail", { jobId: job.id })}>
                <div className="flex-1"><div className="mb-0.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone="ghost">{job.keyStage}</Tag><Tag tone="ghost">{job.subject}</Tag></div><div className="text-[15px] font-semibold">{job.title}</div><div className="text-xs text-muted">{job.school} - {job.city} - {job.date}</div></div>
                <div className="text-right"><div className="font-serif text-lg">£{job.rate}</div><div className="text-xs text-muted">per day</div></div>
                <MatchScore score={job.matchScore} />
                <Btn size="sm">View</Btn>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-title">Profile strength</div>
          <div className="card card-pad">
            <div className="mb-2.5 flex items-center justify-between"><div className="font-serif text-[28px]">92%</div><Tag tone="green">Strong</Tag></div>
            <div className="progress mb-3.5"><div className="progress-fill" style={{ width: "92%" }} /></div>
            {["Upload QTS Certificate", "Add profile photo", "Complete About you", "Add 2 references"].map((item, index) => (
              <div key={item} className="flex items-center gap-2 py-1.5"><Icon name={index < 2 ? "checkCircle" : "plus"} size={14} /><span className={index < 2 ? "text-sm text-muted" : "text-sm"}>{item}</span></div>
            ))}
          </div>
          <div className="section-title mt-7">Messages</div>
          <div className="card overflow-hidden">
            {seedMessages.map((message, index) => (
              <div key={message.id} className="msg-list-item" style={{ borderBottom: index < seedMessages.length - 1 ? "0.5px solid var(--border)" : "none" }} onClick={() => go("messaging")}>
                <Avatar name={message.with} size="sm" tone={message.tone} />
                <div className="flex-1"><div className="font-medium">{message.with}</div><div className="text-xs text-muted">{message.lastMsg}</div></div>
                {message.unread ? <Tag>{message.unread}</Tag> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NextApplicationCard({ application, go }: { application?: JobApplication; go: RouteProps["go"] }) {
  if (!application?.job) {
    return (
      <div className="card card-pad-lg mb-7 text-center">
        <div className="font-serif text-[24px]">No applications yet</div>
        <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-muted">Apply to active roles and track your progress here.</p>
        <Btn className="mt-4" icon="search" onClick={() => go("find-jobs")}>Find jobs</Btn>
      </div>
    );
  }

  return (
    <div className="card card-pad-lg mb-7 bg-gradient-to-br from-[#008CC4] to-[#006E9A] text-white">
      <div className="mb-3.5 flex items-center justify-between">
        <Tag className="bg-white/20 text-white">{formatStatus(application.status)}</Tag>
        <span className="text-xs opacity-80">{formatDate(application.job.startDate)}</span>
      </div>
      <div className="mb-2 font-serif text-[26px]">{application.job.title}</div>
      <div className="mb-4 text-[15px] opacity-90">{application.job.location ?? "Location TBC"}</div>
      <div className="flex flex-wrap gap-4">
        <div><div className="text-xs opacity-70">Pay</div><div className="font-serif text-[22px]">{formatPay(application.job.payAmount, application.job.payType)}</div></div>
        <div><div className="text-xs opacity-70">Subject</div><div className="font-serif text-[22px]">{application.job.subject ?? "General"}</div></div>
      </div>
    </div>
  );
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "Date TBC";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short" }).format(new Date(value));
}

function formatPay(amount?: number | string | null, type?: string | null) {
  if (amount === null || amount === undefined || amount === "") return "Rate TBC";
  if (type === "hourly") return `£${amount}/hr`;
  if (type === "fixed") return `£${amount} fixed`;
  return `£${amount}/day`;
}
