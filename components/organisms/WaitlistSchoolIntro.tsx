import { Icon } from "@/components/atoms";

export function WaitlistSchoolIntro() {
  return (
    <div className="waitlist-school-intro">
      <span className="waitlist-pilot-badge">
        Greater Manchester and Lancashire · Pilot from January 2027
      </span>
      <h2>Supply cover that&apos;s checked before it&apos;s booked.</h2>
      <p>
        SupplyED connects schools directly with vetted supply teachers. We run
        the compliance checks centrally, so you book with confidence and
        teachers only do the paperwork once.
      </p>
      <ul className="waitlist-checks">
        {[
          "Enhanced DBS checked on every teacher",
          "Identity and right to work verified",
          "QTS status confirmed with the TRA",
        ].map((text) => (
          <li key={text}>
            <Icon name="checkCircle" size={19} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
