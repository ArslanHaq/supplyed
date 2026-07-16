import Link from "next/link";

import { auth } from "@/auth";

import { buttonClassName, Icon, Tag } from "../atoms";
import { PublicHeader } from "./PublicHeader";

const heroSignals = [
  {
    title: "Schools & MATs",
    copy: "Post staffing needs and manage compliance from one verified workspace.",
    icon: "building",
  },
  {
    title: "Supply teachers",
    copy: "Build a trusted profile, availability, and placement history.",
    icon: "user",
  },
  {
    title: "Individual hirers",
    copy: "Find verified teaching support for yourself or another learner.",
    icon: "heart",
  },
];

const trustCards = [
  {
    title: "DBS verified",
    copy: "Every teacher has enhanced DBS details on file, reviewed by the admin team before marketplace activation.",
    icon: "shield",
    className: "bg-brand-tint text-brand",
  },
  {
    title: "Same-day staffing",
    copy: "94% of urgent roles are filled within 2 hours of posting, so schools are not left with uncovered classes.",
    icon: "zap",
    className: "bg-warning-tint text-warning",
  },
  {
    title: "Rated and reviewed",
    copy: "Every placement earns a verified rating, building a reputation system that schools and hirers can trust.",
    icon: "star",
    className: "bg-success-tint text-success",
  },
];

export async function LandingPage() {
  const session = await auth();
  const account = session?.user ?? null;
  const isSignedIn = Boolean(account);
  const startHref = isSignedIn ? "/post-auth" : "/signup";

  return (
    <div className="overflow-x-hidden">
      <PublicHeader active="home" user={account} />

      <section className="relative overflow-hidden bg-[#0a0a0a] px-4 pb-14 pt-14 text-white sm:px-6 sm:pb-16 sm:pt-18 lg:px-12 lg:pb-20 lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.06)_1px,transparent_1px)] bg-[length:56px_56px]" />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-32">
          <div>
            <div className="eyebrow mb-6">Infrastructure for education staffing</div>
            <h1 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[64px]">
              Connecting schools and learners
              <br />
              with <em className="text-brand">brilliant teachers.</em>
            </h1>
            <p className="mb-8 mt-5 max-w-[540px] text-base leading-[1.65] text-white/70 sm:mb-9 sm:mt-6 sm:text-[17px]">
              Staff your classroom in minutes, not days. SupplyED connects UK schools, learners, and hiring accounts with vetted, DBS-checked teachers for cover, tutoring, and learner support.
            </p>
            <div className="mb-12 flex flex-wrap gap-3">
              {isSignedIn ? (
                <Link className={buttonClassName({ size: "xl" })} href={startHref}>Open workspace</Link>
              ) : (
                <>
                  <Link className={buttonClassName({ size: "xl" })} href={startHref}>I&apos;m a school</Link>
                  <Link
                    className={buttonClassName({ variant: "secondary", size: "xl" })}
                    href={startHref}
                    style={{ background: "transparent", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
                  >
                    I&apos;m a teacher
                  </Link>
                  <Link
                    className={buttonClassName({ variant: "secondary", size: "xl" })}
                    href={startHref}
                    style={{ background: "transparent", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
                  >
                    I&apos;m hiring talent
                  </Link>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-5 sm:flex sm:flex-wrap sm:gap-6">
              {[["8,400+", "Verified teachers"], ["2,100+", "Partner schools"], ["94%", "Filled within 2h"], ["4.9★", "Average rating"]].map(([value, label]) => (
                <div key={label}>
                  <div className="font-serif text-[28px]">{value}</div>
                  <div className="text-xs uppercase tracking-[1px] text-white/50">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 text-ink shadow-[0_40px_80px_rgba(0,0,0,0.4)] sm:p-7">
            <div className="absolute right-0 top-0 h-32 w-32 -translate-y-12 translate-x-10 rounded-full bg-brand-tint" />
            <div className="relative">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="label-xs text-brand">Verified marketplace</div>
                  <h2 className="mt-2 max-w-[390px] font-serif text-3xl leading-[1.02] sm:text-[38px]">
                    <span className="block">The right teacher,</span>
                    <span className="mt-1.5 block">right now.</span>
                  </h2>
                  <p className="mt-3 max-w-[360px] text-sm leading-6 text-muted">
                    From urgent classroom cover to learner support, SupplyED keeps the path from need to verified teacher clear.
                  </p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-tint  text-brand">
                  <Icon name="shield" size={24} />
                </span>
              </div>

              <div className="mb-5 grid gap-3">
                {heroSignals.map((signal, index) => (
                  <div key={signal.title} className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chalk text-brand">
                      <Icon name={signal.icon} size={21} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted">0{index + 1}</span>
                        <h3 className="font-semibold">{signal.title}</h3>
                      </div>
                      <p className="mt-0.5 text-sm leading-6 text-muted">{signal.copy}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-brand/20 bg-brand-tint p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand">
                    <Icon name="check" size={18} />
                  </span>
                  <div>
                    <div className="font-semibold text-brand-dark">Verification before access</div>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      DBS, identity, right-to-work, ratings, and role status stay connected before users enter the marketplace.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-12 text-center">
            <div className="eyebrow">How it works</div>
            <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">Two ways to staff a role.</h2>
            <p className="mt-2 text-muted">Post urgently for instant AI matching, or open a brief and review proposals.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { tag: "Instant matching", title: "Same-day cover, solved in minutes", color: "var(--se)", bg: "var(--se-tint)", steps: ["Post an urgent role", "Teachers are ranked instantly", "First accept wins"] },
              { tag: "Freelance briefs", title: "Long-term roles, properly staffed", color: "var(--purple)", bg: "var(--purple-tint)", steps: ["Publish your brief", "Receive proposals", "Compare, message, hire"] },
              { tag: "Learner support", title: "Verified teachers for learners", color: "var(--green)", bg: "var(--green-tint)", steps: ["Create a learner request", "Review verified matches", "Message from your account"] },
            ].map((card) => (
              <div key={card.title} className="card card-pad-lg">
                <Tag className="mb-4" style={{ background: card.bg, color: card.color }}>{card.tag}</Tag>
                <div className="mb-[18px] font-serif text-[22px]">{card.title}</div>
                {card.steps.map((step, index) => (
                  <div key={step} className="mb-3 flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: card.color }}>
                      {index + 1}
                    </div>
                    <div>{step}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-chalk px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-4 lg:grid-cols-3">
            {trustCards.map((card) => (
              <article key={card.title} className="rounded-xl border border-border bg-white p-6 text-center shadow-(--shadow-xs) sm:p-8">
                <div className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl ${card.className}`}>
                  <Icon name={card.icon} size={26} />
                </div>
                <h3 className="font-serif text-2xl leading-tight">{card.title}</h3>
                <p className="mx-auto mt-4 max-w-[360px] text-sm leading-6 text-muted sm:text-[15px]">{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-white px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-[820px]">
          <Tag className="mb-5">Start hiring</Tag>
          <h2 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[58px]">
            Ready to transform your staffing?
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-base leading-7 text-muted sm:text-lg">
            Join 2,100+ schools already using SupplyED to cover urgent staffing, long-term briefs, and learner support.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className={buttonClassName({ size: "xl", className: "rounded-full px-8 text-white!" })} href={startHref}>
              {isSignedIn ? "Open workspace" : "Get started free"}
            </Link>
            <Link className={buttonClassName({ variant: "secondary", size: "xl", className: "rounded-full px-8" })} href="/pricing">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
