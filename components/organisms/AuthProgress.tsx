import { Icon } from "../atoms";

/** A shared, non-interactive overview of the existing account creation flow. */
export function AuthProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Account setup progress" className="auth-progress">
      {["Account", "Verification", "Onboarding"].map((label, index) => {
        const step = index + 1;
        return (
          <li key={label} aria-current={current === step ? "step" : undefined} data-complete={step < current}>
            <span className="auth-progress-number" aria-hidden="true">
              {step < current ? <Icon name="check" size={13} /> : `0${step}`}
            </span>
            <span>{label}</span>
            <span className="sr-only">{step < current ? ", complete" : current === step ? ", current step" : ", upcoming"}</span>
          </li>
        );
      })}
    </ol>
  );
}
