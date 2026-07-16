import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { PublicThemeControls } from "@/components/molecules";
import { PublicHeader } from "@/components/organisms/PublicHeader";
import { buttonClassName, Icon, Tag } from "@/components/atoms";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple dummy pricing plans for schools, individual hirers, trusts, and supply teachers using SupplyED.",
  alternates: {
    canonical: "/pricing",
  },
};

const plans = [
  {
    name: "Teacher",
    price: "Free",
    caption: "For supply teachers building a verified profile.",
    cta: "Join as teacher",
    tone: "ghost" as const,
    features: ["Verified profile", "Job matching", "Availability tools", "Direct school messages"],
  },
  {
    name: "School",
    price: "£149",
    period: "/month",
    caption: "For schools filling day-to-day and planned cover.",
    cta: "Start school plan",
    tone: "" as const,
    featured: true,
    features: ["Unlimited job posts", "AI ranked teacher matches", "Compliance snapshot", "Messaging and booking workflow"],
  },
  {
    name: "Individual",
    price: "Free",
    caption: "For individuals requesting safe learner support for themselves or another learner.",
    cta: "Hire talent",
    tone: "green" as const,
    features: ["Learner requests", "Verified teacher badges", "Account-led messaging", "Booking preparation tools"],
  },
  {
    name: "Trust",
    price: "Custom",
    caption: "For MATs coordinating cover across multiple schools.",
    cta: "Create trust workspace",
    tone: "purple" as const,
    features: ["Multi-school workspace", "Regional talent pools", "Shared compliance reporting", "Priority onboarding support"],
  },
];

const comparisons = [
  ["Teacher profile", "Included", "Included", "-", "Included"],
  ["Job posting", "-", "Unlimited", "-", "Unlimited"],
  ["Learner requests", "-", "-", "Included", "Included"],
  ["Compliance dashboard", "Profile only", "School view", "Verified badges", "Trust-wide"],
  ["Messaging", "Included", "Included", "Included", "Included"],
  ["Support", "Standard", "Priority", "Standard", "Dedicated"],
];

const faqs = [
  ["Can schools trial SupplyED?", "Yes. Dummy trial data assumes a 14-day pilot with no long-term commitment."],
  ["Are teachers charged?", "No. The teacher plan is listed as free so supply staff can build verified profiles and receive matches."],
  ["Can individuals join?", "Yes. Any verified account can create learner requests and contact verified teachers through guarded messaging."],
  ["Does pricing include compliance checks?", "The example plans include compliance visibility. Real verification costs can be added later."],
];

export default async function PricingPage() {
  const session = await auth();
  const account = session?.user ?? null;
  const isSignedIn = Boolean(account);
  const actionHref = isSignedIn ? "/post-auth" : "/signup";

  return (
    <div className="min-h-screen overflow-x-hidden bg-chalk">
      <PublicHeader active="pricing" user={account} />

      <main>
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
          <div className="mx-auto max-w-[1180px]">
            <div className="max-w-[720px]">
              <Tag>Pricing</Tag>
              <h1 className="mt-5 font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[64px]">
                Simple plans for flexible school staffing.
              </h1>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">
                Dummy pricing for the prototype: keep teachers and individual hirers free, give schools predictable monthly access, and reserve custom workflows for trust-level teams.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-12">
          <div className="mx-auto grid max-w-[1180px] gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-xl border bg-white p-6 shadow-(--shadow-xs) ${plan.featured ? "border-brand ring-2 ring-brand-tint-2" : "border-border"}`}
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <Tag tone={plan.tone}>{plan.name}</Tag>
                    <div className="mt-5 flex items-end gap-1">
                      <span className="font-serif text-4xl leading-none">{plan.price}</span>
                      {plan.period ? <span className="pb-1 text-sm text-muted">{plan.period}</span> : null}
                    </div>
                  </div>
                  {plan.featured ? <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand">Popular</span> : null}
                </div>

                <p className="min-h-[56px] text-sm leading-6 text-muted">{plan.caption}</p>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2.5 text-sm">
                      <Icon name="checkCircle" size={16} className="text-brand" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Link className={buttonClassName({ className: "mt-7 w-full rounded-full py-3 text-white!" })} href={actionHref}>
                  {isSignedIn ? "Open workspace" : plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white px-4 py-14 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="eyebrow">Compare</div>
                <h2 className="mt-2 font-serif text-3xl">What each plan includes</h2>
              </div>
              <Link className={buttonClassName({ variant: "secondary", className: "rounded-full" })} href="/how-it-works">
                See how it works
              </Link>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              {comparisons.map((row, index) => (
                <div key={row[0]} className="grid grid-cols-2 border-b border-border bg-white last:border-b-0 md:grid-cols-5">
                  {row.map((cell, cellIndex) => (
                    <div
                      key={`${row[0]}-${cellIndex}`}
                      className={`min-h-[56px] px-4 py-4 text-sm ${cellIndex === 0 ? "font-semibold text-ink" : "text-muted"} ${index === 0 ? "" : ""}`}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-12">
          <div className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-3">
            {faqs.map(([question, answer]) => (
              <article key={question} className="rounded-xl border border-border bg-white p-5">
                <h3 className="font-serif text-xl">{question}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <PublicThemeControls />
    </div>
  );
}
