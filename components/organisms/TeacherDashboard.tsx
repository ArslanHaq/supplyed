import { seedJobs, seedMessages } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stat, Tag } from "../atoms";
import { PageHead } from "../molecules";

export function TeacherDashboard({ go }: Pick<RouteProps, "go">) {
  return (
    <div className="app-page">
      <PageHead title="Morning, Sarah" subtitle="Tuesday, 24 March 2026 - 3 new job matches - 1 booking confirmed" actions={<><Btn variant="secondary" icon="calendar" onClick={() => go("calendar")}>My calendar</Btn><Btn icon="search" onClick={() => go("find-jobs")}>Find jobs</Btn></>} />
      <div className="grid-4 mb-7">
        <Stat value="£3,240" label="Earned this month" delta="+£185 yesterday" />
        <Stat value="12" label="Days booked" delta="3 this week" />
        <Stat value="4.9★" label="Average rating" delta="47 reviews" />
        <Stat value="92%" label="Profile strength" delta="Upload QTS to reach 100%" />
      </div>
      <div className="two-col">
        <div>
          <div className="section-title">Up next</div>
          <div className="card card-pad-lg mb-7 bg-gradient-to-br from-[#008CC4] to-[#006E9A] text-white">
            <div className="mb-3.5 flex items-center justify-between"><Tag className="bg-white/20 text-white">Confirmed</Tag><span className="text-xs opacity-80">Tomorrow - 08:20 arrival</span></div>
            <div className="mb-2 font-serif text-[26px]">Y6 Maths Cover - Full day</div>
            <div className="mb-4 text-[15px] opacity-90">Greenfield Primary - Salford - M5 4AZ</div>
            <div className="flex flex-wrap gap-4"><div><div className="text-xs opacity-70">Earnings</div><div className="font-serif text-[22px]">£180</div></div><div><div className="text-xs opacity-70">Hours</div><div className="font-serif text-[22px]">6.5h</div></div><div><div className="text-xs opacity-70">Key stage</div><div className="font-serif text-[22px]">KS2</div></div></div>
          </div>
          <div className="section-title">Recommended for you</div>
          <div className="flex flex-col gap-3">
            {seedJobs.map((job) => (
              <div key={job.id} className="card card-pad flex cursor-pointer flex-wrap items-center gap-4" onClick={() => go("job-detail", { jobId: job.id })}>
                <div className="flex-1"><div className="mb-0.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone="ghost">{job.keyStage}</Tag><Tag tone="ghost">{job.subject}</Tag></div><div className="text-[15px] font-semibold">{job.title}</div><div className="text-xs text-[var(--muted)]">{job.school} - {job.city} - {job.date}</div></div>
                <div className="text-right"><div className="font-serif text-lg">£{job.rate}</div><div className="text-xs text-[var(--muted)]">per day</div></div>
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
              <div key={item} className="flex items-center gap-2 py-1.5"><Icon name={index < 2 ? "checkCircle" : "plus"} size={14} /><span className={index < 2 ? "text-sm text-[var(--muted)]" : "text-sm"}>{item}</span></div>
            ))}
          </div>
          <div className="section-title mt-7">Messages</div>
          <div className="card overflow-hidden">
            {seedMessages.map((message, index) => (
              <div key={message.id} className="msg-list-item" style={{ borderBottom: index < seedMessages.length - 1 ? "0.5px solid var(--border)" : "none" }} onClick={() => go("messaging")}>
                <Avatar name={message.with} size="sm" tone={message.tone} />
                <div className="flex-1"><div className="font-medium">{message.with}</div><div className="text-xs text-[var(--muted)]">{message.lastMsg}</div></div>
                {message.unread ? <Tag>{message.unread}</Tag> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
