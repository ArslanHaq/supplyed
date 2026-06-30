import { useState } from "react";

import { seedTeachers } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Checkbox, Chip, Field, Icon, MatchScore, Stars, Tag, VerifyBadge } from "../atoms";
import { PageHead } from "../molecules";

export function FindTeachersPage({ go, toast }: Pick<RouteProps, "go" | "toast">) {
  const [query, setQuery] = useState("");
  const results = seedTeachers.filter((teacher) => teacher.name.toLowerCase().includes(query.toLowerCase()) || teacher.role.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-page">
      <PageHead title="Find teachers" subtitle="Browse the full teacher network. Filter, shortlist, invite." actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>} />
      <div className="three-panel">
        <div className="card card-pad self-start">
          <div className="label-xs mb-3">Filters</div>
          <Field label="Key stage"><div className="flex flex-wrap gap-1.5">{["KS1", "KS2", "KS3", "KS4", "KS5"].map((item, index) => <Chip key={item} active={index === 1 || index === 2}>{item}</Chip>)}</div></Field>
          <Field label="Subject"><select className="select"><option>All subjects</option><option>Maths</option><option>English</option><option>Science</option></select></Field>
          <div className="flex flex-col gap-2"><Checkbox checked onChange={() => {}} label="DBS verified only" /><Checkbox checked={false} onChange={() => {}} label="QTS qualified" /><Checkbox checked={false} onChange={() => {}} label="Available today" /></div>
        </div>
        <div>
          <div className="mb-[18px] flex items-center gap-2.5">
            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-white px-3.5 py-2.5"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, subject, school..." className="flex-1 border-0 bg-transparent outline-none" /></div>
            <select className="select w-[180px]"><option>Sort: Best match</option><option>Sort: Rating</option></select>
          </div>
          <div className="flex flex-col gap-3">
            {results.map((teacher) => (
              <div key={teacher.id} className="card card-pad flex cursor-pointer flex-wrap items-center gap-5" onClick={() => go("teacher-profile", { teacherId: teacher.id })}>
                <Avatar name={teacher.name} size="lg" tone={teacher.tone} />
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2"><div className="font-serif text-lg">{teacher.name}</div>{teacher.dbs ? <VerifyBadge /> : null}{teacher.qts ? <Tag tone="ghost">QTS</Tag> : null}</div>
                  <div className="text-[15px] text-[var(--muted)]">{teacher.role}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs"><div className="flex items-center gap-1 text-[var(--muted)]"><Icon name="pin" size={12} />{teacher.city} - {teacher.distance}</div><div className="flex items-center gap-1"><Stars rating={teacher.rating} />{teacher.rating} ({teacher.reviews})</div><div className="flex items-center gap-1 text-[var(--muted)]"><Icon name="clock" size={12} />Available {teacher.availability}</div></div>
                </div>
                <div className="text-center"><div className="font-serif text-lg">£{teacher.rate}</div><div className="text-xs text-[var(--muted)]">per day</div></div>
                <MatchScore score={teacher.matchScore} />
                <div className="flex flex-col gap-1.5"><Btn size="sm" onClick={(event) => { event.stopPropagation(); toast({ title: "Invited", msg: `${teacher.name} has been invited to apply.` }); }}>Invite</Btn><Btn variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); go("messaging"); }}>Message</Btn></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
