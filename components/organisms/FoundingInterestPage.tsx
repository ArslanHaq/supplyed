import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { buttonClassName, Icon, Tag } from "@/components/atoms";
import { PublicThemeControls } from "@/components/molecules";

import { FoundingInterestForm } from "./FoundingInterestForm";
import { PublicHeader } from "./PublicHeader";

type FoundingInterestType = "SCHOOL" | "TEACHER";

type FoundingInterestPageProps = {
  campaign?: string;
  source?: string;
  type: FoundingInterestType;
};

type PageContent = {
  accent: string;
  benefits: Array<{ copy: string; icon: string; title: string }>;
  ctaCopy: string;
  ctaTitle: string;
  formBadge: string;
  formBullets: Array<{ copy: string; title: string }>;
  heroCopy: string;
  heroEyebrow: string;
  heroTitle: ReactNode;
  primaryCta: string;
  programmeSubtitle: string;
  programmeTitle: string;
  rightCardCopy: string;
  rightCardRows: Array<{ copy: string; icon: string; title: string }>;
  secondaryCta: string;
  steps: Array<{ copy: string; title: string }>;
  stats: ReadonlyArray<readonly [string, string]>;
};

const schoolContent: PageContent = {
  accent: "var(--se)",
  benefits: [
    {
      copy: "Your founding processing fee is fixed in writing for two years, before standard terms open more widely.",
      icon: "pound",
      title: "Founding terms, locked",
    },
    {
      copy: "Cover coordinators and SLT get monthly input sessions that shape the roadmap before general launch.",
      icon: "message",
      title: "Direct line to the founder",
    },
    {
      copy: "Founding schools are onboarded, trained, and live before general availability opens.",
      icon: "zap",
      title: "Priority access at launch",
    },
  ],
  ctaCopy: "Be one of the 20 founding schools shaping SupplyED across Greater Manchester and Lancashire.",
  ctaTitle: "Ready to transform your staffing?",
  formBadge: "Founding schools programme",
  formBullets: [
    { title: "Founding terms, locked for 2 years", copy: "your launch rate never rises while you stay with us." },
    { title: "Direct line to the founder", copy: "monthly input sessions that shape the roadmap." },
    { title: "Priority access at launch", copy: "your roles reach verified teachers first." },
    { title: "No commitment", copy: "registering interest starts a conversation, nothing more." },
  ],
  heroCopy:
    "SupplyED is a compliance-first marketplace connecting UK schools directly with verified supply teachers. Before launch, we are inviting a founding cohort of 20 schools across Greater Manchester and Lancashire to lock in founding terms and shape the platform with us.",
  heroEyebrow: "Founding Schools Programme - capped at 20 schools",
  heroTitle: (
    <>
      Twenty schools will shape how supply cover works.
      <br />
      <em className="text-brand">Yours can be one.</em>
    </>
  ),
  primaryCta: "Register your school's interest",
  programmeSubtitle: "Both tiers are founding places within the cap of 20.",
  programmeTitle: "What founding schools get",
  rightCardCopy:
    "The founding cohort is deliberately small, reviewed in order received, and built around real school-cover needs.",
  rightCardRows: [
    { copy: "Founding fee lock, early onboarding, and roadmap input.", icon: "building", title: "Schools & MATs" },
    { copy: "Verified teacher profiles and document-backed compliance signals.", icon: "shield", title: "Compliance-ready cover" },
    { copy: "Urgent cover, planned briefs, and learner support from one workspace.", icon: "calendar", title: "Real staffing workflows" },
  ],
  secondaryCta: "See what founding schools get",
  steps: [
    { title: "Register your interest", copy: "Tell us about your school. Registrations are reviewed in the order they arrive." },
    { title: "Intro call", copy: "A short call to walk through the programme, founding terms, and your cover needs." },
    { title: "Confirm your place", copy: "If it is a fit, we confirm your place in writing and onboard you before launch." },
  ],
  stats: [
    ["20", "Founding places"],
    ["2 years", "Terms locked"],
    ["Priority", "Launch access"],
    ["No fee", "To register"],
  ],
};

