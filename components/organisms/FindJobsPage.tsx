import { useState } from "react";

import { seedJobs } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, MatchScore, Tag } from "../atoms";
import { SelectDropdown } from "../molecules/OptionDropdowns";
import { PageHead } from "../molecules";

export function FindJobsPage({ go }: Pick<RouteProps, "go">) {
  const [urgency, setUrgency] = useState("All jobs");
  const [keyStage, setKeyStage] = useState("All stages");
  const [subject, setSubject] = useState("All subjects");
  const jobs = seedJobs.filter((job) => {
    const matchesUrgency = urgency === "All jobs" || job.urgent;
    const matchesStage = keyStage === "All stages" || job.keyStage === keyStage;
    const matchesSubject = subject === "All subjects" || job.subject === subject;

    return matchesUrgency && matchesStage && matchesSubject;
  });

  return (
    <div className="app-page">
      <PageHead title="Find jobs" subtitle={`${seedJobs.length} open roles near you - ranked by match score`} />
      <div className="mb-5 grid gap-3 rounded-xl border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-xs)] md:grid-cols-3">
        <Field label="Role type">
          <SelectDropdown
            options={["All jobs", "Urgent only"]}
            value={urgency}
            onChange={setUrgency}
          />
        </Field>
        <Field label="Key stage">
          <SelectDropdown
            options={["All stages", "KS1", "KS2", "KS3", "KS4", "KS5"]}
            value={keyStage}
            onChange={setKeyStage}
          />
        </Field>
        <Field label="Subject">
          <SelectDropdown
            options={["All subjects", "Maths", "English", "Science", "All Primary"]}
            value={subject}
            onChange={setSubject}
          />
        </Field>
      </div>
      <div className="two-col">
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div key={job.id} className="card card-pad-lg flex cursor-pointer flex-wrap items-center gap-5" onClick={() => go("job-detail", { jobId: job.id })}>
              <div className="flex-1">
                <div className="mb-1.5 flex flex-wrap gap-1.5">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><span className="text-xs text-[var(--muted)]">Posted {job.postedAt}</span></div>
                <div className="mb-1 font-serif text-xl">{job.title}</div>
                <div className="mb-3 text-[15px] text-[var(--muted)]">{job.school} - {job.city} - {job.date}</div>
                <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]"><div className="flex items-center gap-1"><Icon name="pound" size={12} />£{job.rate}/day</div><div className="flex items-center gap-1"><Icon name="users" size={12} />{job.applicants} applied</div><div className="flex items-center gap-1"><Icon name="pin" size={12} />4.2 mi</div></div>
              </div>
              <div className="flex flex-col items-end gap-2.5"><MatchScore score={job.matchScore} /><Btn size="sm">{job.mode === "instant" ? "Accept" : "Apply"}</Btn></div>
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <div className="eyebrow mb-2.5">Map view</div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-gradient-to-br from-[var(--se-tint)] to-[var(--chalk)]">
            {[[30, 25], [55, 40], [40, 65], [70, 55]].map(([x, y], index) => (
              <div key={index} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${x}%`, top: `${y}%` }}>
                <div className="flex h-[26px] w-[26px] -rotate-45 items-center justify-center rounded-[50%_50%_50%_0] text-[9px] font-bold text-white" style={{ background: index === 0 ? "var(--red)" : "var(--se)" }}><span className="rotate-45">£{seedJobs[index].rate}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
