import { memoryStore, generateId } from "../../server/db/memory-store";
import type { Money } from "../../shared/money";
import { money } from "../../shared/money/money";
import { computeSaleTotalFromSnapshots } from "../../domain/sale/totals";
import { resolvePriceForSale } from "../pricing";
import { writeAuditEvent } from "../audit";

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export interface CreateSaleInput {
  shiftId: string;
  locationReportId?: string;
  sellingLocationId?: string;
  lines: { menuItemId: string; quantity: number; overridePriceId?: string }[];
  clientSaleId: string;
  recordedAtDevice?: Date;
  customerReference?: string;
  organizationId?: string;
}

export interface SaleResult {
  saleId: string;
  status: "DRAFT" | "COMPLETED" | "VOIDED" | "CORRECTED";
  total: Money;
  lines: { menuItemId: string; quantity: number; unitPriceSnapshot: Money; pricePolicyId?: string; lineTotal: Money }[];
  version: number;
}

export async function createSale(input: CreateSaleInput): Promise<SaleResult> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Idempotency via clientSaleId
  const existingSaleId = memoryStore.saleByClientId.get(input.clientSaleId);
  if (existingSaleId) {
    const existing = memoryStore.sales.get(existingSaleId);
    if (existing) {
      const items = Array.from(memoryStore.saleItems.values()).filter(i => i.saleId === existing.id);
      return {
        saleId: existing.id,
        status: existing.status as any,
        total: money(existing.totalMinor, "IDR"),
        lines: items.map(it => ({
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          unitPriceSnapshot: money(it.unitPriceMinor, "IDR"),
          pricePolicyId: it.pricePolicyId,
          lineTotal: money(it.lineTotalMinor, "IDR"),
        })),
        version: existing.version,
      };
    }
  }

  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC") {
    throw Object.assign(new Error(`Shift not open: ${shift.status}`), { code: "PRECONDITION_FAILED" });
  }

  const sellingLocationId = input.sellingLocationId || shift.startLocationId;
  // Resolve location report if needed
  let locationReportId = input.locationReportId;
  if (!locationReportId) {
    // Find current open report
    for (const r of memoryStore.locationReports.values()) {
      if (r.shiftId === input.shiftId && !r.departedAt) {
        locationReportId = r.id;
        break;
      }
    }
  }

  // Resolve prices for each line - price resolution uses server acceptance time (now) per ADR, not device time
  // Device time is preserved as occurredAt, but price is server-authoritative at acceptance
  const snapshots: { menuItemId: string; quantity: number; unitPriceSnapshot: Money; pricePolicyId?: string }[] = [];
  const serverNow = new Date();
  const at = serverNow; // price resolution at server time
  const occurredAt = input.recordedAtDevice || serverNow;
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw Object.assign(new Error(`Invalid quantity for ${line.menuItemId}`), { code: "VALIDATION_FAILED" });
    }
    const resolution = await resolvePriceForSale({
      menuItemId: line.menuItemId,
      sellingLocationId: sellingLocationId as any,
      at,
      organizationId: orgId,
    });
    if (resolution.kind === "NOT_SELLABLE") {
      throw Object.assign(new Error(`Item ${line.menuItemId} not sellable`), { code: "PRECONDITION_FAILED" });
    }
    if (resolution.kind === "AMBIGUOUS") {
      throw Object.assign(new Error(`Price ambiguous for ${line.menuItemId}`), { code: "CONFLICT" });
    }
    snapshots.push({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      unitPriceSnapshot: money(resolution.unitPriceMinor, "IDR"),
      pricePolicyId: resolution.pricePolicyId,
    });
  }

  // Compute totals from snapshots
  const totals = computeSaleTotalFromSnapshots(
    snapshots.map(s => ({
      menuItemId: s.menuItemId,
      quantity: s.quantity,
      unitPriceSnapshot: s.unitPriceSnapshot,
      pricePolicyId: s.pricePolicyId,
    }))
  );

  const saleId = generateId();
  const now = new Date();
  const saleRecord = {
    id: saleId,
    organizationId: orgId,
    shiftId: input.shiftId,
    sellingLocationId: sellingLocationId as string,
    operatorId: shift.operatorId,
    stallId: shift.stallId,
    businessDay: shift.businessDay,
    occurredAt,
    serverAcceptedAt: now,
    totalMinor: totals.payableTotal.amountMinor,
    currency: "IDR" as const,
    status: "DRAFT" as const,
    clientSaleId: input.clientSaleId,
    version: 1,
    createdAt: now,
  };
  memoryStore.sales.set(saleId, saleRecord);
  memoryStore.saleByClientId.set(input.clientSaleId, saleId);

  const lineResults: SaleResult["lines"] = [];
  for (const snap of snapshots) {
    const saleItemId = generateId();
    const lineTotalMinor = snap.unitPriceSnapshot.amountMinor * snap.quantity;
    memoryStore.saleItems.set(saleItemId, {
      id: saleItemId,
      organizationId: orgId,
      saleId,
      menuItemId: snap.menuItemId,
      quantity: snap.quantity,
      unitPriceMinor: snap.unitPriceSnapshot.amountMinor,
      lineTotalMinor,
      pricePolicyId: snap.pricePolicyId,
    });
    lineResults.push({
      menuItemId: snap.menuItemId,
      quantity: snap.quantity,
      unitPriceSnapshot: snap.unitPriceSnapshot,
      pricePolicyId: snap.pricePolicyId,
      lineTotal: money(lineTotalMinor, "IDR"),
    });
  }

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: shift.operatorId,
    action: "sale.created",
    subjectKind: "sale",
    subjectId: saleId,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { total: totals.payableTotal.amountMinor, lines: snapshots.length },
  });

  return {
    saleId,
    status: "DRAFT",
    total: totals.payableTotal,
    lines: lineResults,
    version: 1,
  };
}