const teacherContent: PageContent = {
  accent: "var(--se)",
  benefits: [
    {
      copy: "Founding teachers receive an extra GBP 5 per day on SupplyED bookings for 36 months from launch.",
      icon: "pound",
      title: "Founding rate uplift",
    },
    {
      copy: "SupplyED covers Enhanced DBS and compliance checks for founding members before marketplace activation.",
      icon: "shield",
      title: "Checks covered",
    },
    {
      copy: "Verified founding profiles are live first, so schools see you as soon as roles start opening.",
      icon: "star",
      title: "First access to roles",
    },
  ],
  ctaCopy: "Join the founding teachers building SupplyED across Greater Manchester, Lancashire, and the North.",
  ctaTitle: "Work directly with schools from day one.",
  formBadge: "Founding teachers programme",
  formBullets: [
    { title: "+GBP 5 per day for 36 months", copy: "the founding uplift on your SupplyED bookings." },
    { title: "DBS and checks covered", copy: "verification costs are covered for founding members." },
    { title: "Live from day one", copy: "schools see your verified profile the moment we launch." },
    { title: "All cover roles welcome", copy: "teachers, TAs, HLTAs, SEN specialists, and cover supervisors." },
  ],
  heroCopy:
    "SupplyED is a compliance-first marketplace that introduces you directly to schools. No agency margin sits between you and your day rate. Join as a founding teacher before launch and lock in benefits that later joiners will not get.",
  heroEyebrow: "Founding Teachers Programme - now open",
  heroTitle: (
    <>
      Work directly with schools.
      <br />
      <em className="text-brand">Keep what you earn.</em>
    </>
  ),
  primaryCta: "Sign up as a founding teacher",
  programmeSubtitle: "The founding cohort is open across school support roles, not just qualified teachers.",
  programmeTitle: "Founding benefits",
  rightCardCopy:
    "SupplyED keeps your profile, availability, verification, and placement history connected before launch.",
  rightCardRows: [
    { copy: "Supply teachers, ECTs, HLTAs, TAs, SEN specialists, and cover supervisors.", icon: "users", title: "All cover roles" },
    { copy: "Greater Manchester and Lancashire first, with nearby northern regions close behind.", icon: "pin", title: "North-first launch" },
    { copy: "Each booking is direct between you and the school, with no agency margin between.", icon: "checkCircle", title: "Direct engagement" },
  ],
  secondaryCta: "See founding benefits",
  steps: [
    { title: "Register your interest", copy: "Tell us your role, location, phase, and availability." },
    { title: "Complete checks", copy: "Before launch, founding members complete the full safer-recruitment check set." },
    { title: "Go live first", copy: "Your verified profile is live from day one with founding benefits noted." },
  ],
  stats: [
    ["GBP 5", "Daily uplift"],
    ["36 mo", "Benefit window"],
    ["Free", "Founding checks"],
    ["Day one", "Profile live"],
  ],
};

function contentFor(type: FoundingInterestType) {
  return type === "TEACHER" ? teacherContent : schoolContent;
}

function themedGlowStyle(color: string): CSSProperties {
  return {
    borderColor: `color-mix(in srgb, ${color} 24%, var(--border))`,
    boxShadow: [
      `0 0 0 1px color-mix(in srgb, ${color} 14%, transparent)`,
      `0 18px 44px color-mix(in srgb, ${color} 10%, transparent)`,
      "0 1px 2px rgba(10, 10, 10, 0.04)",
    ].join(", "),
  };
}

