import { seedJobs, seedTeachers } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stat, Tag } from "../atoms";
import { PageHead } from "../molecules";

export function InstitutionDashboard({ go, tweaks }: Pick<RouteProps, "go" | "tweaks">) {
  return (
    <>
      {tweaks.urgentBanner ? (
        <div className="urgent-banner">
          <Icon name="zap" size={16} />
          <strong>2 unfilled roles tomorrow.</strong>
          <span style={{ opacity: 0.8 }}>Post an urgent cover or invite top matches.</span>
          <div className="ml-auto flex gap-2">
            <Btn variant="danger" size="sm" onClick={() => go("post-job")}>Post urgent</Btn>
          </div>
        </div>
      ) : null}
      <div className="app-page">
        <PageHead
          title="Good morning, Greenfield"
          subtitle="Tuesday, 24 March 2026 - 3 active jobs - 2 roles unfilled for tomorrow"
          actions={<><Btn variant="secondary" icon="download">Export</Btn><Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn></>}
        />
        <div className="grid-4 mb-7">
          <Stat value="3" label="Active jobs" delta="2 open" />
          <Stat value="18" label="Applicants this week" delta="+6 today" />
          <Stat value="12" label="Teachers shortlisted" delta="4 new" />
          <Stat value="£1,840" label="Month-to-date spend" delta="-8% vs Feb" />
        </div>
        <div className="two-col">
          <div>
            <div className="mb-3.5 flex items-center justify-between">
              <div className="section-title mb-0">Active job posts</div>
              <span className="cursor-pointer text-xs font-semibold text-brand" onClick={() => go("applications")}>View all →</span>
            </div>
            <div className="card overflow-hidden">
              {seedJobs.map((job) => (
                <div key={job.id} className="flex cursor-pointer items-center gap-4 border-b border-border px-5 py-4" onClick={() => go("applications", { jobId: job.id })}>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag><span className="text-xs text-muted">{job.postedAt}</span></div>
                    <div className="text-[15px] font-semibold">{job.title}</div>
                    <div className="text-xs text-muted">{job.school} - {job.date} - £{job.rate}/day</div>
                  </div>
                  <div className="text-center"><div className="font-serif text-[22px] text-brand">{job.applicants}</div><div className="text-xs text-muted">Applicants</div></div>
                </div>
              ))}
            </div>
            <div className="section-title mt-7">Recent activity</div>
            <div className="card card-pad">
              {[
                "Sarah Johnson applied to Y6 Maths cover",
                "Priya Mehta accepted the interview invitation",
                "Marcus Webb sent a message",
                "Invoice #INV-2041 generated",
              ].map((entry) => (
                <div key={entry} className="flex items-center justify-between border-b border-border py-2.5">
                  <div>{entry}</div>
                  <div className="text-xs text-muted">Today</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="section-title">Top matches today</div>
            <div className="card overflow-hidden">
              {seedTeachers.slice(0, 4).map((teacher, index) => (
                <div key={teacher.id} className="flex cursor-pointer items-center gap-2.5 border-b px-3.5 py-3" style={{ borderBottomColor: index < 3 ? "var(--border)" : "transparent" }} onClick={() => go("teacher-profile", { teacherId: teacher.id })}>
                  <Avatar name={teacher.name} tone={teacher.tone} />
                  <div className="flex-1"><div className="font-medium">{teacher.name}</div><div className="text-xs text-muted">{teacher.role}</div></div>
                  <MatchScore score={teacher.matchScore} size={38} />
                </div>
              ))}
            </div>
            <div className="section-title mt-7">Quick actions</div>
            <div className="card card-pad flex flex-col gap-2">
              <Btn icon="plus" className="justify-start" onClick={() => go("post-job")}>Post a job</Btn>
              <Btn variant="secondary" icon="search" className="justify-start" onClick={() => go("find-teachers")}>Browse teachers</Btn>
              <Btn variant="secondary" icon="message" className="justify-start" onClick={() => go("messaging")}>Open messages</Btn>
              <Btn variant="secondary" icon="file" className="justify-start" onClick={() => go("billing")}>View invoices</Btn>
            </div>
            <div className="section-title mt-7">Your plan</div>
            <div className="card card-pad border-brand bg-brand-tint">
              <Tag>Pro - Active</Tag>
              <div className="mt-2.5 font-serif text-[22px]">£99 / month</div>
              <div className="mt-1 text-xs text-muted">Renews 24 Apr 2026</div>
              <div className="progress mt-3.5"><div className="progress-fill" style={{ width: "58%" }} /></div>
              <Btn variant="ink" size="sm" className="mt-3.5 w-full" onClick={() => go("billing")}>Manage plan</Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
