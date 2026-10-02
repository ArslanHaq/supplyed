"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import {
  createInvoiceAction,
  createPayoutDashboardLinkAction,
  createPayoutOnboardingLinkAction,
  refundInvoiceAction,
  resendInvoiceAction,
  voidInvoiceAction,
} from "./actions";
import type { CreateInvoiceInput, InvoiceListQuery, PaginatedInvoices, PayoutAccount, RefundInvoiceInput } from "./types";

type MutationOptions<Result> = {
  onError?: () => void;
  onSuccess?: (result: Result) => void | Promise<void>;
};

type LinkResult = Awaited<ReturnType<typeof createPayoutOnboardingLinkAction>>;
type InvoiceResult = Awaited<ReturnType<typeof createInvoiceAction>>;

export function usePayoutAccount(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PayoutAccount>("/api/payments/payout-account"),
    queryKey: queryKeys.payments.payoutAccount(),
  });
}

export function useMyInvoices(query: InvoiceListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedInvoices>("/api/invoices/me", { query }),
    queryKey: queryKeys.payments.myInvoices(query),
  });
}

export function useAllInvoices(query: InvoiceListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedInvoices>("/api/invoices", { query }),
    queryKey: queryKeys.payments.allInvoices(query),
  });
}

/** Opens Stripe's hosted onboarding (or the payouts dashboard) in this tab once the link is ready. */
export function usePayoutLink(kind: "dashboard" | "onboarding", options: MutationOptions<LinkResult> = {}) {
  return useMutation({
    mutationFn: () => (kind === "onboarding" ? createPayoutOnboardingLinkAction() : createPayoutDashboardLinkAction()),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok && result.data.url) window.location.assign(result.data.url);
      await options.onSuccess?.(result);
    },
  });
}

function useInvoiceMutation<Input>(action: (input: Input) => Promise<InvoiceResult>, options: MutationOptions<InvoiceResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: action,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all }),
        ]);
      }
      await options.onSuccess?.(result);
    },
  });
}

export function useCreateInvoice(options: MutationOptions<InvoiceResult> = {}) {
  return useInvoiceMutation((input: CreateInvoiceInput) => createInvoiceAction(input), options);
}

export function useResendInvoice(options: MutationOptions<InvoiceResult> = {}) {
  return useInvoiceMutation((id: string) => resendInvoiceAction(id), options);
}

export function useVoidInvoice(options: MutationOptions<InvoiceResult> = {}) {
  return useInvoiceMutation((id: string) => voidInvoiceAction(id), options);
}

export function useRefundInvoice(options: MutationOptions<InvoiceResult> = {}) {
  return useInvoiceMutation((input: RefundInvoiceInput) => refundInvoiceAction(input), options);
}
