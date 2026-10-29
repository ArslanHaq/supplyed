"use client";

import { lazy, Suspense } from "react";

import type { PayableInvoice } from "@/features/payments/types";
import type { ToastFn } from "@/types/supplyed";

import { Modal, SectionLoader } from "../molecules";

const StripePayInvoiceModal = lazy(async () => {
  const paymentComponents = await import("./PayInvoiceModal");
  return { default: paymentComponents.PayInvoiceModal };
});

/** Downloads Stripe's payment integration only after the user chooses an invoice to pay. */
export function DeferredPayInvoiceModal({ invoice, onClose, toast }: { invoice: PayableInvoice; onClose: () => void; toast: ToastFn }) {
  return (
    <Suspense fallback={(
      <Modal open onClose={onClose}>
        <div className="p-6 sm:p-7" role="status" aria-label="Loading secure payment form">
          <p className="mb-4 text-sm font-semibold text-ink">Loading secure payment form</p>
          <SectionLoader rows={3} />
        </div>
      </Modal>
    )}>
      <StripePayInvoiceModal invoice={invoice} onClose={onClose} toast={toast} />
    </Suspense>
  );
}
