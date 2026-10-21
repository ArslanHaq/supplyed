import type { ReactNode } from "react";

import { richTextToPlainText } from "@/features/applications/rich-text";
import type { Job } from "@/features/jobs/types";
import { formatPlannedUnits } from "@/features/jobs/work-units";

import { Avatar, Icon, Tag } from "../atoms";

type PreviewTone = "" | "amber" | "ghost" | "green" | "purple" | "red";

export type JobListingPreviewData = {
  date: string;
  description: string;
  experience?: string;
  keyStages: string[];
  listingDetails?: string[];
  location: string;
  mode: "brief" | "instant";
  pay: string;
  plannedWork?: string;
  postedAt?: string;
  schoolImageUrl?: string | null;
  schoolName: string;
  skills: string[];
  status?: { label: string; tone: PreviewTone };
  subjects: string[];
  title: string;
  urgent?: boolean;
};

export function JobListingPreview({
  action,
  data,
  match,
  onOpen,
}: {
  action?: ReactNode;
  data: JobListingPreviewData;
  match?: ReactNode;
  onOpen?: () => void;
}) {
  const tags = [...data.keyStages, ...data.subjects];
  const visibleSkills = data.skills.slice(0, 4);

  return (
    <article className="job-listing-preview overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-xs)">
      <div className="p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={data.schoolName} size="sm" src={data.schoolImageUrl} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{data.schoolName}</div>
              {data.postedAt ? <div className="text-xs text-muted">Posted {data.postedAt}</div> : <div className="text-xs text-muted">Hiring school</div>}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {data.status ? <Tag tone={data.status.tone}>{data.status.label}</Tag> : null}
            <Tag tone={data.mode === "brief" ? "purple" : ""}>{data.mode === "brief" ? "Open brief" : "Instant matching"}</Tag>
            {data.urgent ? <Tag tone="red">Urgent</Tag> : null}
          </div>
        </header>

        <div className="mt-5">
          {onOpen ? (
            <button className="text-left font-heading text-[22px] leading-tight text-ink hover:text-brand" onClick={onOpen} type="button">{data.title}</button>
          ) : (
            <h3 className="font-heading text-[22px] leading-tight text-ink">{data.title}</h3>
          )}
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{data.description || "Role details will appear here as you complete the form."}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <PreviewFact icon="pin" label="Location" value={data.location} />
          <PreviewFact icon="calendar" label="Placement" value={data.date} />
          <PreviewFact icon="pound" label="Pay" value={data.pay} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag, index) => <Tag key={`topic-${index}-${tag}`} tone="ghost">{tag}</Tag>)}
          {data.plannedWork ? <Tag tone="ghost">{data.plannedWork}</Tag> : null}
          {data.experience ? <Tag tone="ghost">{data.experience}</Tag> : null}
          {visibleSkills.map((skill, index) => <Tag key={`skill-${index}-${skill}`} tone="ghost">{skill}</Tag>)}
          {data.skills.length > visibleSkills.length ? <Tag tone="ghost">+{data.skills.length - visibleSkills.length} more</Tag> : null}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-chalk/60 px-5 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {(data.listingDetails ?? []).map((detail) => <span key={detail}>{detail}</span>)}
        </div>
        {action}
      </footer>
      {match ? <div className="border-t border-border p-4 sm:px-6">{match}</div> : null}
    </article>
  );
}

function PreviewFact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-chalk/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"><Icon name={icon} size={13} />{label}</div>
      <div className="mt-1 break-words text-sm font-semibold leading-5 text-ink">{value}</div>
    </div>
  );
}

export function jobListingPreviewData(
  job: Job,
  status?: JobListingPreviewData["status"],
): JobListingPreviewData {
  const location = [job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC";
  const pay = job.rate > 0
    ? `£${job.rate}${job.payType === "hourly" ? "/hr" : job.payType === "fixed" ? " fixed" : "/day"}`
    : "Rate TBC";
  const description = richTextToPlainText(job.description ?? "")
    .split(/\r?\n/)
    .filter((line) => !/^(Posting route:|Marked urgent by|QTS requested\.)/i.test(line.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    date: previewDateRange(job.startDate, job.endDate),
    description,
    experience: job.minExperienceYears != null ? `${job.minExperienceYears}+ years experience` : undefined,
    keyStages: job.keyStages?.length ? job.keyStages : job.keyStage ? [job.keyStage] : [],
    listingDetails: [
      job.liveFrom ? `Opens ${previewListingDate(job.liveFrom)}` : "Open now",
      ...(job.expiresAt ? [`Applications close ${previewListingDate(job.expiresAt, true)}`] : []),
    ],
    location,
    mode: job.mode,
    pay,
    plannedWork: job.hours != null || job.days != null ? formatPlannedUnits(job) : undefined,
    postedAt: job.postedAt,
    schoolImageUrl: job.institution?.imageUrl,
    schoolName: job.school,
    skills: job.requiredSkills,
    status,
    subjects: job.subjects?.length ? job.subjects : job.subject ? [job.subject] : [],
    title: job.title,
    urgent: job.urgent,
  };
}

export function previewDateRange(start?: string | null, end?: string | null) {
  const format = (value?: string | null) => {
    if (!value || !Number.isFinite(Date.parse(value))) return "Date TBC";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: value.includes("T") ? "2-digit" : undefined,
      minute: value.includes("T") ? "2-digit" : undefined,
      timeZone: "Europe/London",
    }).format(new Date(value));
  };
  const first = format(start);
  const last = format(end);
  return !end || first === last ? first : `${first} – ${last}`;
}

function previewListingDate(value: string, inclusiveEnd = false) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Date TBC";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(inclusiveEnd ? timestamp - 1 : timestamp));
}
