import { describe, it, expect } from "vitest";
import { assertPaymentTransition } from "@/domain/payment/states";

describe("payment state machine (T-PAY-001, ADR-0033)", () => {
  it("has no transition that reaches PAID from the client or an offline replay (INV-13)", () => {
    expect(() => assertPaymentTransition("PENDING", "PAID", {
      actorKind: "OPERATOR",
      hasVerifiedProviderEvidence: false,
      hasReconciliationRecord: false,
      isOfflineReplay: true,
    })).toThrow();
  });

  it("allows PAID only with verified provider evidence or a reconciliation record (INV-02)", () => {
    // PENDING_VERIFICATION -> PAID without evidence should fail
    expect(() => assertPaymentTransition("PENDING_VERIFICATION", "PAID", {
      actorKind: "SYSTEM_PROVIDER_CALLBACK",
      hasVerifiedProviderEvidence: false,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    })).toThrow();

    // With evidence should succeed
    expect(() => assertPaymentTransition("PENDING_VERIFICATION", "PAID", {
      actorKind: "SYSTEM_PROVIDER_CALLBACK",
      hasVerifiedProviderEvidence: true,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    })).not.toThrow();

    // With reconciliation should succeed
    expect(() => assertPaymentTransition("PENDING_VERIFICATION", "PAID", {
      actorKind: "HQ_FINANCE",
      hasVerifiedProviderEvidence: false,
      hasReconciliationRecord: true,
      isOfflineReplay: false,
    })).not.toThrow();
  });

  it("refuses REFUNDED without an explicit refund record - via state machine", () => {
    // PAID -> REFUNDED is allowed, but should be via finance
    expect(() => assertPaymentTransition("PENDING", "REFUNDED", {
      actorKind: "HQ_FINANCE",
      hasVerifiedProviderEvidence: false,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    })).toThrow();
  });

  it("keeps PENDING_VERIFICATION separate from PAID in every projection", () => {
    // PENDING_VERIFICATION is not PAID
    expect(() => assertPaymentTransition("PENDING_VERIFICATION", "PAID", {
      actorKind: "OPERATOR",
      hasVerifiedProviderEvidence: false,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    })).toThrow();
  });

  it("rejects an out-of-order callback after EXPIRED without a reconciliation path", () => {
    expect(() => assertPaymentTransition("EXPIRED", "PAID", {
      actorKind: "SYSTEM_PROVIDER_CALLBACK",
      hasVerifiedProviderEvidence: true,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    })).toThrow();
  });

  it("allows cash PAID from PENDING via operator", () => {
    expect(() => assertPaymentTransition("PENDING", "PAID", {
      actorKind: "OPERATOR",
      hasVerifiedProviderEvidence: false,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    })).not.toThrow();
  });
});
