import type { AppRole } from "@/types/supplyed";

export type PaymentSetupSnapshot = { canEnableAutomaticPayments?: boolean; ready?: boolean; setupStatus?: string };
export type PaymentSetupState = "checking" | "unavailable" | "required" | "ready";

export function paymentSetupState(role: AppRole, data: PaymentSetupSnapshot | undefined, failed: boolean): PaymentSetupState {
  if (role !== "institution" && role !== "teacher") return "ready";
  if (failed) return "unavailable";
  if (!data) return "checking";
  return (role === "institution" ? data.canEnableAutomaticPayments === true : data.ready === true) ? "ready" : "required";
}

export function isPaymentSetupError(result: unknown): boolean {
  return Boolean(result && typeof result === "object" && "code" in result &&
    (result.code === "SCHOOL_CARD_REQUIRED" || result.code === "TEACHER_PAYOUT_SETUP_REQUIRED"));
}
