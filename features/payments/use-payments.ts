"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import {
  createInvoiceAction,
  createPayoutDashboardLinkAction,
  createPayoutOnboardingLinkAction,
  instantPayoutAction,
  refundInvoiceAction,
  resendInvoiceAction,
  voidInvoiceAction,
} from "./actions";
import type {
  CreateInvoiceInput,
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

type LinkResult = Awaited<ReturnType<typeof createPayoutOnboardingLinkAction>>;
type InvoiceResult = Awaited<ReturnType<typeof createInvoiceAction>>;

export function usePayoutAccount(options: { enabled?: boolean; pollUntilReady?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PayoutAccount>("/api/payments/payout-account"),
    queryKey: queryKeys.payments.payoutAccount(),
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

/** Opens Stripe's hosted onboarding (or the payouts dashboard) in this tab once the link is ready. */
export function usePayoutLink(kind: "dashboard" | "onboarding", options: MutationOptions<LinkResult> = {}) {
  return useMutation<LinkResult, Error, void>({
    mutationFn: async () => {
      const result = await (kind === "onboarding" ? createPayoutOnboardingLinkAction() : createPayoutDashboardLinkAction());
      if (result.ok && !isStripePayoutUrl(result.data.url)) {
        return { ok: false, message: "Stripe returned an invalid payout link. Please try again." };
      }
      return result;
    },
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        try {
          openStripePayoutPage(result.data.url);
        } catch {
          // The component can show an explicit target="_top" link if the preview blocks automatic navigation.
          options.onError?.();
        }
      }
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
