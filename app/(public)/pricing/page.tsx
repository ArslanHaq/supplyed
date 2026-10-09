import type { Metadata } from "next";
import Link from "next/link";

import { PublicHeader } from "@/components/organisms/PublicHeader";
import { buttonClassName, Icon, Tag } from "@/components/atoms";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple dummy pricing plans for schools, multi-academy trusts, and supply teachers using SupplyED.",
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
    name: "MAT school",
    price: "Custom",
    caption: "For schools joining through a multi-academy trust.",
    cta: "Join through a trust",
    tone: "green" as const,
    features: ["Trust details", "Signatory approval", "Verified teacher access", "School-level workspace"],
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
  ["Trust signatory approval", "-", "-", "Included", "Included"],
  ["Compliance dashboard", "Profile only", "School view", "School view", "Trust-wide"],
  ["Messaging", "Included", "Included", "Included", "Included"],
  ["Support", "Standard", "Priority", "Standard", "Dedicated"],
];

const faqs = [
  ["Can schools trial SupplyED?", "Yes. Dummy trial data assumes a 14-day pilot with no long-term commitment."],
  ["Are teachers charged?", "No. The teacher plan is listed as free so supply staff can build verified profiles and receive matches."],
  ["How do MAT schools join?", "Choose the MAT school option during onboarding, add the trust, and collect signatory approval before review."],
  ["Does pricing include compliance checks?", "The example plans include compliance visibility. Real verification costs can be added later."],
];

export default function PricingPage() {
  const actionHref = "/signup";

  return (
    <div className="marketing-page marketing-pricing min-h-screen bg-chalk">
      <PublicHeader active="pricing" />

      <main>
        <section className="marketing-info-hero px-4 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-[1180px]">
            <div className="max-w-[720px]">
              <Tag>Pricing</Tag>
              <h1 className="mt-5 font-heading text-4xl leading-[1.05] sm:text-5xl lg:text-[64px]">
                Simple plans for flexible school staffing.
              </h1>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">
                Dummy pricing for the prototype: keep teachers free, give schools predictable monthly access, and reserve custom workflows for trust-level teams.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-12">
          <div className="marketing-pricing-grid mx-auto max-w-[1180px]">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`marketing-price-card ${plan.featured ? "marketing-price-card-featured" : ""}`}
              >
                {plan.featured ? <span className="marketing-price-popular">Popular for schools</span> : null}
                <h2>{plan.name}</h2>
                <div className="marketing-price-amount"><strong>{plan.price}</strong>{plan.period ? <span>{plan.period}</span> : null}</div>

                <p className="min-h-[56px] text-sm leading-6 text-muted">{plan.caption}</p>

                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Icon name="checkCircle" size={16} className="text-brand" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link className={buttonClassName({ variant: plan.featured ? "primary" : "secondary" })} href={actionHref}>
                  {plan.cta}
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
                <h2 className="mt-2 font-heading text-3xl">What each plan includes</h2>
              </div>
              <Link className={buttonClassName({ variant: "secondary", className: "rounded-full" })} href="/how-it-works">
                See how it works
              </Link>
            </div>

            <div className="marketing-comparison" role="region" aria-label="Plan features comparison" tabIndex={0}>
              <table>
                <caption className="sr-only">Compare the features included in each SupplyED plan</caption>
                <thead><tr><th scope="col">Feature</th>{plans.map((plan) => <th scope="col" key={plan.name}>{plan.name}</th>)}</tr></thead>
                <tbody>{comparisons.map(([feature, ...values]) => <tr key={feature}><th scope="row">{feature}</th>{values.map((value, index) => <td key={`${feature}-${index}`}>{value}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-12">
          <div className="marketing-faq-layout mx-auto">
            <div><div className="eyebrow">Common questions</div><h2 className="mt-3 font-heading text-3xl">A little more clarity.</h2></div>
            <div>{faqs.map(([question, answer], index) => (
              <details key={question} open={index === 0} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{question}<Icon name="plus" size={16} className="text-brand transition-transform group-open:rotate-45" /></summary>
                <div className="text-muted">{answer}</div>
              </details>
            ))}</div>
          </div>
        </section>
      </main>

    </div>
  );
}
