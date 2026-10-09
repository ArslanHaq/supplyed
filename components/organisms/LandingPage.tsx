import Link from "next/link";

import { buttonClassName, Icon, Tag } from "../atoms";
import { PublicHeader } from "./PublicHeader";
import { RegisterInterestForm } from "./RegisterInterestForm";

const heroSignals = [
  { title: "Schools & MATs", copy: "Post staffing needs, manage compliance, and join the founding-schools programme from one verified workspace.", icon: "building" },
  { title: "Supply teachers", copy: "Create a trusted profile with availability, Enhanced DBS status, and placement history.", icon: "user" },
  { title: "MAT schools", copy: "Connect a school to its trust and collect signatory approval during verified onboarding.", icon: "building" },
  { title: "Education leaders", copy: "Built with input from head teachers, MAT trustees, deputy heads, and supply teachers.", icon: "shield" },
];

const trustCards = [
  { title: "DBS verified", copy: "Every teacher has enhanced DBS details on file, reviewed by the verification team before marketplace activation.", icon: "shield", label: "Safeguarding first" },
  { title: "Same-day staffing", copy: "94% of urgent roles are filled within 2 hours of posting, with real-time matching so schools are not left with uncovered classes.", icon: "zap", label: "Ready when you are" },
  { title: "Rated and reviewed", copy: "Every placement earns a verified rating, building a reputation system that schools, teachers, and hirers can trust.", icon: "star", label: "Trust that grows" },
];

const heroStats = [["8,400+", "Verified teachers"], ["2,100+", "Partner schools"], ["94%", "Filled within 2h"], ["4.9★", "Average rating"]] as const;

const pathways = [
  { tag: "Instant matching", title: "Same-day cover, solved in minutes", icon: "zap", steps: ["Post urgent role", "AI matches in real time", "Teacher accepts"] },
  { tag: "Freelance briefs", title: "Long-term roles, properly staffed", icon: "calendar", steps: ["Post brief", "Receive proposals", "Hire best match"] },
  { tag: "Learner support", title: "Verified teachers for learners", icon: "users", steps: ["Create a learner request", "Review verified matches", "Message from your account"] },
];

