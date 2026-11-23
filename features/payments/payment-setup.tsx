"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceAccount } from "@/features/auth/workspace-account";
import { fetchJson } from "@/lib/query/fetch-json";
import { isPaymentSetupError, paymentSetupState, type PaymentSetupSnapshot, type PaymentSetupState } from "./setup-readiness";

const setupRequiredEvent = "supplyed:payment-setup-required";
export function reportPaymentSetupRequired(result: unknown) {
  if (typeof window !== "undefined" && isPaymentSetupError(result)) window.dispatchEvent(new Event(setupRequiredEvent));
}

type PaymentSetup = {
  state: PaymentSetupState;
  ready: boolean;
  refreshing: boolean;
  setupStatus?: string;
  refresh: () => void;
};
const PaymentSetupContext = createContext<PaymentSetup | null>(null);

/** One account-scoped readiness check shared by the banner and protected actions. */
export function PaymentSetupProvider({ children }: { children: ReactNode }) {
  const { id, role } = useWorkspaceAccount();
  const client = useQueryClient();
  const queryKey = useMemo(() => ["payment-setup", id, role] as const, [id, role]);
  const query = useQuery({
    queryKey,
    enabled: role === "institution" || role === "teacher",
    queryFn: () => fetchJson<PaymentSetupSnapshot>(role === "institution" ? "/api/payments/school-billing" : "/api/payments/payout-account"),
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey }); };
    const reject = () => {
      // Stop submission immediately, even if a previous status response said ready.
      client.setQueryData<PaymentSetupSnapshot>(queryKey, { ready: false, canEnableAutomaticPayments: false });
      refresh();
    };
    const stopQueries = client.getQueryCache().subscribe(event => {
      if (event.type === "updated" && event.action.type === "success" && event.query.queryKey[0] === "payments" &&
          event.query.queryKey[1] === (role === "institution" ? "school-billing" : "payout-account")) refresh();
    });
    const stopMutations = client.getMutationCache().subscribe(event => {
      if (event.type === "updated" && event.action.type === "success") reportPaymentSetupRequired(event.mutation.state.data);
      if (event.type === "updated" && event.action.type === "error") reportPaymentSetupRequired(event.mutation.state.error);
    });
    window.addEventListener(setupRequiredEvent, reject);
    // Also handles returning to a preserved draft after setup in another tab.
    window.addEventListener("focus", refresh);
    return () => {
      stopQueries(); stopMutations();
      window.removeEventListener(setupRequiredEvent, reject);
      window.removeEventListener("focus", refresh);
    };
  }, [client, queryKey, role]);

  const state = paymentSetupState(role, query.data, query.isError);
  return <PaymentSetupContext.Provider value={{ state, ready: state === "ready", refreshing: query.isFetching, setupStatus: query.data?.setupStatus, refresh: () => { void query.refetch(); } }}>{children}</PaymentSetupContext.Provider>;
}

export function usePaymentSetup() {
  const value = useContext(PaymentSetupContext);
  if (!value) throw new Error("Payment setup controls require the workspace payment provider.");
  return value;
}
