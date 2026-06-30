import type { Metadata } from "next";
import Link from "next/link";

import { PublicThemeControls } from "@/components/molecules";
import { PublicHeader } from "@/components/organisms/PublicHeader";
import { buttonClassName, Icon, Tag } from "@/components/atoms";

export const metadata: Metadata = {
  title: "How It Works",
  description: "A dummy end-to-end overview of how schools and supply teachers use SupplyED.",
  alternates: {
    canonical: "/how-it-works",
  },
};

const schoolSteps = [
  ["Post the role", "Add date, subject, rate, urgency, and compliance requirements."],
  ["Review ranked matches", "SupplyED highlights available teachers based on profile fit and proximity."],
  ["Message and confirm", "Schools contact preferred teachers, agree details, and keep a booking record."],
];

const teacherSteps = [
  ["Create a profile", "Teachers add subjects, stages, experience, availability, and verification details."],
  ["Receive matching jobs", "Relevant roles appear by urgency, distance, rate, and subject fit."],
  ["Accept or propose", "Teachers can accept instant cover or apply to longer-term briefs."],
];

const workflow = [
  { label: "Account", icon: "user", copy: "Schools and teachers choose their path at signup." },
  { label: "Compliance", icon: "shield", copy: "DBS, right-to-work, identity, and safeguarding details are captured." },
  { label: "Matching", icon: "search", copy: "Dummy matching ranks staff and roles using profile fit and availability." },
  { label: "Booking", icon: "calendar", copy: "Messages, booking notes, and next actions stay in one workspace." },
];

const metrics = [
  ["2 min", "to post urgent cover"],
  ["94%", "dummy same-day fill rate"],
  ["8.4k", "example verified teachers"],
  ["4.9", "average teacher rating"],
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--chalk)]">
      <PublicHeader active="how-it-works" />

      <main>
        <section className="bg-[#0a0a0a] px-4 py-16 text-white sm:px-6 lg:px-12 lg:py-20">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <Tag>How it works</Tag>
              <h1 className="mt-5 font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[64px]">
                One workflow for cover, compliance, and confidence.
              </h1>
              <p className="mt-5 max-w-[650px] text-base leading-7 text-white/65 sm:text-lg">
                Dummy product flow for the prototype: schools post staffing needs, teachers build trusted profiles, and both sides move through matching, messaging, and booking.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className={buttonClassName({ className: "rounded-full px-6 py-3 !text-white" })} href="/signup?role=institution">
                  Start as school
                </Link>
                <Link
                  className={buttonClassName({ variant: "secondary", className: "rounded-full px-6 py-3" })}
                  href="/signup?role=teacher"
                  style={{ background: "transparent", borderColor: "rgba(255,255,255,0.28)", color: "#fff" }}
                >
                  Start as teacher
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {metrics.map(([value, label]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="font-serif text-3xl">{value}</div>
                  <div className="mt-2 text-xs uppercase tracking-[1px] text-white/45">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-8">
              <div className="eyebrow">Workflow</div>
              <h2 className="mt-2 font-serif text-3xl">The core journey</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {workflow.map((item, index) => (
                <article key={item.label} className="relative rounded-xl border border-[var(--border)] bg-white p-5">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--se-tint)] text-[var(--se)]">
                    <Icon name={item.icon} size={20} />
                  </div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-[1px] text-[var(--muted)]">Step {index + 1}</div>
                  <h3 className="font-serif text-xl">{item.label}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-14 sm:px-6 lg:px-12">
          <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-2">
            <article className="rounded-xl border border-[var(--border)] p-6">
              <Tag>For schools</Tag>
              <h2 className="mt-4 font-serif text-3xl">Fill cover without agency complexity.</h2>
              <div className="mt-6 space-y-5">
                {schoolSteps.map(([title, copy], index) => (
                  <div key={title} className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--se)] text-xs font-bold text-white">{index + 1}</div>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-[var(--border)] p-6">
              <Tag tone="purple">For teachers</Tag>
              <h2 className="mt-4 font-serif text-3xl">Turn one profile into matched opportunities.</h2>
              <div className="mt-6 space-y-5">
                {teacherSteps.map(([title, copy], index) => (
                  <div key={title} className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--purple)] text-xs font-bold text-white">{index + 1}</div>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-12">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 rounded-xl border border-[var(--border)] bg-white p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="eyebrow">Next step</div>
              <h2 className="mt-2 font-serif text-3xl">Create a workspace and test the full flow.</h2>
            </div>
            <Link className={buttonClassName({ className: "rounded-full px-6 py-3 !text-white" })} href="/signup">
              Get started
            </Link>
          </div>
        </section>
      </main>

      <PublicThemeControls />
    </div>
  );
}