export function LandingPage() {
  return (
    <div className="marketing-page marketing-home">
      <PublicHeader active="home" />
      <main>
        <section className="marketing-hero">
          <div className="supplyed-content-wrap marketing-hero-grid">
            <div className="marketing-hero-copy">
              <div className="marketing-announcement"><span aria-hidden="true" /> Founding Schools now open <Icon name="arrow" size={14} /></div>
              <h1>Connecting schools and learners with <em>brilliant teachers.</em></h1>
              <p>The right teacher, right now. SupplyED connects UK schools, learners, and hiring accounts with vetted, DBS-checked teachers for urgent cover, planned staffing, tutoring, and learner support. We are onboarding founding schools now.</p>
              <div className="marketing-hero-actions">
                <Link className={buttonClassName({ size: "xl" })} href="/founding-schools">I&apos;m a school <Icon name="arrow" size={17} /></Link>
                <Link className={buttonClassName({ variant: "secondary", size: "xl", className: "marketing-button-light" })} href="/founding-teachers">I&apos;m a teacher</Link>
              </div>
              <Link className="marketing-text-link" href="/signup">I&apos;m hiring talent <Icon name="arrow" size={15} /></Link>
              <div className="marketing-launch-note"><Icon name="pin" size={16} /> <span>Launching 2026 · Greater Manchester &amp; Lancashire</span></div>
            </div>

            <div className="marketplace-preview">
              <div className="marketplace-preview-top"><span><Icon name="grid" size={17} /> THE SUPPLYED WORKSPACE</span><span className="marketplace-preview-status"><i /> Verified marketplace</span></div>
              <div className="marketplace-preview-heading">
                <span className="marketplace-preview-icon"><Icon name="shield" size={28} /></span>
                <div><span className="eyebrow">Better connected</span><h2>The right teacher,<br />right now.</h2></div>
              </div>
              <p className="marketplace-preview-description">From urgent classroom cover to learner support, SupplyED keeps the path from need to verified teacher clear.</p>
              <div className="marketplace-preview-signals">
                {heroSignals.map((signal, index) => (
                  <div key={signal.title} className="marketplace-preview-row">
                    <span className="marketplace-row-icon"><Icon name={signal.icon} size={19} /></span>
                    <div><h3>{signal.title}</h3><p>{signal.copy}</p></div>
                    <span className="marketplace-row-number">0{index + 1}</span>
                  </div>
                ))}
              </div>
              <div className="marketplace-preview-footer"><Icon name="checkCircle" size={17} /><span>Safer checks before activation</span><Icon name="lock" size={14} /></div>
            </div>
          </div>
          <div className="supplyed-content-wrap marketing-hero-stats">
            {heroStats.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="marketing-section">
          <div className="supplyed-content-wrap">
            <div className="marketing-section-heading">
              <div>
                <span className="eyebrow">01 / How it works</span>
                <h2>Two ways to find or fill<br className="hidden sm:block" /> a supply role.</h2>
              </div>
              <p>Post urgent cover for instant matching, or compare proposals for planned cover.</p>
            </div>
            <div className="marketing-pathways">
              {pathways.map((card, index) => (
                <article key={card.title} className={`marketing-pathway marketing-pathway-${index + 1}`}>
                  <div className="marketing-pathway-top">
                    <span><Icon name={card.icon} size={23} /></span>
                    <span className="marketing-index">0{index + 1}</span>
                  </div>
                  <Tag>{card.tag}</Tag>
                  <h3>{card.title}</h3>
                  <ol>
                    {card.steps.map((step, stepIndex) => (
                      <li key={step}><span>{stepIndex + 1}</span>{step}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-section-muted">
          <div className="supplyed-content-wrap">
            <div className="marketing-section-heading">
              <div>
                <span className="eyebrow">02 / Confidence built in</span>
                <h2>Good education starts<br className="hidden sm:block" /> with people you trust.</h2>
              </div>
              <p>Enhanced DBS, identity, right-to-work, profile review, ratings, and role status stay connected before teachers enter the marketplace.</p>
            </div>
            <div className="marketing-trust-grid">
              {trustCards.map((card) => (
                <article key={card.title}>
                  <span className="marketing-trust-icon"><Icon name={card.icon} size={23} /></span>
                  <span className="eyebrow">{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="register-interest" className="marketing-section marketing-registration">
          <div className="supplyed-content-wrap marketing-registration-grid">
            <div>
              <span className="eyebrow">03 / Founding schools &amp; teachers</span>
              <h2>Shape the platform.<br /><span className="text-brand">Lock in founding terms.</span></h2>
              <div className="marketing-benefit-list">
                {[
                  ["Schools: founding pricing, locked for 2 years", "your launch rate never rises while you stay with us."],
                  ["Teachers: a founding rate uplift", "an extra GBP 5 per day on SupplyED bookings, locked for 18 months from launch."],
                  ["Direct line to the founder", "monthly input sessions that shape the roadmap."],
                  ["Priority access at launch", "your roles reach verified teachers first."],
                ].map(([title, copy]) => (
                  <div key={title}>
                    <Icon name="checkCircle" size={20} />
                    <p><strong>{title}</strong><span>{copy}</span></p>
                  </div>
                ))}
              </div>
            </div>
            <RegisterInterestForm />
          </div>
        </section>

        <section className="marketing-closing">
          <div className="supplyed-content-wrap">
            <div>
              <span className="eyebrow">Your next chapter</span>
              <h2>Ready to transform<br />your staffing?</h2>
              <p>Join 2,100+ schools already using SupplyED to cover urgent staffing, long-term briefs, and learner support.</p>
            </div>
            <div className="marketing-closing-actions">
              <Link className={buttonClassName({ size: "xl" })} href="/founding-schools">
                Get started free <Icon name="arrow" size={18} />
              </Link>
              <Link className={buttonClassName({ variant: "secondary", size: "xl", className: "marketing-button-light" })} href="/pricing">
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
