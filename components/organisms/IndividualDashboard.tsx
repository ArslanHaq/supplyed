import { seedTeachers } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stat, Tag, VerifyBadge } from "../atoms";
import { PageHead } from "../molecules";

const learnerRequests = [
  {
    id: "lr-1",
    learner: "Learner 1",
    subject: "KS2 Maths",
    format: "In person",
    schedule: "Weekday evenings",
    budget: "£25-£40/hr",
    status: "Matching",
  },
  {
    id: "lr-2",
    learner: "Learner 2",
    subject: "KS3 English",
    format: "Online",
    schedule: "Weekends",
    budget: "Flexible",
    status: "Draft",
  },
];

export function IndividualDashboard({ go, toast }: Pick<RouteProps, "go" | "toast">) {
  return (
    <div className="app-page">
      <PageHead
        title="Welcome, Aisha"
        subtitle="2 learner requests - 4 verified teacher matches - next reply due today"
        actions={
          <>
            <Btn variant="secondary" icon="message" onClick={() => go("messaging")}>
              Messages
            </Btn>
            <Btn icon="search" onClick={() => go("find-teachers")}>
              Find teachers
            </Btn>
          </>
        }
      />

      <div className="grid-4 mb-7">
        <Stat value="2" label="Learner requests" delta="1 active" />
        <Stat value="4" label="Verified matches" delta="DBS checked" />
        <Stat value="3" label="Messages" delta="1 unread" />
        <Stat value="100%" label="Safety setup" delta="Account-led contact" />
      </div>

      <div className="two-col">
        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <div className="section-title mb-0">Learner requests</div>
            <button className="cursor-pointer text-xs font-semibold text-[var(--se)]" type="button">
              New request
            </button>
          </div>
          <div className="card overflow-hidden">
            {learnerRequests.map((request, index) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center gap-4 border-b border-[var(--border)] px-5 py-4 last:border-b-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--se-tint)] text-[var(--se)]">
                  <Icon name="heart" size={18} />
                </div>
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{request.subject}</div>
                    <Tag tone={index === 0 ? "green" : "ghost"}>{request.status}</Tag>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {request.learner} - {request.format} - {request.schedule} - {request.budget}
                  </div>
                </div>
                <Btn variant="secondary" size="sm" onClick={() => go("find-teachers")}>
                  View matches
                </Btn>
              </div>
            ))}
          </div>

          <div className="section-title mt-7">Recommended verified teachers</div>
          <div className="flex flex-col gap-3">
            {seedTeachers.slice(0, 3).map((teacher) => (
              <div key={teacher.id} className="card card-pad flex cursor-pointer flex-wrap items-center gap-4" onClick={() => go("teacher-profile", { teacherId: teacher.id })}>
                <Avatar name={teacher.name} tone={teacher.tone} />
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{teacher.name}</div>
                    {teacher.dbs ? <VerifyBadge /> : null}
                    {teacher.qts ? <Tag tone="ghost">QTS</Tag> : null}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {teacher.role} - {teacher.city} - Available {teacher.availability}
                  </div>
                </div>
                <MatchScore score={teacher.matchScore} size={40} />
                <Btn
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    toast({ title: "Request sent", msg: `${teacher.name} has received your availability request.` });
                  }}
                >
                  Request
                </Btn>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title">Safeguarding</div>
          <div className="card card-pad border-[var(--se)] bg-[var(--se-tint)]">
            <Tag tone="green">Verified teachers only</Tag>
            <div className="mt-3 font-serif text-[24px]">Documents stay private</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Hirers see verification badges. Admin keeps DBS, identity, and right-to-work documents restricted.
            </p>
            <div className="mt-4 space-y-2">
              {["Account-led messaging", "No learner account required", "Location shared after accepted request"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <Icon name="checkCircle" size={15} className="text-[var(--se)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-title mt-7">Quick actions</div>
          <div className="card card-pad flex flex-col gap-2">
            <Btn icon="search" className="justify-start" onClick={() => go("find-teachers")}>
              Browse teachers
            </Btn>
            <Btn variant="secondary" icon="message" className="justify-start" onClick={() => go("messaging")}>
              Open messages
            </Btn>
            <Btn variant="secondary" icon="calendar" className="justify-start">
              Review schedule
            </Btn>
            <Btn variant="secondary" icon="file" className="justify-start" onClick={() => go("billing")}>
              Payment settings
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
