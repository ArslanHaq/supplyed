import type { OfferedJobTerms } from "@/features/jobs/offered-terms";
import { FormattedJobDescription } from "./FormattedJobDescription";
import { formatPlannedUnits } from "@/features/jobs/work-units";

export function AgreedTerms({ terms, legacy = false }: { terms: OfferedJobTerms | null | undefined; legacy?: boolean }) {
  if (!terms) return <p role="status" className="my-4 rounded-lg bg-warning-tint p-4 text-sm">{legacy ? "Only the original booking dates and pay are available. Other agreed terms are unavailable." : "Original agreed terms are unavailable. A new invitation and teacher acceptance are required before hiring."}</p>;
  const date = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "Not recorded";
  return <section className="card my-5 p-5">
    <h2 className="font-heading text-xl">Agreed terms</h2>
    <p className="mt-2 font-semibold">{terms.title}</p>
    <dl className="my-4 grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">Work dates (UK time)</dt><dd>{date(terms.startDate)} – {date(terms.endDate)}</dd></div>
      <div><dt className="text-muted">Pay and work units</dt><dd>{terms.payAmount == null ? "Not recorded" : `£${terms.payAmount} ${terms.payType ?? ""}`} · {formatPlannedUnits(terms)}</dd></div>
      <div><dt className="text-muted">Location</dt><dd>{[terms.address, terms.city, terms.county, terms.postalCode, terms.countryCode].filter(Boolean).join(", ") || "Not recorded"}</dd></div>
      <div><dt className="text-muted">Subjects and key stages</dt><dd>{[...terms.subjects, ...terms.keyStages].join(", ") || "Not recorded"}</dd></div>
      <div><dt className="text-muted">Required skills</dt><dd>{terms.requiredSkills.join(", ") || "None specified"}</dd></div>
      <div><dt className="text-muted">Minimum experience</dt><dd>{terms.minExperienceYears == null ? "None specified" : `${terms.minExperienceYears} years`}</dd></div>
    </dl>
    <FormattedJobDescription description={terms.description} />
    {terms.parkingInfo ? <p className="mt-3 text-sm">Parking: {terms.parkingInfo}</p> : null}
  </section>;
}
