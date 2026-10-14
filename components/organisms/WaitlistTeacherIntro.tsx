import { Icon } from "@/components/atoms";

export function WaitlistTeacherIntro() {
  return (
    <div className="waitlist-teacher-intro">
      <span className="eyebrow">Teacher waitlist</span>
      <h2>Get first refusal on supply work that suits you</h2>
      <p>
        Register your interest now. There are no checks and nothing to commit
        to. We&apos;ll offer you a place in the first cohort ahead of the
        January 2027 pilot in Greater Manchester and Lancashire.
      </p>
      <div className="waitlist-teacher-benefits">
        <h3>If you join the first cohort</h3>
        <ul className="waitlist-checks">
          {[
            "SupplyED pays for your Enhanced DBS and compliance checks",
            "You choose the schools and days you work",
            "You’re paid by the school directly through the platform",
          ].map((text) => (
            <li key={text}>
              <Icon name="check" size={20} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
