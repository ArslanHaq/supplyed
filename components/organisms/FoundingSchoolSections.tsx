import type { CSSProperties, ReactNode } from "react";

import { Icon, Tag } from "@/components/atoms";

const trustSignals: Array<{ copy: string; icon: string; title: ReactNode }> = [
  {
    copy: "Verified before activation",
    icon: "shield",
    title: (
      <>
        Enhanced DBS
        <br />
        on every profile
      </>
    ),
  },
  {
    copy: "MAT trustees and deputy heads advising",
    icon: "award",
    title: (
      <>
        Built with
        <br />
        education leaders
      </>
    ),
  },
  {
    copy: "No agency mark-ups, no finder fees",
    icon: "lock",
    title: (
      <>
        One transparent
        <br />
        processing fee
      </>
    ),
  },
  {
    copy: "Greater Manchester and Lancashire first",
    icon: "pin",
    title: (
      <>
        Launching
        <br />
        2026
      </>
    ),
  },
];

const foundingPlaces = Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, "0"));

const tiers = [
  {
    description: "For individual schools",
    enhanced: false,
    name: "Founding School",
    points: [
      ["Founding processing fee", "locked for 2 years from launch"],
      ["Priority onboarding", "and dedicated launch support"],
      ["Monthly input sessions", "shaping the product roadmap"],
      ["Founding school recognition", "on the platform at launch"],
    ],
  },
  {
    description: "For schools and trusts wanting deeper involvement",
    enhanced: true,
    name: "Founding School Enhanced",
    points: [
      ["Everything in Founding School", "plus:"],
      ["Early access to new features", "before the wider cohort"],
      ["Named advisory seat", "in quarterly roadmap reviews"],
      ["Multi-school and trust-level onboarding", "where applicable"],
    ],
  },
] as const;

const faqs = [
  {
    answer:
      "No. Registering tells us you would like a conversation. Nothing is binding until you choose to sign the Founding Schools Agreement after the intro call, and there is no obligation to do so.",
    question: "Does registering interest commit my school to anything?",
  },
  {
    answer:
      "SupplyED is a marketplace, not an agency. We introduce your school directly to verified supply teachers, and each booking is a direct engagement between the school and the teacher. You pay one transparent processing fee for the platform. There are no agency mark-ups on day rates and no finder fees to release a teacher.",
    question: "How is SupplyED different from a supply agency?",
  },
  {
    answer:
      "Every teacher completes the full safer-recruitment check set before their profile is activated, including an Enhanced DBS check reviewed by our compliance team. Verification status is visible on every profile, so your single central record evidence is straightforward.",
    question: "How are teachers vetted?",
  },
  {
    answer:
      "The founding cohort is drawn from Greater Manchester and Lancashire, where we launch first. Schools elsewhere are welcome to register and we will contact you as coverage expands.",
    question: "Which areas are covered?",
  },
  {
    answer:
      "The Founding Schools Programme closes. Schools joining afterwards do so on standard terms, without the founding fee lock or advisory involvement.",
    question: "What happens after the 20 places are taken?",
  },
];

function themedGlowStyle(color = "var(--se)"): CSSProperties {
  return {
    borderColor: `color-mix(in srgb, ${color} 26%, var(--border))`,
    boxShadow: [
      `0 0 0 1px color-mix(in srgb, ${color} 14%, transparent)`,
      `0 18px 48px color-mix(in srgb, ${color} 10%, transparent)`,
      "0 1px 2px rgba(10, 10, 10, 0.04)",
    ].join(", "),
  };
}

export function FoundingSchoolTrustStrip() {
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
            <p className="mt-2 max-w-[190px] text-sm leading-5 text-muted">{signal.copy}</p>
            <span className="sr-only">Trust signal {index + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FoundingSchoolCohortSection() {
  return (
    <section className="border-b border-border bg-chalk px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,520px)_minmax(420px,1fr)] lg:gap-16">
        <div>
          <Tag className="mb-5">Founding cohort</Tag>
          <h2 className="font-serif text-3xl leading-[1.08] sm:text-4xl lg:text-[46px]">
            A cohort of 20.
            <br />
            Not a waiting list.
          </h2>
          <p className="mt-5 max-w-[560px] text-base leading-7 text-muted">
            The founding cohort is deliberately small. Every founding school gets a direct line to the founder,
            monthly input sessions that shape the roadmap, and founding terms locked in writing. When the 20 places
            are taken, the programme closes.
          </p>
        </div>

        <div>
          <div aria-hidden="true" className="grid grid-cols-5 gap-2.5 sm:grid-cols-10">
            {foundingPlaces.map((place) => (
              <div
                className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-white text-xs font-bold text-muted/65"
                key={place}
              >
                {place}
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.8px] text-muted/70">
            20 founding places - registrations reviewed in order received
          </p>
        </div>
      </div>
    </section>
  );
}

export function FoundingSchoolTiersSection() {
  return (
    <section className="border-b border-border bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 text-center">
          <div className="eyebrow">Two ways to join</div>
          <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">Choose the founding route that fits.</h2>
          <p className="mt-2 text-muted">Both tiers are founding places within the cap of 20.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {tiers.map((tier) => (
            <article className="card card-pad-lg relative" key={tier.name} style={tier.enhanced ? themedGlowStyle() : undefined}>
              {tier.enhanced ? (
                <Tag className="absolute right-6 top-0 -translate-y-1/2 bg-brand text-white">Enhanced</Tag>
              ) : null}
              <h3 className="font-serif text-2xl leading-tight">{tier.name}</h3>
              <p className="mt-2 text-muted">{tier.description}</p>
              <div className="mt-7 grid gap-4">
                {tier.points.map(([title, copy]) => (
                  <div className="flex gap-3 text-sm leading-6 sm:text-base" key={title}>
                    <Icon className="mt-0.5 text-brand" name="check" size={18} />
                    <p className="text-muted">
                      <span className="font-semibold text-ink">{title}</span> {copy}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-warning/25 bg-warning-tint p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-warning">
              <Icon name="file" size={22} />
            </span>
            <p className="text-sm leading-7 text-muted sm:text-base">
              <span className="font-semibold text-ink">The rules on agency supply are changing.</span> The Department
              for Education&apos;s new STeER framework (RM6376) caps agency fees by role and becomes mandatory for
              academy trusts from September 2026. SupplyED is built for that world: direct school-to-teacher
              introductions with one transparent processing fee, not agency mark-ups.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FoundingSchoolFaqSection() {
  return (
    <section className="border-b border-border bg-chalk px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-10 text-center">
          <div className="eyebrow">Common questions</div>
          <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">Before your school registers.</h2>
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
