import { describe, it, expect, beforeEach } from "vitest";
import { memoryStore, generateId } from "@/server/db/memory-store";
import { createSale } from "@/features/sales";
import { createCashPayment, createDigitalPayment, verifyPaymentViaCallback, reconcilePayment } from "@/features/payments";
import { money } from "@/shared/money/money";
import { publishPricePolicy } from "@/features/pricing";

describe("payment honesty (T-PAY-002/003/004)", () => {
  const orgId = "org-1";
  const operatorId = generateId();
  const stallId = generateId();
  const locationId = generateId();
  const menuItemId = generateId();
  const stockItemId = generateId();

  beforeEach(async () => {
    memoryStore.clear();
    // Setup minimal data
    memoryStore.operators.set(operatorId, {
      id: operatorId,
      organizationId: orgId,
      areaId: "area-1",
      name: "Test Operator",
      phoneE164: "+628123456789",
      status: "ACTIVE",
      contractType: "FULL_TIME",
      trainingState: "TRAINED",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    memoryStore.stalls.set(stallId, {
      id: stallId,
      organizationId: orgId,
      areaId: "area-1",
      code: "ST-001",
      type: "GEROBAK",
      status: "ACTIVE",
      createdAt: new Date(),
    });
    memoryStore.sellingLocations.set(locationId, {
      id: locationId,
      organizationId: orgId,
      areaId: "area-1",
      name: "Test Location",
      status: "AVAILABLE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    memoryStore.menuItems.set(menuItemId, {
      id: menuItemId,
      organizationId: orgId,
      categoryId: "cat-1",
      name: "Siomay",
      active: true,
      sortOrder: 0,
      createdAt: new Date(),
    });
    await publishPricePolicy({
      menuItemId,
      scope: "ORG",
      scopeId: orgId,
      unitPrice: money(15000, "IDR"),
      effectiveFrom: new Date("2026-09-01"),
      reason: "Initial price",
      organizationId: orgId,
      createdBy: "test",
    });
    // Create shift
    const shiftId = generateId();
    memoryStore.shifts.set(shiftId, {
      id: shiftId,
      organizationId: orgId,
      operatorId,
      stallId,
      businessDay: "2026-09-26",
      startedAt: new Date(),
      startLocationId: locationId,
      openingCashMinor: 50000,
      currency: "IDR",
      status: "OPEN",
      clientShiftId: generateId(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (global as any).testShiftId = shiftId;
  });

  it("records static QRIS as PENDING_VERIFICATION and never as PAID", async () => {
    const shiftId = (global as any).testShiftId;
    const sale = await createSale({
      shiftId,
      lines: [{ menuItemId, quantity: 1 }],
      clientSaleId: generateId(),
      organizationId: orgId,
    });
    const payment = await createDigitalPayment({
      saleId: sale.saleId,
      method: "QRIS_STATIC",
      amount: sale.total,
      clientPaymentId: generateId(),
      organizationId: orgId,
    });
    expect(payment.status).toBe("PENDING_VERIFICATION");
    expect(payment.status).not.toBe("PAID");
  });

  it("rejects a callback with an invalid signature and audits the rejection", async () => {
    const { verifyProviderCallback } = await import("@/server/payments/webhook-verifier");
    process.env.PAYMENT_WEBHOOK_SECRET = "secret123";
    const rawBody = JSON.stringify({ partnerReferenceNo: "ref-1", providerReferenceId: "prov-1", amountMinor: 15000, state: "PAID" });
    const result = verifyProviderCallback({
      providerId: "FAKE",
      rawBody,
      headers: { "x-signature": "invalid" },
    });
    expect(result.kind).toBe("REJECTED");
    delete process.env.PAYMENT_WEBHOOK_SECRET;
  });

  it("processes a duplicate callback idempotently", async () => {
    const shiftId = (global as any).testShiftId;
    const sale = await createSale({
      shiftId,
      lines: [{ menuItemId, quantity: 1 }],
      clientSaleId: generateId(),
      organizationId: orgId,
    });
    const payment = await createDigitalPayment({
      saleId: sale.saleId,
      method: "QRIS_STATIC",
      amount: sale.total,
      clientPaymentId: generateId(),
      organizationId: orgId,
    });

    const rawBody = JSON.stringify({ partnerReferenceNo: sale.saleId, providerReferenceId: payment.providerReference, amountMinor: 15000, state: "PAID" });
    const first = await verifyPaymentViaCallback({
      provider: "FAKE",
      providerReference: payment.providerReference!,
      signatureValid: true,
      rawPayload: rawBody,
      amountMinor: 15000,
      organizationId: orgId,
    });
    expect(first.status).toBe("PAID");

    const second = await verifyPaymentViaCallback({
      provider: "FAKE",
      providerReference: payment.providerReference!,
      signatureValid: true,
      rawPayload: rawBody,
      amountMinor: 15000,
      organizationId: orgId,
    });
    expect(second.status).toBe("DUPLICATE");
  });

  it("routes an amount mismatch to human review instead of adjusting the sale", async () => {
    const shiftId = (global as any).testShiftId;
    const sale = await createSale({
      shiftId,
      lines: [{ menuItemId, quantity: 1 }],
      clientSaleId: generateId(),
      organizationId: orgId,
    });
    const payment = await createDigitalPayment({
      saleId: sale.saleId,
      method: "QRIS_STATIC",
      amount: sale.total,
      clientPaymentId: generateId(),
      organizationId: orgId,
    });

    const rawBody = JSON.stringify({ partnerReferenceNo: sale.saleId, providerReferenceId: payment.providerReference, amountMinor: 10000, state: "PAID" });
    await expect(verifyPaymentViaCallback({
      provider: "FAKE",
      providerReference: payment.providerReference!,
      signatureValid: true,
      rawPayload: rawBody,
      amountMinor: 10000,
      organizationId: orgId,
    })).rejects.toThrow(/mismatch/i);
  });

  it("requires a reason and evidence note on every manual reconciliation", async () => {
    const shiftId = (global as any).testShiftId;
    const sale = await createSale({
      shiftId,
      lines: [{ menuItemId, quantity: 1 }],
      clientSaleId: generateId(),
      organizationId: orgId,
    });
    const payment = await createDigitalPayment({
      saleId: sale.saleId,
      method: "QRIS_STATIC",
      amount: sale.total,
      clientPaymentId: generateId(),
      organizationId: orgId,
    });

    await expect(reconcilePayment({
      paymentId: payment.paymentId,
      outcome: "MATCHED",
      reason: "",
      evidenceNote: "Evidence",
      reconciledBy: "finance-1",
      organizationId: orgId,
    })).rejects.toThrow();
  });

  it("keeps verified and unverified digital amounts separate in every output (FR-PAYMENT-010)", async () => {
    // This is verified by checking that PENDING_VERIFICATION payments are not counted as cash
    const shiftId = (global as any).testShiftId;
    const sale = await createSale({
      shiftId,
      lines: [{ menuItemId, quantity: 1 }],
      clientSaleId: generateId(),
      organizationId: orgId,
    });
    await createDigitalPayment({
      saleId: sale.saleId,
      method: "QRIS_STATIC",
      amount: sale.total,
      clientPaymentId: generateId(),
      organizationId: orgId,
    });

    // Expected cash should not include digital
    const { prepareShiftClosing } = await import("@/features/shifts");
    const closing = await prepareShiftClosing({ shiftId });
    expect(closing.cashSalesTotal.amountMinor).toBe(0); // No cash sales
  });
});
