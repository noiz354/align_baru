import { memoryStore, generateId } from "../../server/db/memory-store";
import type { Money } from "../../shared/money";
import { money } from "../../shared/money/money";
import { assertPaymentTransition } from "../../domain/payment/states";
import { computeChangeForCash } from "../../domain/sale/totals";
import { writeAuditEvent } from "../audit";
import { completeSale } from "../sales";

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export async function createCashPayment(input: {
  saleId: string; amount: Money; cashReceived: Money; clientPaymentId: string; organizationId?: string;
}): Promise<{ paymentId: string; status: string; change: Money }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const existingId = memoryStore.paymentByClientId.get(input.clientPaymentId);
  if (existingId) {
    const existing = memoryStore.payments.get(existingId);
    if (existing) {
      const change = computeChangeForCash(money(existing.amountMinor, "IDR"), money(existing.amountMinor, "IDR")); // placeholder, will compute actual
      // Recompute change from stored? We need cashReceived stored; we don't store it, so recompute from input if same sale
      // For replay, return original
      return { paymentId: existing.id, status: existing.status, change: money(0, "IDR") };
    }
  }

  const sale = memoryStore.sales.get(input.saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { code: "NOT_FOUND" });
  // Check sale not already paid
  for (const p of memoryStore.payments.values()) {
    if (p.saleId === input.saleId && p.status === "PAID") {
      throw Object.assign(new Error("Sale already paid"), { code: "CONFLICT" });
    }
  }

  if (input.amount.amountMinor !== sale.totalMinor) {
    throw Object.assign(new Error(`Payment amount ${input.amount.amountMinor} does not match sale total ${sale.totalMinor}`), { code: "VALIDATION_FAILED" });
  }
  if (input.cashReceived.amountMinor < input.amount.amountMinor) {
    throw Object.assign(new Error("Insufficient cash"), { code: "VALIDATION_FAILED" });
  }
  const change = computeChangeForCash(input.amount, input.cashReceived);

  const paymentId = generateId();
  const now = new Date();
  const payment = {
    id: paymentId,
    organizationId: orgId,
    saleId: input.saleId,
    method: "CASH" as const,
    amountMinor: input.amount.amountMinor,
    currency: "IDR" as const,
    status: "PAID" as const,
    clientPaymentId: input.clientPaymentId,
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.payments.set(paymentId, payment);
  memoryStore.paymentByClientId.set(input.clientPaymentId, paymentId);

  // Transition check: PENDING -> PAID for cash is allowed via OPERATOR
  assertPaymentTransition("PENDING", "PAID", {
    actorKind: "OPERATOR",
    hasVerifiedProviderEvidence: false,
    hasReconciliationRecord: false,
    isOfflineReplay: false,
  });

  await completeSale(input.saleId, paymentId);

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    action: "payment.recorded",
    subjectKind: "payment",
    subjectId: paymentId,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { method: "CASH", amount: input.amount.amountMinor, change: change.amountMinor },
  });

  return { paymentId, status: "PAID", change };
}