export async function completeSale(saleId: string, paymentId?: string): Promise<SaleResult> {
  const sale = memoryStore.sales.get(saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { code: "NOT_FOUND" });
  const wasCompleted = sale.status === "COMPLETED";
  sale.status = "COMPLETED";
  sale.version += 1;
  memoryStore.sales.set(sale.id, sale);

  const items = Array.from(memoryStore.saleItems.values()).filter(i => i.saleId === saleId);

  // Deduct stock once per sale (idempotent: only on first complete)
  if (!wasCompleted) {
    const menuToStock: Record<string,string> = {
      "00000000-0000-7000-0000-000000000101": "00000000-0000-7000-0000-000000000201",
      "00000000-0000-7000-0000-000000000102": "00000000-0000-7000-0000-000000000202",
      "00000000-0000-7000-0000-000000000103": "00000000-0000-7000-0000-000000000203",
      "00000000-0000-7000-0000-000000000104": "00000000-0000-7000-0000-000000000204",
    };
    const now = new Date();
    for (const it of items) {
      const stockItemId = menuToStock[it.menuItemId];
      if (!stockItemId) continue;
      // avoid duplicate movement for same sale+item (idempotent)
      const existing = Array.from(memoryStore.stockMovements.values()).find(m => m.clientMovementId === `sale-${saleId}-${it.menuItemId}`);
      if (existing) continue;
      const movId = generateId();
      memoryStore.stockMovements.set(movId, {
        id: movId,
        organizationId: sale.organizationId,
        stockItemId,
        stallId: sale.stallId,
        operatorId: sale.operatorId,
        shiftId: sale.shiftId,
        movementType: "SALE",
        quantity: -it.quantity,
        occurredAt: now,
        reason: `sale ${saleId}`,
        actorId: sale.operatorId,
        clientMovementId: `sale-${saleId}-${it.menuItemId}`,
      });
      memoryStore.movementByClientId.set(`sale-${saleId}-${it.menuItemId}`, movId);
    }
  }

  return {
    saleId: sale.id,
    status: "COMPLETED",
    total: money(sale.totalMinor, "IDR"),
    lines: items.map(it => ({
      menuItemId: it.menuItemId,
      quantity: it.quantity,
      unitPriceSnapshot: money(it.unitPriceMinor, "IDR"),
      pricePolicyId: it.pricePolicyId,
      lineTotal: money(it.lineTotalMinor, "IDR"),
    })),
    version: sale.version,
  };
}

export async function voidSale(saleId: string, reason: string, actorId?: string): Promise<void> {
  const sale = memoryStore.sales.get(saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { code: "NOT_FOUND" });
  if (!reason || reason.length < 3) throw new Error("Reason required");
  sale.status = "VOIDED";
  sale.version += 1;
  memoryStore.sales.set(sale.id, sale);
  await writeAuditEvent({
    organizationId: sale.organizationId,
    actorKind: "OPERATOR",
    actorId,
    action: "sale.voided",
    subjectKind: "sale",
    subjectId: saleId,
    reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: "COMPLETED" },
    afterSummary: { status: "VOIDED" },
  });
}

export async function getSaleById(saleId: string): Promise<SaleResult | null> {
  const sale = memoryStore.sales.get(saleId);
  if (!sale) return null;
  const items = Array.from(memoryStore.saleItems.values()).filter(i => i.saleId === saleId);
  return {
    saleId: sale.id,
    status: sale.status as any,
    total: money(sale.totalMinor, "IDR"),
    lines: items.map(it => ({
      menuItemId: it.menuItemId,
      quantity: it.quantity,
      unitPriceSnapshot: money(it.unitPriceMinor, "IDR"),
      pricePolicyId: it.pricePolicyId,
      lineTotal: money(it.lineTotalMinor, "IDR"),
    })),
    version: sale.version,
  };
}
