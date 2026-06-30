import { useState } from "react";

import { seedApplications, seedJobs, seedTeachers } from "@/data/supplyed";
import type { ApplicationStage, RouteProps } from "@/types/supplyed";

import { Avatar, Btn, MatchScore, Tag } from "../atoms";
import { PageHead } from "../molecules";

export function ApplicationsPage({ go, ctx }: Pick<RouteProps, "go" | "ctx">) {
  const jobId = ctx.jobId || "j-101";
  const job = seedJobs.find((item) => item.id === jobId) || seedJobs[0];
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const apps = seedApplications
    .filter((application) => application.jobId === job.id)
    .flatMap((application) => {
      const teacher = seedTeachers.find((item) => item.id === application.teacherId);
      return teacher ? [{ ...application, teacher }] : [];
    });
  const stages: ApplicationStage[] = ["applied", "shortlisted", "interview", "hired"];

  return (
    <div className="app-page">
      <PageHead title={job.title} subtitle={`${job.school} - ${job.date} - £${job.rate}/day - ${apps.length} applications`} actions={<><Btn variant="secondary" size="sm">Message all</Btn><Btn variant="secondary" size="sm">Edit job</Btn><Btn size="sm">Close position</Btn></>} />
      <div className="card card-pad mb-6 flex flex-wrap items-center gap-5">
        <div className="flex gap-2">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode}</Tag></div>
        <div><div className="text-xs text-muted">Applicants</div><div className="font-serif text-[22px]">{apps.length}</div></div>
        <div><div className="text-xs text-muted">Shortlisted</div><div className="font-serif text-[22px]">{apps.filter((item) => item.stage === "shortlisted").length}</div></div>
        <div className="ml-auto flex gap-1.5"><Btn variant={view === "kanban" ? "secondary" : "ghost"} size="sm" icon="grid" onClick={() => setView("kanban")}>Kanban</Btn><Btn variant={view === "list" ? "secondary" : "ghost"} size="sm" icon="list" onClick={() => setView("list")}>List</Btn></div>
      </div>
      {view === "kanban" ? (
        <div className="kanban">
          {stages.map((stage) => (
            <div key={stage} className="kanban-col">
              <div className="kanban-head"><div className="label-xs">{stage}</div><div className="pill">{apps.filter((item) => item.stage === stage).length}</div></div>
              {apps.filter((item) => item.stage === stage).map((application) => (
                <div key={application.id} className="kanban-card" onClick={() => go("teacher-profile", { teacherId: application.teacher.id })}>
                  <div className="mb-2 flex items-center gap-2"><Avatar name={application.teacher.name} size="sm" tone={application.teacher.tone} /><div className="flex-1"><div className="font-medium">{application.teacher.name}</div><div className="text-xs text-muted">{application.teacher.role}</div></div><MatchScore score={application.teacher.matchScore} size={32} /></div>
                  <div className="mb-2 text-xs text-muted">{`"${application.coverLetter.slice(0, 72)}..."`}</div>
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold text-brand">£{application.rate}/day</span><span className="text-xs text-muted">{application.appliedAt}</span></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Teacher</th><th>Rate</th><th>Match</th><th>Stage</th><th>Applied</th></tr></thead>
            <tbody>
              {apps.map((application) => (
                <tr key={application.id}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={application.teacher.name} size="sm" tone={application.teacher.tone} /><div><div className="font-medium">{application.teacher.name}</div><div className="text-xs text-muted">{application.teacher.role}</div></div></div></td>
                  <td>£{application.rate}</td>
                  <td><MatchScore score={application.teacher.matchScore} size={36} /></td>
                  <td><Tag tone={application.stage === "interview" ? "purple" : application.stage === "shortlisted" ? "" : "ghost"}>{application.stage}</Tag></td>
                  <td>{application.appliedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
