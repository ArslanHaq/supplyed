"use client";

import { useState } from "react";
import type { Booking } from "@/features/bookings/types";
import { invoiceUnitsLimit } from "@/features/bookings/schemas";
import { useCreateInvoice } from "@/features/payments/use-payments";
import type { PayableInvoice } from "@/features/payments/types";
import { Btn, Field } from "../atoms";
import { Modal } from "../molecules";
import { PayInvoiceModal } from "./PayInvoiceModal";

export function BookingManualPayment({ booking, invoice }: { booking: Booking; invoice: PayableInvoice | null }) {
  const [confirm, setConfirm] = useState(false);
  const [units, setUnits] = useState("");
  const [payment, setPayment] = useState<PayableInvoice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const needsUnits = booking.payType !== "fixed" && !booking.attendancePayroll?.covered;
  const create = useCreateInvoice({
    onError: () => setMessage("The invoice could not be prepared. Refresh payment status before trying again."),
    onSuccess: (result) => {
      if (!result.ok) { setMessage(result.message); return; }
      setConfirm(false);
      setPayment({ id: result.data.id, totalAmountPence: result.data.totalAmountPence, jobTitle: booking.job.title });
    },
  });
  function prepare() {
    setMessage(null);
    const amount = Number(units);
    if (needsUnits && (!/^\d+(?:\.\d{1,2})?$/.test(units) || amount < 0.01 || amount > invoiceUnitsLimit(booking))) {
      setMessage(`Enter time worked between 0.01 and ${invoiceUnitsLimit(booking)} with up to two decimal places.`);
      return;
    }
    create.mutate({ bookingId: booking.id, ...(needsUnits ? { unitsWorked: amount } : {}) });
  }
  return <>
    <Btn size="sm" onClick={() => { setMessage(null); if (invoice) setPayment(invoice); else setConfirm(true); }}>Pay manually</Btn>
    <Modal open={confirm} onClose={() => { if (!create.isPending) setConfirm(false); }}>
      <div className="p-6">
        <h2 className="font-heading text-xl">Prepare manual payment</h2>
        <p className="mt-3 text-sm text-muted">Create an invoice for this completed booking, then review the total and pay securely with Stripe. Creating the invoice does not charge your card.</p>
        {needsUnits ? <Field label={booking.payType === "hourly" ? "Hours worked" : "Days worked"} htmlFor={`manual-units-${booking.id}`}>
          <input id={`manual-units-${booking.id}`} className="input mt-3" type="number" min="0.01" max={invoiceUnitsLimit(booking)} step="0.01" value={units} disabled={create.isPending} onChange={(event) => setUnits(event.target.value)} />
        </Field> : <p className="mt-3 text-sm">The backend will calculate the amount from the agreed rate and applicable attendance.</p>}
        {message ? <p className="mt-3 text-danger" role="alert">{message}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <Btn variant="ghost" disabled={create.isPending} onClick={() => setConfirm(false)}>Cancel</Btn>
          <Btn loading={create.isPending} loadingLabel="Preparing invoice" onClick={prepare}>Review and pay</Btn>
        </div>
      </div>
    </Modal>
    <PayInvoiceModal invoice={payment} onClose={() => setPayment(null)} toast={({ msg }) => setMessage(msg ?? null)} />
    {!confirm && message ? <p className="w-full text-sm" role="status">{message}</p> : null}
  </>;
}
