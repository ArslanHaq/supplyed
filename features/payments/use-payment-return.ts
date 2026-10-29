"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { syncInvoiceAction } from "@/features/payments/actions";
import type { InvoiceStatus } from "@/features/payments/types";
import { queryKeys } from "@/lib/query/keys";
import type { ToastFn } from "@/types/supplyed";

export const PAYMENT_RETURN_PARAM = "paidInvoice";

/** Reconcile payment methods that returned from a bank without loading Stripe.js. */
export function usePaymentReturn(toast: ToastFn) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const invoiceId = searchParams.get(PAYMENT_RETURN_PARAM);
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
      announcePayment(toast, status);
    });
  }, [invoiceId, pathname, queryClient, redirectStatus, router, toast]);
}

/** Ask the backend to re-read an invoice until Stripe reports a final state. */
export async function settleInvoice(invoiceId: string): Promise<InvoiceStatus | null> {
  let status: InvoiceStatus | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await syncInvoiceAction(invoiceId);
    if (result.ok) status = result.data.status;
    if (status === "PAID" || status === "VOID") break;
  }

  return status;
}

export async function refreshPayments(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all }),
  ]);
}

export function announcePayment(toast: ToastFn, status: InvoiceStatus | null) {
  if (status === "PAID") {
    toast({ msg: "Thank you. The teacher is paid automatically.", title: "Payment received", tone: "success" });
  } else {
    toast({ msg: "Your payment is being processed. The invoice will show as paid once it clears.", title: "Payment submitted", tone: "success" });
  }
}
