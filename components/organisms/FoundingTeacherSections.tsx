import type { CSSProperties, ReactNode } from "react";

import { Icon, Tag } from "@/components/atoms";

const trustSignals: Array<{ copy: string; icon: string; title: ReactNode }> = [
  {
    copy: "Founding rate uplift on your bookings",
    icon: "pound",
    title: (
      <>
        GBP 5 per day,
        <br />
        for 36 months
      </>
    ),
  },
  {
    copy: "SupplyED covers your vetting costs",
    icon: "shield",
    title: (
      <>
        No-cost DBS and
        <br />
        compliance checks
      </>
    ),
  },
  {
    copy: "Each booking is between you and the school",
    icon: "users",
    title: (
      <>
        Direct with
        <br />
        schools
      </>
    ),
  },
  {
    copy: "Greater Manchester and Lancashire at launch",
    icon: "pin",
    title: (
      <>
        The North
        <br />
        comes first
      </>
    ),
  },
];

const roles = [
  { highlighted: true, label: "Supply teachers" },
  { highlighted: true, label: "ECTs" },
  { highlighted: true, label: "Teaching assistants" },
  { highlighted: true, label: "HLTAs" },
  { highlighted: true, label: "SEN / SEND specialists" },
  { highlighted: true, label: "Cover supervisors" },
  { highlighted: false, label: "Nursery practitioners" },
  { highlighted: false, label: "Exam invigilators" },
  { highlighted: false, label: "Other school support staff" },
] as const;

const highlightedRoles = roles.filter((role) => role.highlighted);
const supportingRoles = roles.filter((role) => !role.highlighted);

const regions = [
  {
    name: "Greater Manchester",
    note: "Launch region. Schools onboarding now.",
    status: "Priority",
    tone: "priority",
  },
  {
    name: "Lancashire",
    note: "Launch region. Schools onboarding now.",
    status: "Priority",
    tone: "priority",
  },
  {
    name: "Surrounding areas: Merseyside, Cheshire, West Yorkshire",
    note: "Close behind. Founding registrations here are verified in the first wave.",
    status: "Priority",
    tone: "priority",
  },
  {
    name: "Rest of the UK",
    note: "You are welcome to register now. We will contact you as coverage expands, and your founding benefits are honoured when your region goes live.",
    status: "Open",
    tone: "open",
  },
] as const;

const faqs = [
  {
    answer:
      "No. SupplyED is a marketplace, not an agency or employer. We introduce you to schools, and each booking is a direct engagement between you and the school. You stay in control of your rate, your availability, and where you work.",
    question: "Am I employed by SupplyED?",
  },
  {
    answer:
      "Founding members receive an extra GBP 5 per day on bookings made through SupplyED, for 36 months from launch. It is applied on top of the rate you agree with the school.",
    question: "What does the founding rate uplift mean in practice?",
  },
  {
    answer:
      "Every member completes the full safer-recruitment check set before activation, including an Enhanced DBS check reviewed by our compliance team. For founding members, SupplyED covers these costs.",
    question: "What checks do I need, and who pays?",
  },
  {
    answer:
      "Yes. The founding cohort is open across school support roles, including teaching assistants, HLTAs, SEN and SEND specialists, and cover supervisors. Schools on SupplyED post roles across this range, not just teaching cover.",
    question: "I am a TA, HLTA, or SEN specialist, not a qualified teacher. Can I join?",
  },
  {
    answer:
      "Yes, though our launch focus is the North: Greater Manchester and Lancashire first, then surrounding areas such as Merseyside, Cheshire, and West Yorkshire. If you are elsewhere in the UK you can register now, and we will be in touch as coverage reaches your region, with your founding benefits honoured when it does.",
    question: "I am outside Greater Manchester and Lancashire. Should I still register?",
  },
  {
    answer:
      "No. Registering tells us you would like to be part of the founding cohort. Verification and everything after it is your choice, and you can step away at any point.",
    question: "Does registering commit me to anything?",
  },
];

function themedGlowStyle(color = "var(--se)"): CSSProperties {
  return {
    borderColor: `color-mix(in srgb, ${color} 24%, var(--border))`,
    boxShadow: [
      `0 0 0 1px color-mix(in srgb, ${color} 12%, transparent)`,
      `0 18px 44px color-mix(in srgb, ${color} 9%, transparent)`,
      "0 1px 2px rgba(10, 10, 10, 0.04)",
    ].join(", "),
  };
}

