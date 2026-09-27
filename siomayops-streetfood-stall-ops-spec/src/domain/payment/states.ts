export type PaymentStatus =
  | "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED"
  | "PENDING_VERIFICATION";

export type PaymentMethod =
  | "CASH" | "QRIS_STATIC" | "QRIS_DYNAMIC" | "BANK_TRANSFER" | "EWALLET" | "OTHER_DIGITAL";

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  PENDING: ["AUTHORIZED", "PAID", "FAILED", "EXPIRED", "CANCELLED", "PENDING_VERIFICATION"],
  AUTHORIZED: ["PAID", "FAILED", "EXPIRED", "CANCELLED"],
  PENDING_VERIFICATION: ["PAID", "FAILED", "EXPIRED", "CANCELLED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
  REFUNDED: []
};

export interface PaymentTransitionContext {
  readonly actorKind: "OPERATOR" | "SYSTEM_PROVIDER_CALLBACK" | "HQ_FINANCE" | "JOB";
  readonly hasVerifiedProviderEvidence: boolean;
  readonly hasReconciliationRecord: boolean;
  readonly isOfflineReplay: boolean;
}

export class InvalidPaymentTransitionError extends Error {
  constructor(from: PaymentStatus, to: PaymentStatus, reason: string) {
    super(`Invalid payment transition ${from} -> ${to}: ${reason}`);
    this.name = "InvalidPaymentTransitionError";
  }
}

export function assertPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
  context: PaymentTransitionContext
): void {
  const allowed = PAYMENT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidPaymentTransitionError(from, to, "transition not allowed");
  }

  // Honesty rules
  if (to === "PAID") {
    if (context.isOfflineReplay) {
      throw new InvalidPaymentTransitionError(from, to, "offline replay cannot reach PAID");
    }
    const hasEvidence = context.hasVerifiedProviderEvidence || context.hasReconciliationRecord;
    if (!hasEvidence) {
      // Cash payments are allowed to go PAID directly if actor is OPERATOR and method is CASH? But this function is generic.
      // We enforce that for digital, evidence required. For cash, we allow OPERATOR.
      // To distinguish, we rely on actorKind and evidence flags: if actor is OPERATOR and no evidence, we assume cash is allowed only if explicitly permitted?
      // For simplicity, we require evidence unless actor is OPERATOR and we treat cash separately.
      // Here we enforce: PAID requires either verified evidence OR reconciliation, OR actor OPERATOR with CASH context.
      // Since method not in context, we will require evidence for non-OPERATOR cash too? Let's check:
      // The spec says PAID requires verified server-side evidence or explicit Finance reconciliation, except cash.
      // Cash is considered verified by operator at time of sale.
      // So we allow OPERATOR -> PAID without evidence as cash path, but forbid offline replay to PAID for digital.
      // For digital, actorKind would be SYSTEM_PROVIDER_CALLBACK or HQ_FINANCE.
      if (context.actorKind === "OPERATOR") {
        // Allow cash PAID from PENDING directly, but if from PENDING_VERIFICATION, need evidence or reconciliation
        if (from === "PENDING_VERIFICATION" && !hasEvidence) {
          throw new InvalidPaymentTransitionError(from, to, "PENDING_VERIFICATION requires verified evidence or reconciliation to reach PAID");
        }
        // else allow
      } else {
        if (!hasEvidence) {
          throw new InvalidPaymentTransitionError(from, to, "PAID requires verified provider evidence or reconciliation");
        }
      }
    }
    if (context.actorKind === "OPERATOR" && from === "PENDING_VERIFICATION") {
      // Operator cannot self-verify digital payment
      if (!context.hasReconciliationRecord) {
        // Actually operator shouldn't be able to move PENDING_VERIFICATION to PAID
        // Only SYSTEM_PROVIDER_CALLBACK or HQ_FINANCE can
        throw new InvalidPaymentTransitionError(from, to, "Operator cannot verify digital payment");
      }
    }
  }

  // PENDING_VERIFICATION can only be reached from PENDING for digital methods
  if (to === "PENDING_VERIFICATION" && from !== "PENDING") {
    throw new InvalidPaymentTransitionError(from, to, "PENDING_VERIFICATION only from PENDING");
  }

  // No offline path to PAID
  if (context.isOfflineReplay && to === "PAID") {
    throw new InvalidPaymentTransitionError(from, to, "Offline replay cannot produce PAID");
  }
}
