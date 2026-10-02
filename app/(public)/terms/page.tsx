import type { Metadata } from "next";
import Link from "next/link";

import { PublicThemeControls } from "@/components/molecules";
import { PublicHeader } from "@/components/organisms/PublicHeader";
import { Tag } from "@/components/atoms";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply to schools, multi-academy trusts, and supply teachers using the SupplyED marketplace.",
  alternates: {
    canonical: "/terms",
  },
};

// Placeholder copy for the prototype. Replace with solicitor-reviewed terms
// before launch, and bump the version whenever the wording changes.
const termsVersion = "2026-10";
const lastUpdated = "2 October 2026";

type TermsSection = {
  id: string;
  title: string;
  audience?: string;
  clauses: string[];
};

const sections: TermsSection[] = [
  {
    id: "about",
    title: "About these terms",
    clauses: [
      "These terms form an agreement between you and SupplyED Ltd (\"SupplyED\", \"we\", \"us\") when you create an account or use the SupplyED platform.",
      "SupplyED is a marketplace that connects UK schools and multi-academy trusts directly with verified supply teachers. We are not an employment business and we do not employ teachers who find work through the platform.",
      "By ticking the terms box at sign up you confirm that you have read and accept these terms. If you do not accept them, do not create an account.",
    ],
  },
  {
    id: "accounts",
    title: "Your account",
    clauses: [
      "You must be at least 18 years old and give accurate, current information when you register and throughout your use of SupplyED.",
      "You are responsible for keeping your login details secure, including any two-factor authentication method. Tell us straight away if you think your account has been accessed without permission.",
      "Each account is for one person or one organisation. You must not share an account, create accounts on behalf of others without authority, or impersonate anyone.",
    ],
  },
  {
    id: "verification",
    title: "Verification and safeguarding",
    clauses: [
      "Safeguarding comes first. We check identity, right to work, qualifications, references, and Enhanced DBS status before a teacher profile is approved for bookings.",
      "Verification reduces risk but does not remove a school's own statutory duties under Keeping Children Safe in Education. Schools remain responsible for their own safer recruitment decisions.",
      "We may suspend or remove any account, at any time, where we have a safeguarding concern, receive information that a check is no longer valid, or are required to do so by law.",
    ],
  },
  {
    id: "schools",
    title: "Terms for schools and MATs",
    audience: "Schools & trusts",
    clauses: [
      "Only authorised staff may manage a school workspace. A school joining through a multi-academy trust must have the trust's signatory approval before the workspace can book teachers.",
      "Job posts must be accurate, lawful, and describe the real role, including dates, hours, subject, key stage, and the daily rate offered.",
      "When you confirm a booking you agree to pay the agreed daily rate for the days worked, plus the SupplyED processing fee shown at checkout. Invoices are payable within 14 days unless agreed otherwise in writing.",
      "Bookings cancelled less than 24 hours before the start time may incur a cancellation charge of up to one day's rate, payable to the teacher.",
      "You must provide teachers with a safe working environment, a site induction, and access to the school's safeguarding policy and designated safeguarding lead.",
      "You must not use SupplyED to contact teachers you found on the platform in order to book them off-platform for 12 months after first contact. If you do, an introduction fee may apply.",
    ],
  },
  {
    id: "teachers",
    title: "Terms for supply teachers",
    audience: "Teachers",
    clauses: [
      "You confirm you have the right to work in the UK and that the qualifications, experience, and documents you upload are genuine and your own.",
      "You must keep your DBS status, qualifications, and availability up to date, and tell us within 48 hours of any change that could affect your suitability to work with children.",
      "Teachers using SupplyED work as independent contractors and are responsible for their own tax and National Insurance, unless a booking expressly states otherwise.",
      "When you accept a booking you agree to attend on time and follow the school's policies, including its safeguarding, behaviour, and data protection policies.",
      "If you need to cancel a confirmed booking, give as much notice as possible and at least 24 hours where you can. Repeated late cancellations may lead to your profile being paused.",
      "Payouts for completed days are made to your connected payout account once the school has paid. Payout timings are shown on the Payouts page.",
    ],
  },
  {
    id: "fees",
    title: "Fees and payments",
    clauses: [
      "Creating a teacher profile is free. Schools pay the fees shown on the Pricing page or in their signed founding agreement.",
      "Payments are processed by our payment partner, Stripe. By connecting a payout or payment account you also agree to Stripe's own terms.",
      "We may change our standard fees with at least 30 days' notice. Founding terms locked in writing are honoured for the period stated in that agreement.",
    ],
  },
  {
    id: "conduct",
    title: "Acceptable use",
    clauses: [
      "You must not post anything that is unlawful, discriminatory, misleading, or offensive, or that shares another person's personal data without a lawful basis.",
      "You must not try to bypass the platform's security, scrape data, or interfere with how SupplyED works for other users.",
      "Messages on SupplyED should relate to roles and bookings. We may review messages where needed to investigate a safeguarding or misuse report.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy and data",
    clauses: [
      "We process personal data in line with UK GDPR and the Data Protection Act 2018. We use it to run your account, carry out verification checks, match schools and teachers, and take payments.",
      "When a teacher applies for or accepts a role, relevant profile and compliance information is shared with that school so it can make a safer recruitment decision.",
      "Verification documents are stored securely and kept only as long as needed for safeguarding and legal purposes. You can ask for a copy of your data, or ask us to correct or delete it, by contacting us.",
    ],
  },
  {
    id: "liability",
    title: "Liability",
    clauses: [
      "We provide the platform with reasonable skill and care, but we do not guarantee that a suitable teacher or role will always be available.",
      "Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law.",
      "Otherwise, our total liability to you in any 12-month period is limited to the fees you paid to SupplyED in that period.",
    ],
  },
  {
    id: "ending",
    title: "Ending your account",
    clauses: [
      "You can close your account at any time from Settings. Bookings already confirmed must still be honoured or cancelled under these terms.",
      "We may suspend or close an account that breaches these terms, with notice where it is safe and lawful to give it.",
    ],
  },
  {
    id: "changes",
    title: "Changes and governing law",
    clauses: [
      "We may update these terms. If a change materially affects you we will tell you by email or in the app before it takes effect, and may ask you to accept the new version.",
      "These terms are governed by the laws of England and Wales, and the courts of England and Wales have jurisdiction over any dispute.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-chalk">
      <PublicHeader />

      <main>
        <section className="bg-white px-4 py-14 sm:px-6 lg:px-12 lg:py-16">
          <div className="mx-auto max-w-[1180px]">
            <div className="max-w-[720px]">
              <Tag>Legal</Tag>
              <h1 className="mt-5 font-serif text-4xl leading-[1.05] sm:text-5xl">Terms &amp; Conditions</h1>
              <p className="mt-5 text-base leading-7 text-muted">
                The terms that apply when schools, multi-academy trusts, and supply teachers use SupplyED. Shared terms apply to
                everyone; the school and teacher sections apply to those accounts only.
              </p>
              <p className="mt-4 text-sm text-muted">
                Version {termsVersion} · Last updated {lastUpdated}
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-12">
          <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[240px_1fr]">
            <nav aria-label="Terms sections" className="lg:sticky lg:top-6 lg:self-start">
              <div className="eyebrow mb-3">Contents</div>
              <ol className="grid gap-1 text-sm">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a className="block rounded-md px-2 py-1.5 text-muted hover:bg-white hover:text-ink" href={`#${section.id}`}>
                      {index + 1}. {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="grid gap-4">
              {sections.map((section, index) => (
                <article
                  key={section.id}
                  className="scroll-mt-6 rounded-xl border border-border bg-white p-5 sm:p-7"
                  id={section.id}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-serif text-2xl">
                      {index + 1}. {section.title}
                    </h2>
                    {section.audience ? <Tag tone={section.id === "teachers" ? "green" : ""}>{section.audience}</Tag> : null}
                  </div>
                  <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate">
                    {section.clauses.map((clause, clauseIndex) => (
                      <li key={clause} className="flex gap-3">
                        <span className="shrink-0 font-semibold text-muted">
                          {index + 1}.{clauseIndex + 1}
                        </span>
                        <span>{clause}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}

              <div className="rounded-xl border border-border bg-white p-5 text-sm leading-6 text-muted sm:p-7">
                Questions about these terms? Email{" "}
                <a className="font-semibold text-brand underline underline-offset-2" href={`mailto:${siteConfig.contactEmail}`}>
                  {siteConfig.contactEmail}
                </a>
                . Ready to join?{" "}
                <Link className="font-semibold text-brand underline underline-offset-2" href="/signup">
                  Create an account
                </Link>
                .
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicThemeControls />
    </div>
  );
}
