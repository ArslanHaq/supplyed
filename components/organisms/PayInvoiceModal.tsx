"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { createInvoicePaymentSessionAction, syncInvoiceAction } from "@/features/payments/actions";
import { formatPence } from "@/features/payments/schemas";
import { getStripe, paymentAppearance, stripeFonts } from "@/features/payments/stripe-client";
import type { InvoiceStatus, PayableInvoice } from "@/features/payments/types";
import { unwrapActionResult } from "@/lib/server/action-response";
import { queryKeys } from "@/lib/query/keys";
import type { ToastFn } from "@/types/supplyed";

import { Btn, Tag } from "../atoms";
import { Modal, SectionLoader } from "../molecules";

/** Where Stripe sends the school back after a payment method that leaves the page (most never do). */
const RETURN_PARAM = "paidInvoice";

/**
 * Pays an invoice without leaving SupplyEd. Stripe's Payment Element runs in
 * a Stripe frame inside the modal, so card details go straight to Stripe; it
 * also offers the school's saved cards and handles 3D Secure checks in place.
 */
export function PayInvoiceModal({ invoice, onClose, toast }: { invoice: PayableInvoice | null; onClose: () => void; toast: ToastFn }) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={Boolean(invoice)} onClose={() => { if (!busy) onClose(); }}>
      {invoice ? <PaymentSession key={invoice.id} invoice={invoice} onBusy={setBusy} onClose={onClose} toast={toast} /> : null}
    </Modal>
  );
}

function PaymentSession({ invoice, onBusy, onClose, toast }: { invoice: PayableInvoice; onBusy: (busy: boolean) => void; onClose: () => void; toast: ToastFn }) {
  // Kept out of the payments keys: refreshing invoices must not swap the secret under a mounted Payment Element.
  const session = useQuery({
    gcTime: 0,
    queryFn: async () => unwrapActionResult(await createInvoicePaymentSessionAction(invoice.id)),
    queryKey: ["invoice-payment-session", invoice.id],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
  });
  const amount = formatPence(session.data?.amountPence || invoice.totalAmountPence);

  return (
    <div className="invoice-payment-modal max-h-[90vh] overflow-y-auto p-6 sm:p-7">
      <Tag tone="amber">Pay invoice</Tag>
      <h2 className="invoice-payment-amount mt-4 font-serif text-2xl">Pay {amount}</h2>
      {invoice.jobTitle ? <p className="mt-1 text-sm text-muted">{invoice.jobTitle}</p> : null}

      {session.isLoading ? <div className="mt-5"><SectionLoader rows={3} /></div> : null}
      {session.error ? (
        <div className="mt-5">
          <p className="rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger" role="alert">{session.error.message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
            <Btn loading={session.isFetching} loadingLabel="Retrying" onClick={() => void session.refetch()}>Try again</Btn>
          </div>
        </div>
      ) : null}

      {session.data ? (
        <Elements
          stripe={getStripe(session.data.publishableKey)}
          options={{
            appearance: paymentAppearance,
            clientSecret: session.data.clientSecret,
            customerSessionClientSecret: session.data.customerSessionClientSecret,
            fonts: stripeFonts,
            loader: "auto",
          }}
        >
          <PaymentForm amount={amount} invoice={invoice} onBusy={onBusy} onClose={onClose} toast={toast} />
        </Elements>
      ) : null}
    </div>
  );
}

function PaymentForm({ amount, invoice, onBusy, onClose, toast }: { amount: string; invoice: PayableInvoice; onBusy: (busy: boolean) => void; onClose: () => void; toast: ToastFn }) {
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    onBusy(true);
    setError(null);

    try {
      const result = await stripe.confirmPayment({
        confirmParams: { return_url: paymentReturnUrl(invoice.id) },
        elements,
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message ?? "The payment did not go through. Try again or use another card.");
        return;
      }

      const status = await settleInvoice(invoice.id);
      await refreshPayments(queryClient);
      announce(toast, status);
      onClose();
    } catch {
      setError("The payment could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
      onBusy(false);
    }
  }

  return (
    <form className="mt-5" onSubmit={(event) => void submit(event)}>
      <PaymentElement options={{ layout: "tabs" }} onReady={() => setReady(true)} />
      {error ? <p className="mt-4 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}
      <p className="mt-4 text-xs leading-5 text-muted">
        Payments are processed by Stripe, our payments partner. Card details go straight to Stripe; SupplyEd never sees them.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Btn disabled={submitting} variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!stripe || !ready} loading={submitting} loadingLabel="Paying" type="submit">Pay {amount}</Btn>
      </div>
    </form>
  );
}

/**
 * Handles the return from a payment method that left the page (a bank's own
 * approval page, say): checks the invoice and tells the school how it went.
 * Mount on the page Stripe returns to (Billing).
 */
export function usePaymentReturn(toast: ToastFn) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const invoiceId = searchParams.get(RETURN_PARAM);
  const redirectStatus = searchParams.get("redirect_status");
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!invoiceId || handled.current === invoiceId) return;
    handled.current = invoiceId;
    router.replace(pathname, { scroll: false });

    if (redirectStatus === "failed") {
      toast({ msg: "The payment did not go through. Try again or use another payment method.", title: "Payment failed", tone: "danger" });
      return;
    }

    void settleInvoice(invoiceId).then(async (status) => {
      await refreshPayments(queryClient);
      announce(toast, status);
    });
  }, [invoiceId, pathname, queryClient, redirectStatus, router, toast]);
}

function paymentReturnUrl(invoiceId: string) {
  return `${window.location.origin}/billing?${RETURN_PARAM}=${encodeURIComponent(invoiceId)}`;
}

/** Asks the backend to re-read the invoice from Stripe until it shows as paid; card payments settle within seconds. */
async function settleInvoice(invoiceId: string): Promise<InvoiceStatus | null> {
  let status: InvoiceStatus | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await syncInvoiceAction(invoiceId);
    if (result.ok) status = result.data.status;
    if (status === "PAID" || status === "VOID") break;
  }

  return status;
}

async function refreshPayments(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all }),
  ]);
}

function announce(toast: ToastFn, status: InvoiceStatus | null) {
  if (status === "PAID") {
    toast({ msg: "Thank you. The teacher is paid automatically.", title: "Payment received", tone: "success" });
  } else {
    toast({ msg: "Your payment is being processed. The invoice will show as paid once it clears.", title: "Payment submitted", tone: "success" });
  }
}
