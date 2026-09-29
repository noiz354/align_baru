import { memoryStore, generateId } from "../../server/db/memory-store";
import type { OperatorId } from "../../shared/types/ids";
import type { BusinessDay } from "../../shared/time";
import { writeAuditEvent } from "../audit";

export interface PerformanceInputSnapshot {
  readonly operatorId: OperatorId;
  readonly periodKey: string;
  readonly inputs: Readonly<Record<string, number>>;
  readonly normalisers: Readonly<Record<string, number>>;
  readonly sampleSize: number;
  readonly computedAt: Date;
}

const snapshots = new Map<string, PerformanceInputSnapshot>();

export async function buildPerformanceSnapshot(input: {
  operatorId: OperatorId; businessDay: BusinessDay; organizationId?: string;
}): Promise<PerformanceInputSnapshot> {
  const orgId = input.organizationId || "00000000-0000-7000-0000-000000000001";
  // Compute inputs from facts: sales count, cash variance, attendance, etc.
  let salesCount = 0;
  let totalSalesMinor = 0;
  let expenseCount = 0;
  let varianceSum = 0;
  let shiftCount = 0;
  for (const shift of memoryStore.shifts.values()) {
    if (shift.operatorId !== input.operatorId) continue;
    if (shift.organizationId !== orgId) continue;
    shiftCount++;
    for (const sale of memoryStore.sales.values()) {
      if (sale.shiftId === shift.id && sale.status === "COMPLETED") {
        salesCount++;
        totalSalesMinor += sale.totalMinor;
      }
    }
    for (const exp of memoryStore.expenses.values()) {
      if (exp.shiftId === shift.id) expenseCount++;
    }
    for (const closing of memoryStore.closings.values()) {
      if (closing.shiftId === shift.id) {
        varianceSum += Math.abs(closing.cashVarianceMinor);
      }
    }
  }

  const inputs: Record<string, number> = {
    sales_count: salesCount,
    total_sales_minor: totalSalesMinor,
    expense_count: expenseCount,
    cash_variance_abs: varianceSum,
    shift_count: shiftCount,
    attendance_rate: shiftCount > 0 ? 1 : 0,
  };

  const normalisers: Record<string, number> = {
    location_traffic_factor: 1.0, // Would be based on location baseline
    shift_length_factor: 1.0,
    weekday_factor: 1.0,
  };

  const snapshot: PerformanceInputSnapshot = {
    operatorId: input.operatorId,
    periodKey: input.businessDay,
    inputs,
    normalisers,
    sampleSize: shiftCount,
    computedAt: new Date(),
  };
  const key = `${input.operatorId}|${input.businessDay}`;
  snapshots.set(key, snapshot);
  return snapshot;
}

export async function explainInputsToOperator(input: {
  operatorId: OperatorId; businessDay?: string;
}): Promise<{
  readonly inputs: readonly {
    readonly key: string; readonly value: number; readonly explanationMessageId: string;
  }[];
}> {
  const key = `${input.operatorId}|${input.businessDay || "latest"}`;
  let snap: PerformanceInputSnapshot | undefined;
  for (const [k, v] of snapshots.entries()) {
    if (k.startsWith(input.operatorId)) {
      snap = v;
      break;
    }
  }
  if (!snap) {
    // Build one
    snap = await buildPerformanceSnapshot({ operatorId: input.operatorId, businessDay: (input.businessDay || new Date().toISOString().slice(0, 10)) as BusinessDay });
  }
  const explanations: Record<string, string> = {
    sales_count: "Jumlah transaksi penjualan",
    total_sales_minor: "Total nilai penjualan",
    expense_count: "Jumlah pengeluaran tercatat",
    cash_variance_abs: "Selisih kas absolut",
    shift_count: "Jumlah shift",
    attendance_rate: "Tingkat kehadiran",
  };
  return {
    inputs: Object.entries(snap.inputs).map(([k, v]) => ({
      key: k,
      value: v,
      explanationMessageId: explanations[k] || k,
    })),
  };
}

export async function computeRecognitionPeriod(input: {
  periodKey: string; organizationId: string;
}): Promise<{
  readonly candidates: readonly { readonly operatorId: OperatorId; readonly sampleSize: number }[];
  readonly reviewRequired: true;
}> {
  const candidates: { operatorId: OperatorId; sampleSize: number }[] = [];
  for (const shift of memoryStore.shifts.values()) {
    if (shift.organizationId !== input.organizationId) continue;
    // Count shifts per operator in period
    // MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
    // Simplified: businessDay prefix match
    if (!shift.businessDay.startsWith(input.periodKey.slice(0, 7))) continue; // month match
  }
  // Build per operator
  const opShiftCount = new Map<string, number>();
  for (const shift of memoryStore.shifts.values()) {
    if (shift.organizationId !== input.organizationId) continue;
    if (!shift.businessDay.startsWith(input.periodKey.slice(0, 7))) continue;
    opShiftCount.set(shift.operatorId, (opShiftCount.get(shift.operatorId) || 0) + 1);
  }
  for (const [opId, count] of opShiftCount.entries()) {
    if (count >= 5) { // minimum sample size
      candidates.push({ operatorId: opId, sampleSize: count });
    }
  }
  // MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
  // Sort by sales count not revenue alone, multi-factor placeholder
  candidates.sort((a, b) => b.sampleSize - a.sampleSize);
  return { candidates, reviewRequired: true };
}

export async function publishRecognitionAward(input: {
  periodKey: string; operatorId: OperatorId; reviewerUserId: string; rationaleNote: string; organizationId?: string;
}): Promise<{ readonly recognitionAwardId: string }> {
  const orgId = input.organizationId || "00000000-0000-7000-0000-000000000001";
  const awardId = generateId();
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    actorId: input.reviewerUserId,
    action: "config.changed",
    subjectKind: "recognition_award",
    subjectId: awardId,
    reason: input.rationaleNote,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { periodKey: input.periodKey, operatorId: input.operatorId },
  });
  return { recognitionAwardId: awardId };
}
