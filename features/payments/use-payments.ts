"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import {
  createInvoiceAction,
  instantPayoutAction,
  refundInvoiceAction,
  resendInvoiceAction,
  voidInvoiceAction,
} from "./actions";
import type {
  AdminInvoiceListQuery,
  CreateInvoiceInput,
  Invoice,
  InvoiceListQuery,
  PaginatedInvoices,
  PayoutAccount,
  PayoutBalance,
  RefundInvoiceInput,
} from "./types";

type MutationOptions<Result> = {
  onError?: () => void;
  onSuccess?: (result: Result) => void | Promise<void>;
};

type InvoiceResult = Awaited<ReturnType<typeof createInvoiceAction>>;

/** With pollUntilReady, re-checks every few seconds while Stripe is still verifying a started setup. */
export function usePayoutAccount(options: { enabled?: boolean; pollUntilReady?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PayoutAccount>("/api/payments/payout-account"),
    queryKey: queryKeys.payments.payoutAccount(),
    refetchInterval: (current) => options.pollUntilReady && current.state.data?.connected && !current.state.data.ready ? 5_000 : false,
  });
}

export function usePayoutBalance(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PayoutBalance>("/api/payments/payout-account/balance"),
    queryKey: queryKeys.payments.balance(),
  });
}

type PayoutResult = Awaited<ReturnType<typeof instantPayoutAction>>;

export function useInstantPayout(options: MutationOptions<PayoutResult> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amountPence?: number) => instantPayoutAction(amountPence),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.payments.balance() });
      await options.onSuccess?.(result);
    },
  });
}

export function useMyInvoices(query: InvoiceListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedInvoices>("/api/invoices/me", { query }),
    queryKey: queryKeys.payments.myInvoices(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.invoices.some((invoice) => invoice.status === "OPEN" || invoice.status === "PAID" || invoice.status === "UNCOLLECTIBLE") ? 15_000 : false,
  });
}

export function useAllInvoices(query: AdminInvoiceListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedInvoices>("/api/invoices", { query }),
    queryKey: queryKeys.payments.allInvoices(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.invoices.some((invoice) => invoice.status !== "VOID") ? 15_000 : false,
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Invoice>(`/api/invoices/${encodeURIComponent(id ?? "")}`),
    queryKey: [...queryKeys.payments.all, "invoice", id],
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data && current.state.data.status !== "VOID" ? 15_000 : false,
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
