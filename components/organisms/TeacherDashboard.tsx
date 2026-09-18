import { ProfileVerificationPanel } from "./ProfileVerificationPanel";
import { formatJobPay } from "@/features/jobs/presentation";
import { seedMessages } from "@/data/supplyed";
import { useRecommendedJobs } from "@/features/matching/use-matching";
import { getFirstName } from "@/lib/user-display";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Stat, Tag } from "../atoms";
import { MatchScorePanel, PageHead, SectionLoader } from "../molecules";

export function TeacherDashboard({ go, state, toast }: Pick<RouteProps, "go" | "state" | "toast">) {
  const firstName = getFirstName(state.accountName, state.signupEmail);
  const jobsQuery = useRecommendedJobs({ limit: 4 });
  const recommendedJobs = jobsQuery.data?.jobs ?? [];
  const jobCount = jobsQuery.data?.pagination.total ?? recommendedJobs.length;
  const jobCountLabel = jobsQuery.isLoading
    ? "Loading available roles"
    : jobsQuery.isError
      ? "Available roles"
      : `${jobCount} matched ${jobCount === 1 ? "role" : "roles"} available`;

  return (
    <div className="app-page">
      <PageHead
        title={`Morning, ${firstName}`}
        subtitle={jobCountLabel}
        actions={
          <>
            <Btn variant="secondary" onClick={() => go("applications")}>
              My applications
            </Btn>
            <Btn variant="secondary" icon="calendar" onClick={() => go("calendar")}>
              My calendar
            </Btn>
            <Btn icon="search" onClick={() => go("find-jobs")}>
              Find jobs
            </Btn>
          </>
        }
      />
      <ProfileVerificationPanel embedded state={state} go={go} toast={toast} />
      <div className="grid-4 mb-7">
        <Stat value="£3,240" label="Earned this month" delta="+£185 yesterday" />
        <Stat value="12" label="Days booked" delta="3 this week" />
        <Stat value="4.9★" label="Average rating" delta="47 reviews" />
        <Stat value="92%" label="Profile strength" delta="Upload QTS to reach 100%" />
      </div>
      <div className="two-col">
        <div>
          <div className="section-title">Up next</div>
          <div className="card card-pad-lg mb-7 text-center">
            <div className="font-serif text-xl">No upcoming bookings</div>
            <p className="mt-1.5 text-sm text-muted">Confirmed work will appear here.</p>
          </div>
          <div className="section-title">Recommended for you</div>
          <div className="flex flex-col gap-3">
            {jobsQuery.isLoading ? <SectionLoader rows={4} /> : null}
            {jobsQuery.isError ? (
              <div className="card card-pad text-center" role="alert">
                <div className="font-semibold">Jobs could not be loaded</div>
                <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
                <Btn className="mt-3" size="sm" variant="secondary" onClick={() => void jobsQuery.refetch()}>
                  Try again
                </Btn>
              </div>
            ) : null}
            {recommendedJobs.map(({ job, match }) => (
              <div
                key={job.id}
                className="card card-pad flex cursor-pointer flex-wrap items-center gap-4"
                onClick={() => go("job-detail", { jobId: job.id })}
              >
                <div className="min-w-[240px] flex-1">
                  <div className="mb-0.5 flex flex-wrap gap-1.5">
                    {job.urgent ? <Tag tone="red">Urgent</Tag> : null}
                    <Tag tone="ghost">{job.keyStage}</Tag>
                    <Tag tone="ghost">{job.subject}</Tag>
                    {job.requiredSkills.slice(0, 2).map((skill) => (
                      <Tag key={skill} tone="ghost">
                        {skill}
                      </Tag>
                    ))}
                  </div>
                  <div className="text-[15px] font-semibold">{job.title}</div>
                  <div className="text-xs text-muted">
                    {job.school} - {[job.city, job.county].filter(Boolean).join(", ")} - {job.date}
                    {job.minExperienceYears != null ? ` - ${job.minExperienceYears}+ years` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-lg">{formatJobPay(job)}</div>
                </div>
                <div className="w-full" onClick={(event) => event.stopPropagation()}>
                  <MatchScorePanel match={match} />
                </div>
              </div>
            ))}
            {!jobsQuery.isLoading && !jobsQuery.isError && recommendedJobs.length === 0 ? (
              <div className="card card-pad text-center">
                <div className="font-semibold">No open jobs yet</div>
                <p className="mt-1 text-sm text-muted">New roles will appear here as soon as they are published.</p>
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <div className="section-title">Profile strength</div>
          <div className="card card-pad">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="font-serif text-[28px]">92%</div>
              <Tag tone="green">Strong</Tag>
            </div>
            <div className="progress mb-3.5">
              <div className="progress-fill" style={{ width: "92%" }} />
            </div>
            {["Upload QTS Certificate", "Add profile photo", "Complete About you", "Add 2 references"].map(
              (item, index) => (
                <div key={item} className="flex items-center gap-2 py-1.5">
                  <Icon name={index < 2 ? "checkCircle" : "plus"} size={14} />
                  <span className={index < 2 ? "text-sm text-muted" : "text-sm"}>{item}</span>
                </div>
              ),
            )}
          </div>
          <div className="section-title mt-7">Messages</div>
          <div className="card overflow-hidden">
            {seedMessages.map((message, index) => (
              <div
                key={message.id}
                className="msg-list-item"
                style={{ borderBottom: index < seedMessages.length - 1 ? "0.5px solid var(--border)" : "none" }}
                onClick={() => go("messaging")}
              >
                <Avatar name={message.with} size="sm" tone={message.tone} />
                <div className="flex-1">
                  <div className="font-medium">{message.with}</div>
                  <div className="text-xs text-muted">{message.lastMsg}</div>
                </div>
                {message.unread ? <Tag>{message.unread}</Tag> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
