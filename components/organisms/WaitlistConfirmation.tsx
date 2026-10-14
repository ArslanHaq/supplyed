"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Field, Icon } from "@/components/atoms";
import {
  type FoundingInterestSubmitResult,
  type WaitlistDetailsState,
} from "@/features/contact/actions";
import { submitWaitlistDetailsAction } from "@/features/contact/waitlist-client";
import { waitlistPhases } from "@/features/contact/waitlist-options";

export function WaitlistConfirmation({
  result,
  firstName,
  email,
  type,
  id,
}: {
  result: FoundingInterestSubmitResult;
  firstName: string;
  email: string;
  type: "SCHOOL" | "TEACHER";
  id: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [shareUrl] = useState(() =>
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/founding-teachers?source=teacher-share`,
  );
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  }, []);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMessage("Invite link copied.");
    } catch {
      setCopyMessage("Select and copy the invite link below.");
    }
  }
  const teacher = type === "TEACHER";
  return (
    <section
      className="waitlist-confirmation"
      id={id}
      aria-labelledby={`${id}-confirmation`}
    >
      <div className="waitlist-confirmation-header">
        <span className="waitlist-success-icon">
          <Icon name="check" size={26} />
        </span>
        <span className="eyebrow">
          {teacher ? "Teacher" : "School"} waitlist
        </span>
        <h2 id={`${id}-confirmation`} ref={heading} tabIndex={-1}>
          {result.alreadyRegistered
            ? "You’re already on the list."
            : `You’re on the list, ${firstName}.`}
        </h2>
        <p>
          {result.confirmationEmailSent
            ? `We’ve sent a confirmation to ${email}. `
            : `Your interest is registered for ${email}. `}
          There&apos;s nothing else you need to do right now.
        </p>
      </div>
      <div className="waitlist-confirmation-body">
        <h3>What happens next</h3>
        <ol className="waitlist-next-steps">
          <li>
            <strong>Now: you&apos;re registered</strong>
            <span>
              No checks, no commitment. We&apos;ll keep you posted on launch.
            </span>
          </li>
          <li>
            <strong>Ahead of January 2027: invitations</strong>
            <span>
              We&apos;ll email you about a place in the first cohort before the
              pilot.
            </span>
          </li>
          <li>
            <strong>
              {teacher
                ? "If you sign up: checks, on us"
                : "If you sign up: get ready for cover"}
            </strong>
            <span>
              {teacher
                ? "SupplyED pays for your Enhanced DBS and compliance checks before you start accepting bookings."
                : "Set up your school and the staff who book cover. Onboarding starts when you choose to join."}
            </span>
          </li>
        </ol>
        {teacher && result.detailsToken ? (
          <TeacherDetails id={result.id} token={result.detailsToken} />
        ) : null}
        {teacher ? (
          <div className="waitlist-share">
            <h3>Know a teacher who&apos;d want this?</h3>
            <p>Invite them to join the teacher waitlist.</p>
            <label className="sr-only" htmlFor={`${id}-invite`}>
              Teacher invite link
            </label>
            <input
              className="input"
              id={`${id}-invite`}
              onFocus={(e) => e.currentTarget.select()}
              readOnly
              value={shareUrl}
            />
            <div className="waitlist-share-actions">
              <Button
                onClick={copyLink}
                type="button"
                variant="secondary"
                disabled={!shareUrl}
              >
                Copy link
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join me on the SupplyED teacher waitlist: ${shareUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Share on WhatsApp
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent("SupplyED teacher waitlist")}&body=${encodeURIComponent(`You might be interested in the SupplyED teacher waitlist: ${shareUrl}`)}`}
              >
                Share by email
              </a>
            </div>
            <p role="status">{copyMessage}</p>
          </div>
        ) : null}
        <Link className="waitlist-back-link" href="/">
          Back to home <Icon name="arrow" size={15} />
        </Link>
      </div>
    </section>
  );
}

function TeacherDetails({ id, token }: { id: string; token: string }) {
  const [state, action, pending] = useActionState(
    submitWaitlistDetailsAction,
    null as WaitlistDetailsState,
  );
  const [phases, setPhases] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [postcode, setPostcode] = useState("");
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="waitlist-extra-details">
      <input name="id" type="hidden" value={id} />
      <input name="token" type="hidden" value={token} />
      <h3>
        Tell us a bit more <span>(optional)</span>
      </h3>
      <p>
        Helps us bring the right schools on board first. Your place is already
        saved.
      </p>
      <fieldset disabled={pending}>
        <legend>Phases you teach</legend>
        <div className="waitlist-phase-options">
          {waitlistPhases.map((phase) => (
            <label key={phase}>
              <input
                checked={phases.includes(phase)}
                name="phases"
                onChange={(e) =>
                  setPhases((current) =>
                    e.target.checked
                      ? [...current, phase]
                      : current.filter((value) => value !== phase),
                  )
                }
                type="checkbox"
                value={phase}
              />
              {phase}
            </label>
          ))}
        </div>
        {errors?.phases ? (
          <p className="text-danger" role="alert">
            {errors.phases}
          </p>
        ) : null}
        <div className="waitlist-field-grid">
          <Field
            label="Main subject (secondary)"
            error={errors?.mainSubject}
            htmlFor={`${id}-subject`}
          >
            <input
              className="input"
              id={`${id}-subject`}
              name="mainSubject"
              maxLength={100}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Maths"
              value={subject}
            />
          </Field>
          <Field
            label="Postcode area"
            error={errors?.postcode}
            htmlFor={`${id}-postcode`}
          >
            <input
              autoComplete="postal-code"
              className="input"
              id={`${id}-postcode`}
              name="postcode"
              maxLength={20}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. M20"
              value={postcode}
            />
          </Field>
        </div>
        <Button
          loading={pending}
          loadingLabel="Saving details"
          type="submit"
          variant="secondary"
        >
          Save these details
        </Button>
      </fieldset>
      {state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-success" : "text-danger"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
