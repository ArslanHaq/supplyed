import { useState } from "react";

import { seedJobs } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, MatchScore, Tag } from "../atoms";
import { Modal } from "../molecules";

export function JobDetailPage({ ctx, go, toast, role }: Pick<RouteProps, "ctx" | "go" | "toast" | "role">) {
  const job = seedJobs.find((item) => item.id === (ctx.jobId || "j-101")) || seedJobs[0];
  const [open, setOpen] = useState(false);

  return (
    <div className="app-page">
      <div className="two-col">
        <div>
          <div className="mb-3.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent - act fast</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant matching" : "Open brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><Tag tone="ghost">{job.subject}</Tag></div>
          <h1 className="mb-2.5 font-serif text-[38px] leading-tight">{job.title}</h1>
          <div className="mb-6 flex flex-wrap gap-4"><div className="flex items-center gap-1.5"><Icon name="building" size={14} />{job.school}</div><div className="flex items-center gap-1.5"><Icon name="pin" size={14} />{job.city}</div><div className="flex items-center gap-1.5"><Icon name="clock" size={14} />Posted {job.postedAt}</div></div>
          <div className="grid-3 mb-7">
            <div className="card card-pad text-center"><div className="text-xs text-muted">Day rate</div><div className="font-serif text-[26px] text-brand">£{job.rate}</div></div>
            <div className="card card-pad text-center"><div className="text-xs text-muted">Duration</div><div className="font-serif text-xl">1 Day</div></div>
            <div className="card card-pad text-center"><div className="text-xs text-muted">Match score</div><div className="mt-1.5 flex justify-center"><MatchScore score={job.matchScore} /></div></div>
          </div>
          <div className="card card-pad-lg mb-5"><div className="section-title">About this role</div><p className="leading-[1.7]">{job.description || "School-provided role details will appear here once published."}</p></div>
          <div className="card card-pad-lg"><div className="section-title">Requirements</div>{["Enhanced DBS certificate", "QTS not required", "Subject: Maths", "Available from 08:20 tomorrow"].map((item) => <div key={item} className="flex items-center gap-2.5 py-2"><Icon name="checkCircle" size={16} />{item}</div>)}</div>
        </div>
        <div className="card card-pad-lg sticky top-[88px] self-start">
          <div className="mb-3.5 flex items-center justify-between"><div><div className="text-xs text-muted">Day rate</div><div className="font-serif text-[28px]">£{job.rate}</div></div><MatchScore score={job.matchScore} /></div>
          <div className="mb-3.5 flex flex-wrap gap-2"><span className="pill">{job.keyStage}</span><span className="pill">{job.subject}</span><span className="pill">{job.date}</span></div>
          <Btn className="w-full" size="lg" onClick={() => setOpen(true)}>{role === "teacher" ? (job.mode === "instant" ? "Accept job" : "Apply now") : "Invite candidates"}</Btn>
          <Btn variant="secondary" className="mt-2 w-full" onClick={() => go("messaging")}>Message school</Btn>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="card-pad-lg">
          <div className="mb-2 font-serif text-[26px]">{role === "teacher" ? "Apply to this role" : "Invite candidates"}</div>
          <Field label="Message"><textarea className="textarea" defaultValue="Hi, I'm available and happy to arrive by 08:15. I have strong KS2 Maths cover experience." /></Field>
          <div className="flex items-center justify-between"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={() => { setOpen(false); toast({ title: "Success", msg: role === "teacher" ? "Application submitted." : "Top candidates invited." }); }}>Confirm</Btn></div>
        </div>
      </Modal>
    </div>
  );
}
