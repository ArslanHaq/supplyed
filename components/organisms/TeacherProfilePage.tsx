import { seedTeachers } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stars, Tag, VerifyBadge } from "../atoms";

export function TeacherProfilePage({ ctx, go }: Pick<RouteProps, "ctx" | "go">) {
  const teacher = seedTeachers.find((item) => item.id === (ctx.teacherId || "t-sarah")) || seedTeachers[0];

  return (
    <div className="app-page">
      <div className="two-col">
        <div>
          <div className="card card-pad-lg mb-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={teacher.name} size="lg" tone={teacher.tone} />
              <div className="flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2"><h1 className="font-serif text-[32px]">{teacher.name}</h1>{teacher.dbs ? <VerifyBadge /> : null}{teacher.qts ? <Tag tone="ghost">QTS</Tag> : null}</div>
                <div className="text-[15px] text-[var(--muted)]">{teacher.role}</div>
                <div className="mt-3 flex flex-wrap gap-4"><div className="flex items-center gap-1"><Icon name="pin" size={12} />{teacher.city}</div><div className="flex items-center gap-1"><Stars rating={teacher.rating} />{teacher.rating} ({teacher.reviews})</div><div className="flex items-center gap-1"><Icon name="clock" size={12} />Available {teacher.availability}</div></div>
              </div>
              <MatchScore score={teacher.matchScore} />
            </div>
          </div>
          <div className="card card-pad-lg mb-5"><div className="section-title">About</div><p className="leading-[1.7]">Enthusiastic and experienced supply teacher specialising in KS2 and KS3 Mathematics. Structured but engaging approach to lessons, always comes prepared. Experienced with SEN students.</p></div>
          <div className="card card-pad-lg"><div className="section-title">Subjects & stages</div><div className="flex flex-wrap gap-2">{teacher.subjects.map((subject) => <span className="pill" key={subject}>{subject}</span>)}{teacher.keyStages.map((stage) => <span className="pill" key={stage}>{stage}</span>)}</div></div>
        </div>
        <div>
          <div className="card card-pad-lg"><div className="font-serif text-[26px]">£{teacher.rate}</div><div className="text-xs text-[var(--muted)]">per day</div><div className="section-title mt-5">Quick actions</div><div className="flex flex-col gap-2"><Btn onClick={() => go("messaging")}>Message</Btn><Btn variant="secondary">Invite to job</Btn><Btn variant="secondary">Download CV</Btn></div></div>
        </div>
      </div>
    </div>
  );
}
