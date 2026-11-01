import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import { Icon, Tag, buttonClassName } from "@/components/atoms";
import { FormattedJobDescription } from "@/components/molecules";
import { PublicHeader } from "@/components/organisms/PublicHeader";
import { PublicJobShareButton } from "@/components/organisms/PublicJobShareButton";
import { getJob } from "@/features/jobs/queries";
import type { Job } from "@/features/jobs/types";
import { getJobVisibilityLabel } from "@/features/jobs/listing-window";
import { formatPlannedUnits } from "@/features/jobs/work-units";
import { siteConfig } from "@/lib/seo";

type PublicJobPageProps = { params: Promise<{ id: string }> };

const loadPublicJob = cache(getJob);

function publicJob(job: Job | null) {
  return job && getJobVisibilityLabel(job) === "live" ? job : null;
}

export async function generateMetadata({ params }: PublicJobPageProps): Promise<Metadata> {
  const { id } = await params;
  const job = publicJob(await loadPublicJob(id));

  if (!job) return { title: "Job not available", robots: { index: false, follow: false } };

  const description = `${job.subject} teaching role at ${job.school} in ${job.city}. ${job.date}.`;
  const path = `/jobs/${encodeURIComponent(job.id)}`;

  return {
    title: job.title,
    description,
    alternates: { canonical: path },
    openGraph: { description, siteName: siteConfig.name, title: job.title, type: "website", url: path },
    twitter: { card: "summary", description, title: job.title },
  };
}

export default async function PublicJobPage({ params }: PublicJobPageProps) {
  const { id } = await params;
  const job = publicJob(await loadPublicJob(id));
  if (!job) notFound();

  const subjects = job.subjects?.length ? job.subjects : [job.subject];
  const location = [job.address, job.city, job.county, job.postalCode].filter((part, index, all): part is string => Boolean(part && all.indexOf(part) === index)).join(", ");

  return (
    <div className="marketing-page min-h-screen">
      <PublicHeader />
      <main className="bg-chalk py-10 sm:py-14">
        <div className="mx-auto w-[calc(100%_-_2rem)] max-w-[1120px]">
          <section className="card overflow-hidden">
            <header className="border-b border-border bg-surface px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Tag tone="green">Open role</Tag>
                    <Tag tone={job.jobType === "INSTANT" ? "amber" : "purple"}>{job.jobType === "INSTANT" ? "Instant job" : "Brief job"}</Tag>
                  </div>
                  <p className="text-sm font-semibold text-brand">{job.school}</p>
                  <h1 className="mt-2 font-heading text-3xl leading-tight text-ink sm:text-4xl">{job.title}</h1>
                  <p className="mt-3 text-sm text-muted">{subjects.join(", ")}</p>
                </div>
                <PublicJobShareButton />
              </div>
            </header>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-8 p-5 sm:p-8">
                <section>
                  <h2 className="mb-4 font-heading text-xl text-ink">About the role</h2>
                  <FormattedJobDescription description={job.description ?? ""} />
                </section>

                {job.requiredSkills.length || job.keyStages?.length ? (
                  <section className="border-t border-border pt-7">
                    <h2 className="mb-4 font-heading text-xl text-ink">Role requirements</h2>
                    <div className="flex flex-wrap gap-2">
                      {job.keyStages?.map((stage) => <Tag key={`stage-${stage}`} tone="ghost">{stage}</Tag>)}
                      {job.requiredSkills.map((skill) => <Tag key={`skill-${skill}`} tone="ghost">{skill}</Tag>)}
                    </div>
                  </section>
                ) : null}

                {job.parkingInfo ? (
                  <section className="border-t border-border pt-7">
                    <h2 className="mb-3 font-heading text-xl text-ink">Travel and parking</h2>
                    <p className="text-sm leading-6 text-muted">{job.parkingInfo}</p>
                  </section>
                ) : null}
              </div>

              <aside className="border-t border-border bg-surface-2 p-5 sm:p-7 lg:border-l lg:border-t-0">
                <h2 className="font-heading text-lg text-ink">Job details</h2>
                <dl className="mt-5 space-y-5">
                  <JobFact icon="pin" label="Location" value={location || "Location to be confirmed"} />
                  <JobFact icon="calendar" label="Placement dates" value={formatDateRange(job.startDate, job.endDate)} />
                  <JobFact icon="pound" label="Pay" value={formatPay(job)} />
                  <JobFact icon="clock" label="Planned work" value={formatPlannedUnits(job)} />
                  <JobFact icon="award" label="Experience" value={formatExperience(job.minExperienceYears)} />
                </dl>

                <div className="mt-7 border-t border-border pt-6">
                  <p className="text-sm font-semibold text-ink">Interested in this role?</p>
                  <p className="mt-2 text-xs leading-5 text-muted">Sign in to view your match and apply through SupplyED.</p>
                  <Link className={buttonClassName({ className: "mt-4 w-full" })} href="/login">
                    Log in to SupplyED
                  </Link>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function JobFact({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-brand"><Icon name={icon} size={17} /></span>
      <div>
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="mt-1 text-sm font-semibold leading-5 text-ink">{value}</dd>
      </div>
    </div>
  );
}

function formatDateRange(startDate?: string | null, endDate?: string | null) {
  const format = (value?: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value)) : null;
  const start = format(startDate);
  const end = format(endDate);
  if (start && end && start !== end) return `${start} – ${end}`;
  return start ?? end ?? "Dates to be confirmed";
}

function formatPay(job: Pick<Job, "payAmount" | "payType">) {
  if (!job.payAmount || job.payAmount <= 0) return "Pay to be confirmed";
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(job.payAmount);
  if (job.payType === "hourly") return `${amount}/hr`;
  if (job.payType === "daily") return `${amount}/day`;
  return `${amount} fixed`;
}

function formatExperience(years?: number | null) {
  if (!years) return "No minimum specified";
  return `${years} ${years === 1 ? "year" : "years"} minimum`;
}
