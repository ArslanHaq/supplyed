import Link from "next/link";

import { seedTeachers } from "@/data/supplyed";

import { Avatar, Btn, buttonClassName, MatchScore, Tag } from "../atoms";
import { PublicHeader } from "./PublicHeader";

export function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      <PublicHeader active="home" />

      <section className="relative overflow-hidden bg-[#0a0a0a] px-4 pb-14 pt-14 text-white sm:px-6 sm:pb-16 sm:pt-18 lg:px-12 lg:pb-20 lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.06)_1px,transparent_1px)] bg-[length:56px_56px]" />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <div className="eyebrow mb-6">Infrastructure for education staffing</div>
            <h1 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[64px]">
              Connecting schools and learners
              <br />
              with <em className="text-[var(--se)]">brilliant teachers.</em>
            </h1>
            <p className="mb-8 mt-5 max-w-[540px] text-base leading-[1.65] text-white/70 sm:mb-9 sm:mt-6 sm:text-[17px]">
              SupplyED is the marketplace where UK schools, learners, and hiring accounts find vetted, DBS-checked teachers for cover, tutoring, and learner support. No agency fees. Full compliance.
            </p>
            <div className="mb-12 flex flex-wrap gap-3">
              <Link className={buttonClassName({ size: "xl" })} href="/signup">I&apos;m a school</Link>
              <Link
                className={buttonClassName({ variant: "secondary", size: "xl" })}
                href="/signup"
                style={{ background: "transparent", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
              >
                I&apos;m a teacher
              </Link>
              <Link
                className={buttonClassName({ variant: "secondary", size: "xl" })}
                href="/signup"
                style={{ background: "transparent", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}
              >
                I&apos;m hiring talent
              </Link>
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

          <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-[var(--ink)] shadow-[0_40px_80px_rgba(0,0,0,0.4)] sm:p-5">
            <div className="mb-3.5 flex items-start justify-between">
              <div>
                <div className="label-xs text-[var(--se)]">Urgent - Today</div>
                <div className="mt-1 font-serif text-xl">Y6 Maths Cover</div>
                <div className="text-sm text-[var(--muted)]">Greenfield Primary - Salford</div>
              </div>
              <Tag tone="red">Urgent</Tag>
            </div>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              <span className="pill">Full day</span>
              <span className="pill">£180/day</span>
              <span className="pill">DBS required</span>
            </div>
            <div className="border-t border-[var(--border)] pt-3.5">
              <div className="label-xs mb-2.5">Top matches - AI ranked</div>
              {seedTeachers.slice(0, 3).map((teacher) => (
                <div key={teacher.id} className="flex items-center gap-2.5 border-b border-[var(--border)] py-2">
                  <Avatar name={teacher.name} size="sm" tone={teacher.tone} />
                  <div className="flex-1">
                    <div className="font-medium">{teacher.name}</div>
                    <div className="text-xs text-[var(--muted)]">{teacher.role}</div>
                  </div>
                  <MatchScore score={teacher.matchScore} size={36} />
                </div>
              ))}
            </div>
            <Btn className="mt-3.5 w-full" iconRight="arrow">Invite top 3</Btn>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-[72px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-12 text-center">
            <div className="eyebrow">How it works</div>
            <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl">Two ways to staff a role.</h2>
            <p className="mt-2 text-[var(--muted)]">Post urgently for instant AI matching, or open a brief and review proposals.</p>
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
    </div>
  );
}
