"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toDataURL } from "qrcode";
import { type ReactNode, useEffect, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import {
  describeIdentityState,
  identityStateTag,
  identityStepRequired,
  shortDate,
} from "@/features/identity-verification/presentation";
import type { MyIdentityVerification } from "@/features/identity-verification/types";
import {
  useMyIdentityVerification,
  useStartIdentityVerification,
} from "@/features/identity-verification/use-identity-verification";
import { cn } from "@/lib/cn";
import { startRouteLoading } from "@/lib/navigation-loading";

import { Btn, buttonClassName, Checkbox, Icon, Logo, Tag } from "../atoms";
import { PhoneVerification } from "../molecules/PhoneVerification";

type VerifyIdentityUser = { phone: string; phoneVerified: boolean };

/**
 * The identity step of opening a teacher account: verify the phone, then
 * verify identity and right to work with TrustID. TrustID's journey runs in
 * the phone's own browser (never an iframe), so a desktop shows a QR code.
 */
export function VerifyIdentityPage({
  continueHref,
  initialIdentity,
  user,
}: {
  /** Where "Continue" goes: the documents step while onboarding, otherwise the dashboard. */
  continueHref: string;
  initialIdentity: MyIdentityVerification | null;
  user: VerifyIdentityUser;
}) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const query = useMyIdentityVerification({ initialData: initialIdentity });
  const identity = query.data ?? null;
  const savedPhone = currentUser.data?.phone ?? user.phone;
  const phoneVerified = currentUser.data?.phoneVerified ?? user.phoneVerified;
  const [phone, setPhone] = useState(savedPhone);
  const canContinue = identity ? !identityStepRequired(identity) : false;
  const tag = identity ? identityStateTag(identity.state) : null;

  function go(href: string) {
    startRouteLoading();
    router.push(href);
  }

  async function logout() {
    await signOut({ redirect: false });
    go("/login");
  }

  return (
    <div className="account-status-shell min-h-screen bg-chalk">
      <header className="flex min-h-[76px] items-center justify-between border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-12">
        <Logo size={20} onClick={() => go("/")} />
        <Btn variant="ghost" onClick={() => void logout()}>Logout</Btn>
      </header>

      <main className="mx-auto max-w-[920px] px-4 py-10 sm:px-6 lg:px-8">
        <section className="account-status-card w-full border border-border bg-white">
          <Tag>Account setup</Tag>
          <h1 className="mt-4 font-heading">Verify your identity</h1>
          <p className="mt-3 max-w-[700px] text-base leading-7 text-muted">
            Schools need to know who they are welcoming into the classroom. Before you can work through SupplyED, we confirm your identity and your right to work in the UK with our partner TrustID.
          </p>

          <ol className="mt-8 space-y-4">
            <StepCard done={phoneVerified} number={1} title="Verify your phone">
              {phoneVerified ? (
                <p className="text-sm leading-6 text-muted">{savedPhone} is verified. We&apos;ll text your TrustID link to it.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-muted">We&apos;ll text your TrustID link to this number, so confirm it first.</p>
                  <PhoneVerification
                    hidePhoneInput={Boolean(savedPhone)}
                    onChange={setPhone}
                    phone={phone || savedPhone}
                    required
                    savedPhone={savedPhone}
                    verified={phoneVerified}
                  />
                </div>
              )}
            </StepCard>

            <StepCard
              done={identity?.state === "VERIFIED"}
              locked={!phoneVerified}
              number={2}
              tag={tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : null}
              title="Verify your identity with TrustID"
            >
              {identity ? (
                <IdentityStep identity={identity} phoneVerified={phoneVerified} />
              ) : query.isError ? (
                <div className="text-sm font-semibold text-danger" role="alert">
                  Your identity check could not be loaded.{" "}
                  <button className="underline" onClick={() => void query.refetch()} type="button">Retry</button>
                </div>
              ) : (
                <p className="text-sm text-muted" role="status">Checking your identity verification...</p>
              )}
            </StepCard>
          </ol>

          {canContinue ? (
            <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted">
                {identity?.state === "VERIFIED"
                  ? "You're verified."
                  : "You can carry on while your check is completed. You can send your profile for review once you're verified."}
              </span>
              <Btn iconRight="arrow" onClick={() => go(continueHref)} size="lg">
                {continueHref === "/onboarding" ? "Continue to documents" : "Continue"}
              </Btn>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function StepCard({
  children,
  done,
  locked = false,
  number,
  tag,
  title,
}: {
  children: ReactNode;
  done: boolean;
  locked?: boolean;
  number: number;
  tag?: ReactNode;
  title: string;
}) {
  return (
    <li className={cn("rounded-xl border p-5", done ? "border-success bg-success-tint" : "border-border bg-white", locked && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
            done ? "border-success bg-white text-success" : "border-brand bg-white text-ink",
          )}
        >
          {done ? <Icon name="check" size={14} /> : number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{title}</h2>
            {tag}
          </div>
          <div className="mt-2">{locked ? <p className="text-sm text-muted">Verify your phone first.</p> : children}</div>
        </div>
      </div>
    </li>
  );
}

function IdentityStep({ identity, phoneVerified }: { identity: MyIdentityVerification; phoneVerified: boolean }) {
  const { state, verification } = identity;

  // A live link wins: also how a verified teacher completes a follow-up right to work check.
  if (verification?.status === "LINK_SENT" && verification.guestLinkUrl) {
    return <HandOff expiresAt={verification.linkExpiresAt} url={verification.guestLinkUrl} />;
  }

  if (state === "NOT_STARTED" && identity.canStart) {
    return <StartCheck description={describeIdentityState(identity)} phoneVerified={phoneVerified} />;
  }

  const outcome = {
    icon: state === "VERIFIED" ? "checkCircle" : state === "UNSUCCESSFUL" ? "x" : state === "PROCESSING" ? "loader" : "clock",
    tone: state === "VERIFIED" ? "text-success" : state === "UNSUCCESSFUL" ? "text-danger" : "text-brand",
  };

  return (
    <div className="flex items-start gap-3" role="status">
      <Icon className={cn("mt-0.5 shrink-0", outcome.tone, state === "PROCESSING" && "animate-spin")} name={outcome.icon} size={18} />
      <p className="text-sm leading-6 text-muted">{describeIdentityState(identity)}</p>
    </div>
  );
}

function StartCheck({ description, phoneVerified }: { description: string; phoneVerified: boolean }) {
  const start = useStartIdentityVerification();
  const [consent, setConsent] = useState(false);

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted">{description}</p>

      <ul className="grid gap-3 sm:grid-cols-3">
        <Need icon="user" text="With a camera, for photos of your document and a selfie." title="Your phone" />
        <Need icon="file" text="Your passport, or a Home Office share code if you have one." title="Your ID" />
        <Need icon="clock" text="You can close this page; we'll email you when it's done." title="About 5 minutes" />
      </ul>

      <Checkbox
        checked={consent}
        label={
          <span>
            I agree to TrustID checking my identity document and a selfie (biometric data) to confirm my identity and right to work.{" "}
            <a className="font-semibold text-brand underline" href="/terms#privacy" rel="noopener noreferrer" target="_blank">How we use your data</a>
          </span>
        }
        onChange={setConsent}
      />

      <div>
        <Btn
          disabled={!consent || !phoneVerified}
          icon="shield"
          loading={start.isPending}
          loadingLabel="Starting"
          onClick={() => start.mutate()}
          size="lg"
        >
          Verify my identity
        </Btn>
        {start.error ? <div className="mt-2 text-sm font-semibold text-danger" role="alert">{start.error.message}</div> : null}
      </div>
    </div>
  );
}

function Need({ icon, text, title }: { icon: string; text: string; title: string }) {
  return (
    <li className="rounded-lg border border-border bg-chalk p-4">
      <Icon className="text-brand" name={icon} size={18} />
      <div className="mt-2 text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
    </li>
  );
}

/** On a phone: a button. On a desktop: a QR code to carry on with the phone. */
function HandOff({ expiresAt, url }: { expiresAt: string; url: string }) {
  return (
    <div className="space-y-4">
      <div className="grid items-center gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="hidden md:block">
          <GuestLinkQr url={url} />
        </div>
        <div>
          <div className="hidden font-semibold md:block">Scan this code with your phone&apos;s camera</div>
          <p className="mt-1 hidden text-sm leading-6 text-muted md:block">
            It opens TrustID on your phone, where you photograph your passport (or enter your share code) and take a selfie. We&apos;ve also emailed and texted you the link.
          </p>
          <p className="text-sm leading-6 text-muted md:hidden">
            TrustID opens in your browser. Photograph your passport (or enter your share code) and take a selfie.
          </p>
          <a
            className={buttonClassName({ className: "mt-3 md:hidden", size: "lg" })}
            href={url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Continue with TrustID
            <Icon name="arrowRight" size={16} />
          </a>
          <a className="mt-2 hidden text-sm font-semibold text-brand underline md:inline-block" href={url} rel="noopener noreferrer" target="_blank">
            Or open the link on this device
          </a>
          <p className="mt-3 text-xs text-muted">The link works once and expires on {shortDate(expiresAt)}.</p>
        </div>
      </div>
      <div className="inline-flex items-center gap-2 text-sm text-muted" role="status">
        <Icon className="animate-spin" name="loader" size={15} />
        This page updates when TrustID has your results.
      </div>
    </div>
  );
}

/** Drawn in the browser, so the link never goes to a third-party QR service. */
function GuestLinkQr({ url }: { url: string }) {
  const [qr, setQr] = useState<{ src: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 208 })
      .then((src) => {
        if (!cancelled) setQr({ src, url });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (qr?.url !== url) {
    return <div aria-label="Preparing QR code" className="h-[208px] w-[208px] animate-pulse rounded-lg bg-chalk" role="img" />;
  }

  return (
    <Image
      alt="QR code that opens your TrustID link"
      className="rounded-lg border border-border"
      height={208}
      src={qr.src}
      unoptimized
      width={208}
    />
  );
}
