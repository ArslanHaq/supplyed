"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClassName, Icon } from "@/components/atoms";
import { FoundingInterestForm } from "./FoundingInterestForm";
import { WaitlistSchoolIntro } from "./WaitlistSchoolIntro";
import { WaitlistTeacherIntro } from "./WaitlistTeacherIntro";

const journeys = [
  {
    audience: "Schools",
    steps: [
      [
        "Register your school",
        "Set up your account and add the staff who book cover.",
      ],
      [
        "Post the cover you need",
        "Date, year group, subject. Only fully checked teachers see it.",
      ],
      [
        "Confirm and you’re covered",
        "Pick a teacher, confirm the booking, and their checks are on file.",
      ],
    ],
  },
  {
    audience: "Teachers",
    steps: [
      [
        "Build your profile",
        "Your subjects, phases, availability, and how far you’ll travel.",
      ],
      [
        "Get verified once",
        "DBS, ID, right to work, and qualifications, shared with the schools you work for.",
      ],
      [
        "Accept the days you want",
        "Bookings land in the app. Say yes to the ones that fit.",
      ],
    ],
  },
];
const questions = [
  [
    "What happens after I join the waitlist?",
    "Nothing you need to do yet. We’ll be in touch ahead of the pilot about a place in the first cohort. Checks and onboarding only start if you decide to sign up.",
  ],
  [
    "When does SupplyED launch?",
    "We pilot with founding schools from January 2027 and plan to open to every school in our launch area from September 2027.",
  ],
  [
    "Which areas do you cover?",
    "Greater Manchester and Lancashire at launch. Schools elsewhere are welcome to register their interest.",
  ],
  [
    "How is this different from an agency?",
    "Schools and teachers connect directly through SupplyED. Schools post cover, verified teachers choose suitable work, and booking details stay together in the platform.",
  ],
  [
    "What does it cost?",
    "Joining the waitlist is free and carries no commitment. We’ll share programme terms before you decide to join the pilot.",
  ],
  [
    "Do I need a DBS already?",
    "No, not to join the waitlist. If you sign up with the first teacher cohort, SupplyED pays for your Enhanced DBS and compliance checks then.",
  ],
];