function roleChipClassName(highlighted: boolean) {
  return highlighted
    ? "rounded-full border border-brand/25 bg-brand-tint px-4 py-2 text-sm font-semibold text-brand-dark"
    : "rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-muted";
}

export function FoundingTeacherTrustStrip() {
  return (
    <section className="border-b border-border bg-chalk px-4 py-8 sm:px-6 lg:px-12">
      <div className="mx-auto grid max-w-[1200px] gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
        {trustSignals.map((signal, index) => (
          <div
            className="border-border lg:border-l lg:pl-8 first:lg:border-l-0 first:lg:pl-0"
            key={signal.copy}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand shadow-(--shadow-xs)">
              <Icon name={signal.icon} size={22} />
            </div>
            <h2 className="text-lg font-bold leading-tight text-ink">{signal.title}</h2>
            <p className="mt-2 max-w-[210px] text-sm leading-5 text-muted">{signal.copy}</p>
            <span className="sr-only">Teacher founding signal {index + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FoundingTeacherRolesSection() {
  return (
    <section className="border-b border-border bg-chalk px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
      <div className="mx-auto max-w-[1320px] text-center">
        <Tag className="mb-5">Who can join</Tag>
        <h2 className="font-serif text-3xl leading-[1.08] sm:text-4xl lg:text-[46px]">
          If you cover classrooms, you belong here.
        </h2>
        <p className="mx-auto mt-4 max-w-[620px] text-base leading-7 text-muted">
          The founding cohort is open across school support roles, not just qualified teachers.
        </p>

        <div className="mt-8 grid justify-items-center gap-4">
          <div className="flex flex-wrap justify-center gap-3">
            {highlightedRoles.map((role) => (
              <span className={roleChipClassName(role.highlighted)} key={role.label}>
                {role.label}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {supportingRoles.map((role) => (
              <span className={roleChipClassName(role.highlighted)} key={role.label}>
                {role.label}
              </span>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-[620px] text-sm leading-6 text-muted">
          Every founding member completes the same safer-recruitment check set before activation, whatever the role.
          Schools see your verification status on your profile.
        </p>
      </div>
    </section>
  );
}

export function FoundingTeacherRegionsSection() {
  return (
    <section className="border-b border-border bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-10 text-center">
          <div className="eyebrow">Launch regions</div>
          <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">Our focus is the North.</h2>
          <p className="mx-auto mt-2 max-w-[640px] text-muted">
            We launch where we can guarantee schools on the other side of the marketplace.
          </p>
        </div>

        <div className="grid gap-3">
          {regions.map((region) => (
            <article
              className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              key={region.name}
              style={region.tone === "priority" ? themedGlowStyle() : undefined}
            >
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                  <Icon name="pin" size={21} />
                </span>
                <div>
                  <h3 className="font-serif text-xl leading-tight text-ink">{region.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{region.note}</p>
                </div>
              </div>
              <span
                className={
                  region.tone === "priority"
                    ? "inline-flex w-fit rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-[0.8px] text-white"
                    : "inline-flex w-fit rounded-full bg-success-tint px-3 py-1 text-xs font-bold uppercase tracking-[0.8px] text-success"
                }
              >
                {region.status}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FoundingTeacherFaqSection() {
  return (
    <section className="border-b border-border bg-chalk px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-10 text-center">
          <div className="eyebrow">Common questions</div>
          <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">Before teachers register.</h2>
        </div>
        <div className="grid gap-3">
          {faqs.map((faq, index) => (
            <details
              className="group rounded-xl border border-border bg-white shadow-(--shadow-xs) open:border-brand/70"
              key={faq.question}
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-ink sm:px-6 sm:text-lg">
                {faq.question}
                <span className="text-2xl leading-none text-brand group-open:hidden">+</span>
                <span className="hidden text-2xl leading-none text-brand group-open:block">-</span>
              </summary>
              <div className="border-t border-border px-5 py-4 text-sm leading-7 text-muted sm:px-6 sm:text-base">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
