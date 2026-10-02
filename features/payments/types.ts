export type InvoiceStatus = "PENDING" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";

/** The teacher's Stripe payout account, as the backend mirrors it. */
export type PayoutAccount = {
  chargesEnabled: boolean;
  connected: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  payoutsEnabled: boolean;
  /** True once the teacher can be paid; their bookings can then be invoiced. */
  ready: boolean;
  requirementsDue: string[];
};

/** A single-use Stripe page (onboarding or the Express dashboard). */
export type StripeLink = {
  expiresAt: string | null;
  url: string;
};

export type InvoiceParty = {
  id: string;
  name: string;
};

export type Invoice = {
  amountRefundedPence: number;
  booking: {
    endDate: string | null;
    id: string;
    institution: InvoiceParty;
    instructor: InvoiceParty;
    jobTitle: string;
    startDate: string | null;
  };
  createdAt: string | null;
  currency: string;
  disputeStatus: string | null;
  dueAt: string | null;
  feeAmountPence: number;
  hostedInvoiceUrl: string | null;
  id: string;
  invoiceNumber: string | null;
  invoicePdfUrl: string | null;
  paidAt: string | null;
  payType: string;
  poNumber: string | null;
  rateAmount: number;
  status: InvoiceStatus;
  teacherAmountPence: number;
  totalAmountPence: number;
  unitsWorked: number | null;
  updatedAt: string | null;
  voidedAt: string | null;
};

export type InvoicesPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedInvoices = {
  invoices: Invoice[];
  pagination: InvoicesPagination;
};

export type InvoiceListQuery = {
  limit?: number;
  page?: number;
  status?: InvoiceStatus;
};

export type CreateInvoiceInput = {
  bookingId: string;
  poNumber?: string;
  /** Days (daily rate) or hours (hourly rate) worked; omitted for a fixed price. */
  unitsWorked?: number;
};

export type RefundReason = "duplicate" | "fraudulent" | "requested_by_customer";

export type RefundInvoiceInput = {
  /** Pence to refund; omit to refund everything not yet refunded. */
  amountPence?: number;
  id: string;
  reason?: RefundReason;
};
