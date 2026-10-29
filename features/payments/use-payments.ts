"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import { invoiceRefreshInterval } from "./query-policy";

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
    queryFn: ({ signal }) => fetchJson<PayoutAccount>("/api/payments/payout-account", { signal }),
    queryKey: queryKeys.payments.payoutAccount(),
    refetchInterval: (current) => options.pollUntilReady && current.state.data?.connected && !current.state.data.ready ? 5_000 : false,
  });
}

export function usePayoutBalance(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: ({ signal }) => fetchJson<PayoutBalance>("/api/payments/payout-account/balance", { signal }),
    queryKey: queryKeys.payments.balance(),
  });
}

type PayoutResult = Awaited<ReturnType<typeof instantPayoutAction>>;

export function useInstantPayout(options: MutationOptions<PayoutResult> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amountPence?: number) => {
      const storageKey = "supplyed-withdrawal-intent";
      let intent: { requestKey: string; amountPence?: number } | null = null;
      try { intent = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch { /* Start a new intent. */ }
      if (!intent) {
        intent = { requestKey: crypto.randomUUID(), amountPence };
        sessionStorage.setItem(storageKey, JSON.stringify(intent));
      }
      if (intent.amountPence !== amountPence) throw new Error("Retry your pending withdrawal with its original amount first.");
      const result = await instantPayoutAction(amountPence, intent.requestKey);
      if (result.ok) sessionStorage.removeItem(storageKey);
      return result;
    },
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
    queryFn: ({ signal }) => fetchJson<PaginatedInvoices>("/api/invoices/me", { query, signal }),
    queryKey: queryKeys.payments.myInvoices(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => invoiceRefreshInterval(current.state.data?.invoices),
    refetchIntervalInBackground: false,
  });
}

export function useAllInvoices(query: AdminInvoiceListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: ({ signal }) => fetchJson<PaginatedInvoices>("/api/invoices", { query, signal }),
    queryKey: queryKeys.payments.allInvoices(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => invoiceRefreshInterval(current.state.data?.invoices),
    refetchIntervalInBackground: false,
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: ({ signal }) => fetchJson<Invoice>(`/api/invoices/${encodeURIComponent(id ?? "")}`, { signal }),
    queryKey: [...queryKeys.payments.all, "invoice", id],
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => invoiceRefreshInterval(current.state.data ? [current.state.data] : undefined),
    refetchIntervalInBackground: false,
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