export function FoundingInterestPage({ campaign, source, type }: FoundingInterestPageProps) {
  const content = contentFor(type);

  return (
    <div className="overflow-x-hidden bg-white">
      <PublicHeader active={type === "SCHOOL" ? "founding-schools" : "founding-teachers"} />

      <section className="relative overflow-hidden bg-[#0a0a0a] px-4 py-14 text-white sm:px-6 sm:py-16 lg:px-12 lg:py-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.06)_1px,transparent_1px)] bg-[length:56px_56px]" />
        <div
          className="relative mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,640px)_minmax(440px,1fr)]"
          style={{ columnGap: "clamp(72px, 7vw, 150px)" }}
        >
          <div className="max-w-[640px]">
            <div className="eyebrow mb-6">{content.heroEyebrow}</div>
            <h1 className="font-serif text-4xl leading-[1.04] sm:text-5xl lg:text-[64px]">{content.heroTitle}</h1>
            <p className="mb-8 mt-5 max-w-[590px] text-base leading-[1.7] text-white/70 sm:mb-9 sm:mt-6 sm:text-[17px]">
              {content.heroCopy}
            </p>
            <div className="mb-12 flex flex-wrap gap-3">
              <Link className={buttonClassName({ size: "xl" })} href="#register">
                {content.primaryCta}
              </Link>
              <Link
                className={buttonClassName({ variant: "secondary", size: "xl" })}
                href="#programme"
                style={{ background: "transparent", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
              >
                {content.secondaryCta}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 sm:gap-6">
              {content.stats.map(([value, label]) => (
                <div key={label}>
                  <div className="font-serif text-[28px]">{value}</div>
                  <div className="text-xs uppercase tracking-[1px] text-white/50">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-xl border border-border bg-white p-5 text-ink shadow-[0_40px_80px_rgba(0,0,0,0.4)] sm:p-7">
            <div className="absolute right-0 top-0 h-32 w-32 -translate-y-12 translate-x-10 rounded-full bg-brand-tint" />
            <div className="relative">
              <div className="label-xs text-brand">Verified marketplace</div>
              <h2 className="mt-2 max-w-[410px] font-serif text-3xl leading-[1.04] sm:text-[38px]">
                The right teacher, right now.
              </h2>
              <p className="mt-3 max-w-[440px] text-sm leading-6 text-muted">{content.rightCardCopy}</p>

              <div className="mt-6 grid gap-3">
                {content.rightCardRows.map((row, index) => (
                  <div key={row.title} className="grid grid-cols-[auto_1fr] items-start gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chalk text-brand">
                      <Icon name={row.icon} size={21} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted">0{index + 1}</span>
                        <h3 className="font-semibold">{row.title}</h3>
                      </div>
                      <p className="mt-0.5 text-sm leading-6 text-muted">{row.copy}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-brand/20 bg-brand-tint p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand">
                    <Icon name="check" size={18} />
                  </span>
                  <div>
                    <div className="font-semibold text-brand-dark">Safer checks before activation</div>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      Enhanced DBS, identity, right-to-work, profile review, ratings, and role status stay connected before marketplace access.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="programme" className="bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-10 text-center">
            <div className="eyebrow">{content.formBadge}</div>
            <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">{content.programmeTitle}</h2>
            <p className="mt-2 text-muted">{content.programmeSubtitle}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {content.benefits.map((benefit) => (
              <article key={benefit.title} className="card card-pad-lg" style={themedGlowStyle(content.accent)}>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
                  <Icon name={benefit.icon} size={24} />
                </div>
                <h3 className="font-serif text-2xl leading-tight">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{benefit.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-chalk px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-10 text-center">
            <div className="eyebrow">How it works</div>
            <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">Three simple steps before launch.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {content.steps.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border bg-white p-6 shadow-(--shadow-xs)">
                <span className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="font-serif text-xl leading-tight">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="register" className="bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
        <div
          className="mx-auto grid max-w-[1440px] items-center gap-8 lg:grid-cols-[minmax(0,590px)_minmax(460px,1fr)]"
          style={{ columnGap: "clamp(72px, 7vw, 160px)" }}
        >
          <div className="max-w-[590px]">
            <Tag className="mb-5">{content.formBadge}</Tag>
            <h2 className="font-serif text-3xl leading-[1.08] sm:text-4xl lg:text-[46px]">{content.ctaTitle}</h2>
            <p className="mt-4 max-w-[520px] text-base leading-7 text-muted">{content.ctaCopy}</p>
            <div className="mt-6 grid gap-4 text-sm leading-6 text-muted sm:text-[15px]">
              {content.formBullets.map((point) => (
                <div key={point.title} className="flex gap-3">
                  <Icon className="mt-0.5 shrink-0 text-brand" name="check" size={18} />
                  <p>
                    <span className="font-semibold text-ink">{point.title}</span> - {point.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <FoundingInterestForm campaign={campaign} source={source} type={type} />
        </div>
      </section>

      <section className="border-t border-border bg-[#0a0a0a] px-4 py-14 text-center text-white sm:px-6 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-[820px]">
          <Tag className="mb-5">QR-ready page</Tag>
          <h2 className="font-serif text-4xl leading-[1.05] sm:text-5xl">Share this page from events, flyers, and email.</h2>
          <p className="mx-auto mt-5 max-w-[560px] text-base leading-7 text-white/65">
            Use the page URL directly in QR codes. Add source and campaign query strings when you need attribution.
          </p>
          <div className="mt-8">
            <Link className={buttonClassName({ size: "xl", className: "rounded-full px-8" })} href="#register">
              Register interest
            </Link>
          </div>
        </div>
      </section>

      <PublicThemeControls />
    </div>
  );
}
