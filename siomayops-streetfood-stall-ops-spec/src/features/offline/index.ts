import type { SyncRecordResult } from "../../shared/contracts/sync";
import { memoryStore, generateId } from "../../server/db/memory-store";
import { createSale } from "../sales";
import { createCashPayment, createDigitalPayment } from "../payments";
import { submitExpense } from "../expenses";
import { submitStockReport } from "../inventory";
import { reportLocation } from "../locations";
import { startShift, submitShiftClosing } from "../shifts";
import { submitIncident } from "../incidents";
import { money } from "../../shared/money/money";

export type OfflineAggregate =
  | "shift" | "location_report" | "sale" | "payment_cash" | "expense" | "stock_report"
  | "incident" | "closing";

export interface OutboxRecord {
  readonly aggregate: OfflineAggregate;
  readonly clientId: string;
  readonly sequence: number;
  readonly payload: unknown;
  readonly recordedAtDevice: Date;
  readonly syncState: "LOCAL_ONLY" | "PENDING" | "SYNCING" | "SYNCED" | "REJECTED" | "DEFERRED";
  readonly reasonCode?: string;
}

export interface Outbox {
  enqueue(record: OutboxRecord): Promise<void>;
  pending(): Promise<readonly OutboxRecord[]>;
  markResult(clientId: string, result: SyncRecordResult): Promise<void>;
  wipe(): Promise<void>;
}

// In-memory outbox for server-side testing (client would use IndexedDB)
class InMemoryOutbox implements Outbox {
  private records = new Map<string, OutboxRecord>();

  async enqueue(record: OutboxRecord): Promise<void> {
    this.records.set(record.clientId, record);
  }
  async pending(): Promise<readonly OutboxRecord[]> {
    return Array.from(this.records.values()).filter(r => r.syncState === "PENDING" || r.syncState === "LOCAL_ONLY");
  }
  async markResult(clientId: string, result: SyncRecordResult): Promise<void> {
    const rec = this.records.get(clientId);
    if (!rec) return;
    let syncState: OutboxRecord["syncState"] = "SYNCED";
    if (result.outcome === "REJECTED") syncState = "REJECTED";
    else if (result.outcome === "DEFERRED") syncState = "DEFERRED";
    else if (result.outcome === "ACCEPTED") syncState = "SYNCED";
    else if (result.outcome === "DUPLICATE") syncState = "SYNCED";
    this.records.set(clientId, { ...rec, syncState, reasonCode: result.reasonCode });
  }
  async wipe(): Promise<void> {
    this.records.clear();
  }
}

export function createOutbox(): Outbox {
  return new InMemoryOutbox();
}

