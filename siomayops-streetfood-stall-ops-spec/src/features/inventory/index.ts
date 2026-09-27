import { memoryStore, generateId } from "../../server/db/memory-store";
import { deriveStockPosition, computeStockVariance } from "../../domain/inventory/variance";
import { writeAuditEvent } from "../audit";

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export async function createStockItem(input: {
  code: string; name: string; category: string; unit: string; organizationId?: string;
}): Promise<{ stockItemId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Unique code per org
  for (const item of memoryStore.stockItems.values()) {
    if (item.organizationId === orgId && item.code === input.code) {
      throw Object.assign(new Error("Stock code exists"), { code: "CONFLICT" });
    }
  }
  const id = generateId();
  memoryStore.stockItems.set(id, {
    id,
    organizationId: orgId,
    code: input.code,
    name: input.name,
    category: input.category,
    unit: input.unit,
    active: true,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    action: "stock.movement",
    subjectKind: "stock_item",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { code: input.code, name: input.name },
  });
  return { stockItemId: id };
}

export async function recordStockMovement(input: {
  stockItemId: string; stallId?: string; operatorId?: string; shiftId?: string;
  movementType: string; quantity: number; reason?: string; actorId: string;
  clientMovementId: string; organizationId?: string;
}): Promise<{ movementId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const existingId = memoryStore.movementByClientId.get(input.clientMovementId);
  if (existingId) {
    return { movementId: existingId };
  }
  const id = generateId();
  const now = new Date();
  memoryStore.stockMovements.set(id, {
    id,
    organizationId: orgId,
    stockItemId: input.stockItemId,
    stallId: input.stallId,
    operatorId: input.operatorId,
    shiftId: input.shiftId,
    movementType: input.movementType,
    quantity: input.quantity,
    occurredAt: now,
    reason: input.reason,
    actorId: input.actorId,
    clientMovementId: input.clientMovementId,
  });
  memoryStore.movementByClientId.set(input.clientMovementId, id);

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.actorId,
    action: "stock.movement",
    subjectKind: "stock_movement",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { type: input.movementType, quantity: input.quantity, stockItemId: input.stockItemId },
  });

  return { movementId: id };
}

export async function submitStockReport(input: {
  shiftId: string; kind: string; items: { stockItemId: string; quantity: number; notCounted?: boolean; reason?: string }[];
  clientReportId: string; organizationId?: string; actorId?: string;
}): Promise<{ snapshotIds: string[] }> {
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  const orgId = input.organizationId || shift.organizationId;
  const snapshotIds: string[] = [];
  const phase = input.kind === "OPENING_COUNT" ? "START" : "END";
  for (const item of input.items) {
    const id = generateId();
    // Derive expected from movements
    let expected: number | undefined;
    try {
      const movements = Array.from(memoryStore.stockMovements.values()).filter(m => m.stockItemId === item.stockItemId && m.stallId === shift.stallId);
      if (movements.length > 0) {
        const derived = deriveStockPosition(movements.map(m => ({
          movementId: m.id,
          stallId: m.stallId || "",
          shiftId: m.shiftId,
          stockItemId: m.stockItemId,
          kind: m.movementType as any,
          quantity: m.quantity,
          recordedBy: m.actorId,
          occurredAt: m.occurredAt,
          clientMovementId: m.clientMovementId,
        })));
        expected = derived.quantity;
      }
    } catch {
      // ignore
    }
    const counted = item.notCounted ? null : item.quantity;
    const varianceInfo = computeStockVariance(expected ?? 0, counted);
    memoryStore.stockSnapshots.set(id, {
      id,
      organizationId: orgId,
      shiftId: input.shiftId,
      stockItemId: item.stockItemId,
      phase: phase as any,
      countedQuantity: counted,
      expectedQuantity: expected,
      varianceQuantity: varianceInfo.uncounted ? undefined : varianceInfo.difference,
      reason: item.reason,
    });
    snapshotIds.push(id);
  }

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.actorId || shift.operatorId,
    action: "stock.count_submitted",
    subjectKind: "stock_snapshot",
    subjectId: snapshotIds[0] || generateId(),
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { kind: input.kind, items: input.items.length },
  });

  return { snapshotIds };
}

export async function getStockPosition(stallId: string, stockItemId: string): Promise<{ quantity: number }> {
  const movements = Array.from(memoryStore.stockMovements.values()).filter(m => m.stallId === stallId && m.stockItemId === stockItemId);
  if (movements.length === 0) return { quantity: 0 };
  const derived = deriveStockPosition(movements.map(m => ({
    movementId: m.id,
    stallId: m.stallId || "",
    shiftId: m.shiftId,
    stockItemId: m.stockItemId,
    kind: m.movementType as any,
    quantity: m.quantity,
    recordedBy: m.actorId,
    occurredAt: m.occurredAt,
    clientMovementId: m.clientMovementId,
  })));
  return { quantity: derived.quantity };
}

export async function requestRestock(input: {
  stallId: string; items: { stockItemId: string; quantity: number }[]; neededBy?: Date; note?: string; clientRequestId: string; organizationId?: string; actorId?: string;
}): Promise<{ requestId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  // For simplicity, we store as alert and movement request
  const now = new Date();
  memoryStore.alerts.set(id, {
    id,
    organizationId: orgId,
    type: "RESTOCK_REQUEST",
    severity: "INFO",
    message: `Restock request for stall ${input.stallId}: ${input.items.map(i => `${i.stockItemId} x${i.quantity}`).join(", ")}`,
    relatedEntityType: "stall",
    relatedEntityId: input.stallId,
    acknowledged: false,
    createdAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.actorId,
    action: "stock.transfer",
    subjectKind: "restock_request",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { stallId: input.stallId, items: input.items },
  });
  return { requestId: id };
}
