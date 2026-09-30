import { memoryStore, type StoredSale } from "@/server/db/memory-store";
import type { SessionContext } from "@/server/auth/port";
import type { Scope } from "@/shared/types/scope";

export interface TransactionFilters {
  businessDay?: string;
  stallId?: string;
  status?: StoredSale["status"];
  limit?: number;
  offset?: number;
}

export interface TransactionRow {
  id: string;
  status: StoredSale["status"];
  totalMinor: number;
  currency: "IDR";
  businessDay: string;
  occurredAt: string;
  acceptedAt: string;
  shiftId: string;
  stallId: string;
  outletName: string;
  lineCount: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
}

export interface TransactionDetail extends TransactionRow {
  lines: Array<{
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    currency: "IDR";
  }>;
  payments: Array<{
    method: string;
    status: string;
    amountMinor: number;
    currency: "IDR";
    createdAt: string;
  }>;
}

function withinScope(sale: StoredSale, session: SessionContext): boolean {
  if (sale.organizationId !== session.organizationId) return false;
  const shift = memoryStore.shifts.get(sale.shiftId);
  if (!shift || shift.organizationId !== session.organizationId) return false;
  if (session.scope.kind === "self" && shift.operatorId !== session.scope.operatorId) return false;
  if (session.scope.kind === "stall" && shift.stallId !== session.scope.stallId) return false;
  if (session.scope.kind === "area") {
    const stall = memoryStore.stalls.get(shift.stallId);
    if (!stall || stall.areaId !== session.scope.areaId) return false;
  }
  // Region relationships are not represented in the current store; fail closed until available.
  if (session.scope.kind === "region") return false;
  return true;
}

function toRow(sale: StoredSale): TransactionRow {
  const shift = memoryStore.shifts.get(sale.shiftId);
  const stall = shift ? memoryStore.stalls.get(shift.stallId) : undefined;
  const items = Array.from(memoryStore.saleItems.values()).filter((item) => item.saleId === sale.id && item.organizationId === sale.organizationId);
  const payment = Array.from(memoryStore.payments.values()).find((p) => p.saleId === sale.id && p.organizationId === sale.organizationId);
  return {
    id: sale.id,
    status: sale.status,
    totalMinor: sale.totalMinor,
    currency: sale.currency,
    businessDay: sale.businessDay,
    occurredAt: sale.occurredAt.toISOString(),
    acceptedAt: sale.serverAcceptedAt.toISOString(),
    shiftId: sale.shiftId,
    stallId: sale.stallId,
    outletName: stall?.code ?? "Outlet tidak tersedia",
    lineCount: items.length,
    paymentMethod: payment?.method ?? null,
    paymentStatus: payment?.status ?? null,
  };
}

export function listTransactions(session: SessionContext, filters: TransactionFilters = {}): { data: TransactionRow[]; total: number; limit: number; offset: number; outlets: Array<{ id: string; name: string }> } {
  const limit = Math.max(1, Math.min(filters.limit ?? 25, 100));
  const offset = Math.max(0, filters.offset ?? 0);
  const all = Array.from(memoryStore.sales.values())
    .filter((sale) => withinScope(sale, session))
    .filter((sale) => !filters.businessDay || sale.businessDay === filters.businessDay)
    .filter((sale) => !filters.stallId || sale.stallId === filters.stallId)
    .filter((sale) => !filters.status || sale.status === filters.status)
    .sort((a, b) => b.serverAcceptedAt.getTime() - a.serverAcceptedAt.getTime() || b.id.localeCompare(a.id));
  const accessibleStallIds = new Set(Array.from(memoryStore.shifts.values())
    .filter((shift) => shift.organizationId === session.organizationId)
    .filter((shift) => session.scope.kind !== "self" || shift.operatorId === session.scope.operatorId)
    .filter((shift) => session.scope.kind !== "stall" || shift.stallId === session.scope.stallId)
    .filter((shift) => {
      if (session.scope.kind === "region") return false;
      if (session.scope.kind !== "area") return true;
      return memoryStore.stalls.get(shift.stallId)?.areaId === session.scope.areaId;
    })
    .map((shift) => shift.stallId));
  const outlets = Array.from(accessibleStallIds)
    .map((id) => memoryStore.stalls.get(id))
    .filter((stall): stall is NonNullable<typeof stall> => Boolean(stall))
    .map((stall) => ({ id: stall.id, name: stall.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { data: all.slice(offset, offset + limit).map(toRow), total: all.length, limit, offset, outlets };
}

export function getTransaction(session: SessionContext, transactionId: string): TransactionDetail | null {
  const sale = memoryStore.sales.get(transactionId);
  if (!sale || !withinScope(sale, session)) return null;
  const row = toRow(sale);
  const lines = Array.from(memoryStore.saleItems.values())
    .filter((item) => item.saleId === sale.id && item.organizationId === sale.organizationId)
    .map((item) => ({
      menuItemId: item.menuItemId,
      menuItemName: (() => {
        const menuItem = memoryStore.menuItems.get(item.menuItemId);
        return menuItem?.organizationId === sale.organizationId ? menuItem.name : "Menu tidak tersedia";
      })(),
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      lineTotalMinor: item.lineTotalMinor,
      currency: "IDR" as const,
    }));
  const payments = Array.from(memoryStore.payments.values())
    .filter((payment) => payment.saleId === sale.id && payment.organizationId === sale.organizationId)
    .map((payment) => ({
      method: payment.method,
      status: payment.status,
      amountMinor: payment.amountMinor,
      currency: "IDR" as const,
      createdAt: payment.createdAt.toISOString(),
    }));
  return { ...row, lines, payments };
}

export function transactionScopeForShift(shiftId: string, organizationId: string): Scope | null {
  const shift = memoryStore.shifts.get(shiftId);
  if (!shift || shift.organizationId !== organizationId) return null;
  const stall = memoryStore.stalls.get(shift.stallId);
  return stall
    ? { kind: "stall", organizationId, stallId: stall.id, areaId: stall.areaId }
    : { kind: "stall", organizationId, stallId: shift.stallId };
}

export function canAccessShift(session: SessionContext, shiftId: string): boolean {
  const shift = memoryStore.shifts.get(shiftId);
  if (!shift || shift.organizationId !== session.organizationId) return false;
  if (session.scope.kind === "self" && shift.operatorId !== session.scope.operatorId) return false;
  if (session.scope.kind === "stall" && shift.stallId !== session.scope.stallId) return false;
  if (session.scope.kind === "area") {
    const stall = memoryStore.stalls.get(shift.stallId);
    if (!stall || stall.areaId !== session.scope.areaId) return false;
  }
  // Region relationships are not represented in the current store; fail closed until available.
  if (session.scope.kind === "region") return false;
  return true;
}