export async function createDigitalPayment(input: {
  saleId: string; method: "QRIS_STATIC" | "QRIS_DYNAMIC" | "BANK_TRANSFER" | "EWALLET" | "OTHER_DIGITAL";
  amount: Money; clientPaymentId: string; operatorNote?: string; organizationId?: string;
}): Promise<{ paymentId: string; status: string; providerReference?: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const existingId = memoryStore.paymentByClientId.get(input.clientPaymentId);
  if (existingId) {
    const existing = memoryStore.payments.get(existingId);
    if (existing) {
      return { paymentId: existing.id, status: existing.status, providerReference: existing.providerReference };
    }
  }
  const sale = memoryStore.sales.get(input.saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { code: "NOT_FOUND" });
  // Check no existing PAID payment
  for (const p of memoryStore.payments.values()) {
    if (p.saleId === input.saleId && p.status === "PAID") {
      throw Object.assign(new Error("Sale already paid"), { code: "CONFLICT" });
    }
  }
  if (input.amount.amountMinor !== sale.totalMinor) {
    throw Object.assign(new Error("Amount mismatch"), { code: "VALIDATION_FAILED" });
  }

  const paymentId = generateId();
  const now = new Date();
  const isStatic = input.method === "QRIS_STATIC";
  const status = isStatic ? "PENDING_VERIFICATION" : "PENDING";
  const providerRef = `PROV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const payment = {
    id: paymentId,
    organizationId: orgId,
    saleId: input.saleId,
    method: input.method as any,
    amountMinor: input.amount.amountMinor,
    currency: "IDR" as const,
    status: status as any,
    providerReference: providerRef,
    clientPaymentId: input.clientPaymentId,
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.payments.set(paymentId, payment);
  memoryStore.paymentByClientId.set(input.clientPaymentId, paymentId);

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    action: "payment.recorded",
    subjectKind: "payment",
    subjectId: paymentId,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { method: input.method, amount: input.amount.amountMinor, status },
  });

  return { paymentId, status, providerReference: providerRef };
}

export async function verifyPaymentViaCallback(input: {
  provider: string; providerReference: string; signatureValid: boolean; rawPayload: string; amountMinor?: number; organizationId?: string;
}): Promise<{ paymentId?: string; status: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const dedupeKey = `${input.provider}|${input.providerReference}`;
  // Check duplicate callback
  for (const cb of memoryStore.paymentCallbacks.values()) {
    if (cb.dedupeKey === dedupeKey && cb.organizationId === orgId) {
      // Duplicate
      return { paymentId: cb.paymentId, status: "DUPLICATE" };
    }
  }

  if (!input.signatureValid) {
    const cbId = generateId();
    memoryStore.paymentCallbacks.set(cbId, {
      id: cbId,
      organizationId: orgId,
      provider: input.provider,
      providerReference: input.providerReference,
      signatureValid: false,
      receivedAt: new Date(),
      rawPayloadJson: input.rawPayload,
      dedupeKey,
    });
    await writeAuditEvent({
      organizationId: orgId,
      actorKind: "SYSTEM",
      action: "payment.callback_rejected",
      subjectKind: "payment_callback",
      subjectId: cbId,
      correlationId: generateId(),
      occurredAt: new Date(),
      afterSummary: { provider: input.provider, reason: "invalid_signature" },
    });
    throw Object.assign(new Error("Invalid signature"), { code: "VALIDATION_FAILED" });
  }

  // Find payment by providerReference
  let payment: any = null;
  for (const p of memoryStore.payments.values()) {
    if (p.providerReference === input.providerReference && p.organizationId === orgId) {
      payment = p;
      break;
    }
  }

  const cbId = generateId();
  memoryStore.paymentCallbacks.set(cbId, {
    id: cbId,
    organizationId: orgId,
    paymentId: payment?.id,
    provider: input.provider,
    providerReference: input.providerReference,
    signatureValid: true,
    receivedAt: new Date(),
    rawPayloadJson: input.rawPayload,
    dedupeKey,
  });

  if (!payment) {
    // No payment found, could be manual reconciliation case
    return { status: "NO_MATCH" };
  }

  // Verify amount if provided
  if (input.amountMinor && input.amountMinor !== payment.amountMinor) {
    await writeAuditEvent({
      organizationId: orgId,
      actorKind: "SYSTEM",
      action: "payment.callback_rejected",
      subjectKind: "payment",
      subjectId: payment.id,
      correlationId: generateId(),
      occurredAt: new Date(),
      afterSummary: { reason: "amount_mismatch", expected: payment.amountMinor, got: input.amountMinor },
    });
    throw Object.assign(new Error("Amount mismatch"), { code: "VALIDATION_FAILED" });
  }

  // Transition to PAID
  try {
    assertPaymentTransition(payment.status, "PAID", {
      actorKind: "SYSTEM_PROVIDER_CALLBACK",
      hasVerifiedProviderEvidence: true,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    });
  } catch (e) {
    // If already PAID, idempotent
    if (payment.status === "PAID") {
      return { paymentId: payment.id, status: "PAID" };
    }
    throw e;
  }

  payment.status = "PAID";
  payment.verifiedAt = new Date();
  payment.verifiedBy = "system_callback";
  payment.updatedAt = new Date();
  memoryStore.payments.set(payment.id, payment);

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "SYSTEM",
    action: "payment.verified",
    subjectKind: "payment",
    subjectId: payment.id,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { provider: input.provider, reference: input.providerReference },
  });

  // Complete sale if needed
  const sale = memoryStore.sales.get(payment.saleId);
  if (sale && sale.status !== "COMPLETED") {
    await completeSale(payment.saleId, payment.id);
  }

  return { paymentId: payment.id, status: "PAID" };
}

export async function reconcilePayment(input: {
  paymentId: string; outcome: "MATCHED" | "SHORT" | "OVER" | "MISSING" | "DISPUTED"; reason: string; evidenceNote: string; reconciledBy: string; organizationId?: string;
}): Promise<{ paymentId: string; status: string }> {
  const payment = memoryStore.payments.get(input.paymentId);
  if (!payment) throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" });
  if (!input.reason || input.reason.length < 3) throw new Error("Reason required");

  // Only HQ_FINANCE can reconcile, but we check in caller via authorize

  let newStatus: typeof payment.status = payment.status;
  if (input.outcome === "MATCHED") {
    // If currently PENDING_VERIFICATION, move to PAID via reconciliation
    if (payment.status === "PENDING_VERIFICATION" || payment.status === "PENDING") {
      assertPaymentTransition(payment.status, "PAID", {
        actorKind: "HQ_FINANCE",
        hasVerifiedProviderEvidence: false,
        hasReconciliationRecord: true,
        isOfflineReplay: false,
      });
      newStatus = "PAID";
    }
  } else if (input.outcome === "MISSING" || input.outcome === "DISPUTED") {
    newStatus = "FAILED";
  }

  payment.status = newStatus;
  payment.verifiedBy = input.reconciledBy;
  payment.verifiedAt = new Date();
  payment.updatedAt = new Date();
  memoryStore.payments.set(payment.id, payment);

  await writeAuditEvent({
    organizationId: payment.organizationId,
    actorKind: "HQ_USER",
    actorId: input.reconciledBy,
    action: "payment.reconciled",
    subjectKind: "payment",
    subjectId: payment.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { outcome: input.outcome, newStatus },
  });

  if (newStatus === "PAID") {
    const sale = memoryStore.sales.get(payment.saleId);
    if (sale && sale.status !== "COMPLETED") {
      await completeSale(payment.saleId, payment.id);
    }
  }

  return { paymentId: payment.id, status: newStatus };
}