export async function applySyncBatch(input: {
  organizationId: string; actorId: string; batch: { records: { aggregate: string; clientId: string; payload: any; recordedAtDevice: string; sequence: number }[] };
}): Promise<{ readonly results: readonly SyncRecordResult[] }> {
  const results: SyncRecordResult[] = [];
  // Ensure ordering per aggregate by sequence
  const sorted = [...input.batch.records].sort((a, b) => a.sequence - b.sequence);

  for (const rec of sorted) {
    try {
      switch (rec.aggregate) {
        case "shift": {
          const p = rec.payload;
          // p should contain shift data
          const existing = memoryStore.shiftByClientId.get(rec.clientId);
          if (existing) {
            results.push({ clientId: rec.clientId as any, outcome: "DUPLICATE", serverId: existing as any });
          } else {
            // Try to create shift
            try {
              const res = await startShift({
                operatorId: p.operatorId,
                stallId: p.stallId,
                sellingLocationId: p.sellingLocationId,
                openingCash: p.openingCash ? money(p.openingCash.amountMinor, "IDR") : undefined,
                startingStock: p.startingStock || [],
                clientShiftId: rec.clientId,
                organizationId: input.organizationId,
              });
              results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.shiftId as any });
            } catch (e: any) {
              if (e.code === "CONFLICT") {
                // Duplicate shift for operator/stall, treat as duplicate
                const dupId = memoryStore.shiftByClientId.get(rec.clientId) || "";
                results.push({ clientId: rec.clientId as any, outcome: "DUPLICATE", serverId: dupId as any });
              } else {
                results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED", reasonMessageId: e.message });
              }
            }
          }
          break;
        }
        case "location_report": {
          const p = rec.payload;
          const existing = memoryStore.locationReportByClientId.get(rec.clientId);
          if (existing) {
            results.push({ clientId: rec.clientId as any, outcome: "DUPLICATE", serverId: existing as any });
          } else {
            try {
              const res = await reportLocation({
                shiftId: p.shiftId,
                sellingLocationId: p.sellingLocationId,
                trigger: p.trigger,
                reasonForMove: p.reasonForMove,
                note: p.note,
                clientReportId: rec.clientId,
                organizationId: input.organizationId,
                operatorId: input.actorId,
              });
              results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.locationReportId as any });
            } catch (e: any) {
              results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED", reasonMessageId: e.message });
            }
          }
          break;
        }
        case "sale": {
          const p = rec.payload;
          const existing = memoryStore.saleByClientId.get(rec.clientId);
          if (existing) {
            results.push({ clientId: rec.clientId as any, outcome: "DUPLICATE", serverId: existing as any });
          } else {
            try {
              const res = await createSale({
                shiftId: p.shiftId,
                sellingLocationId: p.sellingLocationId,
                lines: p.lines,
                clientSaleId: rec.clientId,
                recordedAtDevice: new Date(rec.recordedAtDevice),
                organizationId: input.organizationId,
              });
              results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.saleId as any });
            } catch (e: any) {
              results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED", reasonMessageId: e.message });
            }
          }
          break;
        }
        case "payment_cash": {
          const p = rec.payload;
          const existing = memoryStore.paymentByClientId.get(rec.clientId);
          if (existing) {
            results.push({ clientId: rec.clientId as any, outcome: "DUPLICATE", serverId: existing as any });
          } else {
            try {
              const res = await createCashPayment({
                saleId: p.saleId,
                amount: money(p.amount.amountMinor, "IDR"),
                cashReceived: money(p.cashReceived.amountMinor, "IDR"),
                clientPaymentId: rec.clientId,
                organizationId: input.organizationId,
              });
              results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.paymentId as any });
            } catch (e: any) {
              results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED", reasonMessageId: e.message });
            }
          }
          break;
        }
        case "expense": {
          const p = rec.payload;
          const existing = memoryStore.expenseByClientId.get(rec.clientId);
          if (existing) {
            results.push({ clientId: rec.clientId as any, outcome: "DUPLICATE", serverId: existing as any });
          } else {
            try {
              const res = await submitExpense({
                shiftId: p.shiftId,
                categoryCode: p.categoryId || p.categoryCode,
                description: p.description,
                amount: money(p.amount.amountMinor, "IDR"),
                paidFrom: p.paidFrom,
                operatorNote: p.operatorNote,
                evidenceAssetId: p.evidenceAssetId,
                clientExpenseId: rec.clientId,
                recordedAtDevice: new Date(rec.recordedAtDevice),
                organizationId: input.organizationId,
              });
              results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.expenseId as any });
            } catch (e: any) {
              results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED", reasonMessageId: e.message });
            }
          }
          break;
        }
        case "stock_report": {
          const p = rec.payload;
          try {
            const res = await submitStockReport({
              shiftId: p.shiftId,
              kind: p.kind,
              items: p.items,
              clientReportId: rec.clientId,
              organizationId: input.organizationId,
            });
            results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.snapshotIds[0] as any });
          } catch (e: any) {
            results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED" });
          }
          break;
        }
        case "closing": {
          const p = rec.payload;
          const existing = memoryStore.closingByClientId.get(rec.clientId);
          if (existing) {
            results.push({ clientId: rec.clientId as any, outcome: "DUPLICATE", serverId: existing as any });
          } else {
            try {
              const res = await submitShiftClosing({
                shiftId: p.shiftId,
                countedCash: money(p.countedCash.amountMinor, "IDR"),
                varianceReason: p.varianceReason,
                varianceNote: p.varianceNote,
                stockCounts: p.stockCounts || [],
                clientClosingId: rec.clientId,
                organizationId: input.organizationId,
              });
              results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.closingId as any });
            } catch (e: any) {
              results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED", reasonMessageId: e.message });
            }
          }
          break;
        }
        case "incident": {
          const p = rec.payload;
          try {
            const res = await submitIncident({
              shiftId: p.shiftId,
              categoryId: p.categoryId,
              severity: p.severity,
              description: p.description,
              clientIncidentId: rec.clientId,
              recordedAtDevice: new Date(rec.recordedAtDevice),
              organizationId: input.organizationId,
              operatorId: input.actorId,
            });
            results.push({ clientId: rec.clientId as any, outcome: "ACCEPTED", serverId: res.incidentId as any });
          } catch (e: any) {
            results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: e.code || "VALIDATION_FAILED" });
          }
          break;
        }
        default: {
          results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: "UNKNOWN_AGGREGATE" });
        }
      }
    } catch (e: any) {
      results.push({ clientId: rec.clientId as any, outcome: "REJECTED", reasonCode: "INTERNAL", reasonMessageId: e.message });
    }
  }

  return { results };
}

export async function quarantineConflict(input: {
  organizationId: string; clientId: string; conflictCode: string; detail: string;
}): Promise<{ readonly quarantineId: string }> {
  const id = generateId();
  // Store as alert for now
  memoryStore.alerts.set(id, {
    id,
    organizationId: input.organizationId,
    type: "QUARANTINE",
    severity: "WARNING",
    message: `Quarantined ${input.clientId}: ${input.conflictCode} - ${input.detail}`,
    relatedEntityId: input.clientId,
    acknowledged: false,
    createdAt: new Date(),
  });
  return { quarantineId: id };
}

export function classifyFreshness(computedAt: Date, now: Date): "current" | "recent" | "stale" {
  const ageMs = now.getTime() - computedAt.getTime();
  const ageMin = ageMs / 60000;
  if (ageMin < 5) return "current";
  if (ageMin < 60) return "recent";
  return "stale";
}
