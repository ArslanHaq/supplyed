"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import {
  createInvoiceAction,
  createBookingTipCheckoutAction,
  createSchoolBillingSetupSessionAction,
  instantPayoutAction,
  removeSchoolPaymentMethodAction,
  refundInvoiceAction,
  resendInvoiceAction,
  syncSchoolBillingSetupAction,
  syncBookingTipAction,
  syncInvoiceAction,
  updateSchoolAutomaticPaymentsAction,
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
  SchoolBillingSettings,
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
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => (current.state.data?.pendingPence ?? 0) > 0 ? 30_000 : false,
  });
}

export function useSchoolBillingSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<SchoolBillingSettings>("/api/payments/school-billing"),
    queryKey: queryKeys.payments.schoolBilling(),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.setupStatus === "PENDING" ? 5_000 : current.state.data?.currentPayment ? 15_000 : false,
  });
}

type SchoolBillingSetupResult = Awaited<ReturnType<typeof createSchoolBillingSetupSessionAction>>;
type SchoolBillingSettingsResult = Awaited<ReturnType<typeof updateSchoolAutomaticPaymentsAction>>;

export function useCreateSchoolBillingSetup(options: MutationOptions<SchoolBillingSetupResult> = {}) {
  return useMutation({
    mutationFn: createSchoolBillingSetupSessionAction,
    onError: options.onError,
    onSuccess: options.onSuccess,
  });
}

export function useUpdateSchoolAutomaticPayments(options: MutationOptions<SchoolBillingSettingsResult> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSchoolAutomaticPaymentsAction,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) queryClient.setQueryData(queryKeys.payments.schoolBilling(), result.data);
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      await options.onSuccess?.(result);
    },
  });
}

export function useCreateBookingTipCheckout(options: MutationOptions<Awaited<ReturnType<typeof createBookingTipCheckoutAction>>> = {}) {
  return useMutation({
    mutationFn: createBookingTipCheckoutAction,
    onError: options.onError,
    onSuccess: options.onSuccess,
  });
}

export function useSyncBookingTip(options: MutationOptions<Awaited<ReturnType<typeof syncBookingTipAction>>> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncBookingTipAction,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      await options.onSuccess?.(result);
    },
  });
}

export function useRemoveSchoolPaymentMethod(options: MutationOptions<Awaited<ReturnType<typeof removeSchoolPaymentMethodAction>>> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeSchoolPaymentMethodAction,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) queryClient.setQueryData(queryKeys.payments.schoolBilling(), result.data);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      await options.onSuccess?.(result);
    },
  });
}

export function useSyncSchoolBillingSetup(options: MutationOptions<Awaited<ReturnType<typeof syncSchoolBillingSetupAction>>> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncSchoolBillingSetupAction,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) queryClient.setQueryData(queryKeys.payments.schoolBilling(), result.data);
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      await options.onSuccess?.(result);
    },
  });
}

type PayoutResult = Awaited<ReturnType<typeof instantPayoutAction>>;

export function useInstantPayout(options: MutationOptions<PayoutResult> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amountPence?: number) => instantPayoutAction(amountPence),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        queryClient.setQueryData<PayoutBalance>(queryKeys.payments.balance(), (current) =>
          current
            ? {
                ...current,
                instantAvailablePence: Math.max(0, current.instantAvailablePence - result.data.amountPence),
                recentPayouts: [result.data, ...current.recentPayouts.filter((payout) => payout.id !== result.data.id)],
              }
            : current,
        );
        await queryClient.invalidateQueries({ queryKey: queryKeys.payments.balance() });
      }
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
    refetchInterval: (current) => current.state.data?.invoices.some((invoice) => invoice.status === "OPEN" || invoice.status === "PENDING") ? 15_000 : false,
  });
}

export function useAllInvoices(query: AdminInvoiceListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedInvoices>("/api/invoices", { query }),
    queryKey: queryKeys.payments.allInvoices(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.invoices.some((invoice) => invoice.status === "OPEN" || invoice.status === "PENDING") ? 15_000 : false,
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Invoice>(`/api/invoices/${encodeURIComponent(id ?? "")}`),
    queryKey: [...queryKeys.payments.all, "invoice", id],
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data && (current.state.data.status === "OPEN" || current.state.data.status === "PENDING") ? 15_000 : false,
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

/** Reads the current invoice directly from Stripe, then refreshes every view that displays it. */
export function useSyncInvoice(options: MutationOptions<InvoiceResult> = {}) {
  return useInvoiceMutation((id: string) => syncInvoiceAction(id), options);
}