export function HomeWaitlistSection() {
  const [audience, setAudience] = useState<"SCHOOL" | "TEACHER">("SCHOOL");
  const [formVersion, setFormVersion] = useState(0);
  function join(type: "SCHOOL" | "TEACHER") {
    setAudience(type);
    setFormVersion((version) => version + 1);
    document.getElementById("register-interest")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
  return (
    <>
      <section
        id="register-interest"
        className={`marketing-section marketing-registration ${audience === "TEACHER" ? "waitlist-teacher-registration" : ""}`}
      >
        <div className="supplyed-content-wrap marketing-registration-grid waitlist-registration-grid">
          {audience === "SCHOOL" ? (
            <WaitlistSchoolIntro />
          ) : (
            <WaitlistTeacherIntro />
          )}
          <FoundingInterestForm
            key={`${audience}-${formVersion}`}
            allowTypeSelection
            id="landing-interest-form"
            source="landing-page-interest"
            type={audience}
            onAudienceChange={setAudience}
          />
        </div>
      </section>
      <div className="home-waitlist-sections">
        <section className="waitlist-section waitlist-soft-section">
          <div className="supplyed-content-wrap">
            <div className="waitlist-section-heading">
              <h2>Built for both sides of a booking</h2>
              <p>
                Schools get cover they can trust. Teachers get work without an
                agency taking a cut of every day.
              </p>
            </div>
            <div className="waitlist-two-columns">
              <article className="waitlist-benefit-card">
                <span className="eyebrow">For schools</span>
                <h3>Stop chasing paperwork for every cover day</h3>
                <ul className="waitlist-checks">
                  {[
                    "Every teacher’s DBS, ID, right to work and relevant qualifications are checked before they can accept a booking.",
                    "See exactly who’s coming in and book them directly, with one clear processing fee per booking.",
                    "Simple direct-to-school evidence ready to support safer recruitment and your next audit.",
                  ].map((text) => (
                    <li key={text}>
                      <Icon name="check" size={18} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={buttonClassName({ variant: "secondary" })}
                  onClick={() => join("SCHOOL")}
                >
                  Join as a school
                </button>
              </article>
              <article className="waitlist-benefit-card">
                <span className="eyebrow">For teachers</span>
                <h3>Do your checks once, then choose your days</h3>
                <ul className="waitlist-checks">
                  {[
                    "Join the first cohort and SupplyED pays for your Enhanced DBS when you sign up.",
                    "Pick the schools and days that suit you. Nobody rings you at 7am to fill a gap.",
                    "Get paid by the school directly through the platform.",
                  ].map((text) => (
                    <li key={text}>
                      <Icon name="check" size={18} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={buttonClassName({ variant: "secondary" })}
                  onClick={() => join("TEACHER")}
                >
                  Join as a teacher
                </button>
              </article>
            </div>
          </div>
        </section>
        <section className="waitlist-section" id="waitlist-how-it-works">
          <div className="supplyed-content-wrap">
            <div className="waitlist-section-heading">
              <h2>How it works</h2>
              <p>
                Joining the waitlist is just a show of interest. The steps below
                start when you sign up as part of the first cohort.
              </p>
            </div>
            {journeys.map(({ audience, steps }) => (
              <div className="waitlist-steps-group" key={audience}>
                <h3 className="eyebrow">{audience}</h3>
                <ol className="waitlist-steps">
                  {steps.map(([title, copy], index) => (
                    <li key={title}>
                      <span>0{index + 1}</span>
                      <h4>{title}</h4>
                      <p>{copy}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
        <section className="waitlist-section waitlist-programmes">
          <div className="supplyed-content-wrap">
            <div className="waitlist-section-heading">
              <h2>Be one of the first in</h2>
              <p>
                Two founding programmes run alongside the January 2027 pilot.
                Waitlist members hear about them first, and onboarding and
                checks happen when you sign up.
              </p>
            </div>
            <div className="waitlist-two-columns">
              <article>
                <h3>Founding Schools Programme</h3>
                <p>20 places. Pilot runs January to July 2027.</p>
                <p>
                  Help shape the platform and discuss the founding route that
                  fits your school.
                </p>
                <Link href="/founding-schools">
                  Explore the programme <Icon name="arrow" size={17} />
                </Link>
              </article>
              <article>
                <h3>Founding Teachers Programme</h3>
                <p>
                  Sign up with the first cohort and SupplyED pays for your
                  Enhanced DBS and compliance checks.
                </p>
                <Link href="/founding-teachers">
                  Teacher programme <Icon name="arrow" size={17} />
                </Link>
              </article>
            </div>
          </div>
        </section>
        <section className="waitlist-section">
          <div className="supplyed-content-wrap">
            <div className="waitlist-section-heading">
              <h2>The checks behind every booking</h2>
              <p>
                Teachers complete these when they sign up with the first cohort,
                not when they join the waitlist.
              </p>
            </div>
            <div className="waitlist-compliance-grid">
              {[
                ["shield", "Enhanced DBS", "Children’s barred list included"],
                [
                  "user",
                  "Identity and right to work",
                  "Identity and eligibility verified",
                ],
                [
                  "award",
                  "QTS and prohibitions",
                  "Checked against TRA records where applicable",
                ],
                ["file", "References", "Part of the safer-recruitment process"],
              ].map(([icon, title, copy]) => (
                <article key={title}>
                  <Icon name={icon} size={25} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="waitlist-section" id="faq">
          <div className="supplyed-content-wrap waitlist-faq-grid">
            <div className="waitlist-section-heading">
              <h2>Questions</h2>
            </div>
            <div className="waitlist-faq">
              {questions.map(([question, answer], index) => (
                <details key={question} open={index === 0}>
                  <summary>
                    {question}
                    <Icon name="plus" size={17} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="waitlist-section waitlist-soft-section waitlist-closing">
          <div className="waitlist-wrap">
            <h2>Get on the list before we open</h2>
            <p>
              It takes under a minute. No checks, no commitment, and first
              refusal on a founding place.
            </p>
            <div>
              <button
                className={buttonClassName({ size: "lg" })}
                onClick={() => join("SCHOOL")}
              >
                I&apos;m a school
              </button>
              <button
                className={buttonClassName({
                  variant: "secondary",
                  size: "lg",
                })}
                onClick={() => join("TEACHER")}
              >
                I&apos;m a teacher
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
