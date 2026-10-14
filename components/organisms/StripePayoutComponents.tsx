"use client";

import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import { ConnectAccountOnboarding, ConnectComponentsProvider, ConnectNotificationBanner, ConnectPayouts } from "@stripe/react-connect-js";
import { useEffect, useState } from "react";

import { createPayoutSessionAction } from "@/features/payments/actions";
import { connectAppearance, stripeFonts } from "@/features/payments/stripe-client";

import { Btn } from "../atoms";
import { SectionLoader } from "../molecules";

async function fetchPayoutSession() {
  const result = await createPayoutSessionAction();
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

/**
 * Starts Stripe's embedded Connect components for the signed-in teacher. The
 * first session also brings the publishable key; Stripe asks for a new
 * secret whenever a session expires, and each request fetches a fresh one.
 */
function useConnectInstance() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ error?: string; instance?: StripeConnectInstance }>({});

  useEffect(() => {
    let cancelled = false;

    fetchPayoutSession().then(
      ({ clientSecret, publishableKey }) => {
        if (cancelled) return;
        let unused: string | null = clientSecret;
        setState({
          instance: loadConnectAndInitialize({
            appearance: connectAppearance,
            fetchClientSecret: async () => {
              if (unused) {
                const secret = unused;
                unused = null;
                return secret;
              }
              return (await fetchPayoutSession()).clientSecret;
            },
            fonts: stripeFonts,
            locale: "en-GB",
            publishableKey,
          }),
        });
      },
      (error: unknown) => {
        if (!cancelled) setState({ error: error instanceof Error ? error.message : "Payout setup could not be loaded." });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return {
    ...state,
    retry: () => {
      setState({});
      setAttempt((current) => current + 1);
    },
  };
}

/**
 * Stripe's payout forms inside SupplyEd. "setup" collects what Stripe needs
 * to pay the teacher (date of birth, bank account, terms); "payouts" shows
 * their bank account and payout history, and lets them change the account.
 */
export function StripePayoutComponents({ onExit, view }: { onExit?: () => void; view: "payouts" | "setup" }) {
  const connect = useConnectInstance();
  const [loadError, setLoadError] = useState<string | null>(null);
  const error = connect.error ?? loadError;

  if (error) {
    return (
      <div className="rounded-lg border border-danger bg-danger-tint px-4 py-3 text-sm" role="alert">
        <p className="text-danger">{error}</p>
        <div className="mt-3">
          <Btn size="sm" variant="secondary" onClick={() => { setLoadError(null); connect.retry(); }}>
            Try again
          </Btn>
        </div>
      </div>
    );
  }

  if (!connect.instance) return <SectionLoader rows={3} />;

  const onLoadError = ({ error: loadFailure }: { error: { message?: string } }) =>
    setLoadError(loadFailure.message || "Stripe's form could not be loaded.");

  return (
    <ConnectComponentsProvider connectInstance={connect.instance}>
      <div className="space-y-4">
        <ConnectNotificationBanner onLoadError={onLoadError} />
        {view === "setup" ? (
          <ConnectAccountOnboarding
            collectionOptions={{ fields: "currently_due", futureRequirements: "omit" }}
            onExit={() => onExit?.()}
            onLoadError={onLoadError}
          />
        ) : (
          <ConnectPayouts onLoadError={onLoadError} />
        )}
      </div>
    </ConnectComponentsProvider>
  );
}
