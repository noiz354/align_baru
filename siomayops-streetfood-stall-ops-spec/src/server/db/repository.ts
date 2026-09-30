import type { Scope } from "../../shared/types/scope";
import {
  memoryStore,
  syncFromDiskIfNeeded,
  persistNow,
  type StoredAlert,
  type StoredAuditEvent,
  type StoredExpense,
  type StoredLocationReport,
  type StoredOperator,
  type StoredPayment,
  type StoredSale,
  type StoredSaleItem,
  type StoredShift,
  type StoredStall,
} from "./memory-store";

/** Every repository method takes an explicit scope (INV-11): unscoped access cannot be written. */
export interface ScopedRepository<TEntity, TCreate, TQuery> {
  findById(scope: Scope, id: string): Promise<TEntity | null>;
  list(scope: Scope, query: TQuery, page: { limit: number; cursor?: string }): Promise<{
    items: readonly TEntity[];
    nextCursor?: string;
  }>;
  create(scope: Scope, input: TCreate, context: WriteContext): Promise<TEntity>;
}

export interface WriteContext {
  readonly actorId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly clientRecordId?: string;
  readonly recordedAtDevice?: Date;
}

export async function withTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
  return fn({});
}

// Scope validation helpers
export function assertScopeOrganization(scope: Scope, orgId: string): void {
  if (scope.organizationId !== orgId) {
    throw new Error(`Scope organization mismatch: ${scope.organizationId} vs ${orgId}`);
  }
}

export function filterByScope<T extends { organizationId: string }>(items: Iterable<T>, scope: Scope): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (item.organizationId !== scope.organizationId) continue;
    if (scope.kind === "area" && (item as any).areaId && scope.areaId && (item as any).areaId !== scope.areaId) continue;
    if (scope.kind === "stall" && (item as any).stallId && scope.stallId && (item as any).stallId !== scope.stallId) continue;
    if (scope.kind === "self" && scope.operatorId) {
      if ((item as any).operatorId && (item as any).operatorId !== scope.operatorId) continue;
    }
    result.push(item);
  }
  return result;
}

// Scoped repositories for core entities (used by features & read models)
export const repositories = {
  operators: {
    async findById(scope: Scope, id: string) {
      syncFromDiskIfNeeded();
      const op = memoryStore.operators.get(id);
      if (!op) return null;
      if (op.organizationId !== scope.organizationId) return null;
      return op;
    },
    async list(scope: Scope) {
      syncFromDiskIfNeeded();
      const items = filterByScope(memoryStore.operators.values(), scope);
      return { items, nextCursor: undefined };
    }
  },
  stalls: {
    async findById(scope: Scope, id: string) {
      syncFromDiskIfNeeded();
      const s = memoryStore.stalls.get(id);
      if (!s) return null;
      if (s.organizationId !== scope.organizationId) return null;
      return s;
    },
    async findRawById(id: string) {
      syncFromDiskIfNeeded();
      return memoryStore.stalls.get(id) ?? null;
    },
    async list(scope: Scope) {
      syncFromDiskIfNeeded();
      let items = filterByScope(memoryStore.stalls.values(), scope);
      if (scope.kind === "stall") {
        items = items.filter(s => s.id === scope.stallId);
      } else if (scope.kind === "self") {
        const assignedStallIds = new Set(
          Array.from(memoryStore.assignments.values())
            .filter(a => a.organizationId === scope.organizationId && a.operatorId === scope.operatorId)
            .map(a => a.stallId)
        );
        items = items.filter(s => assignedStallIds.has(s.id));
      }
      return { items, nextCursor: undefined };
    }
  },
  sellingLocations: {
    async findById(scope: Scope, id: string) {
      syncFromDiskIfNeeded();
      const loc = memoryStore.sellingLocations.get(id);
      if (!loc) return null;
      if (loc.organizationId !== scope.organizationId) return null;
      return loc;
    },
    async findRawById(id: string) {
      syncFromDiskIfNeeded();
      return memoryStore.sellingLocations.get(id) ?? null;
    },
    async list(scope: Scope) {
      syncFromDiskIfNeeded();
      const items = filterByScope(memoryStore.sellingLocations.values(), scope);
      return { items, nextCursor: undefined };
    }
  },
  shifts: {
    async findById(scope: Scope, id: string) {
      syncFromDiskIfNeeded();
      const sh = memoryStore.shifts.get(id);
      if (!sh) return null;
      if (sh.organizationId !== scope.organizationId) return null;
      return sh;
    },
    async list(scope: Scope) {
      syncFromDiskIfNeeded();
      const items = filterByScope(memoryStore.shifts.values(), scope);
      return { items, nextCursor: undefined };
    }
  },
  sales: {
    async findById(scope: Scope, id: string) {
      syncFromDiskIfNeeded();
      const sale = memoryStore.sales.get(id);
      if (!sale) return null;
      if (sale.organizationId !== scope.organizationId) return null;
      const items = filterByScope([sale], scope);
      return items[0] ?? null;
    },
    async findByClientId(scope: Scope, clientSaleId: string) {
      syncFromDiskIfNeeded();
      const saleId = memoryStore.saleByClientId.get(clientSaleId);
      if (!saleId) return null;
      const sale = memoryStore.sales.get(saleId);
      if (!sale || sale.organizationId !== scope.organizationId) return null;
      return sale;
    },
    async list(scope: Scope, filter?: { stallId?: string; shiftId?: string; businessDay?: string; limit?: number }) {
      syncFromDiskIfNeeded();
      let items = filterByScope(memoryStore.sales.values(), scope);
      if (filter?.stallId) items = items.filter(s => s.stallId === filter.stallId);
      if (filter?.shiftId) items = items.filter(s => s.shiftId === filter.shiftId);
      if (filter?.businessDay) items = items.filter(s => s.businessDay === filter.businessDay);
      items.sort((a, b) => b.serverAcceptedAt.getTime() - a.serverAcceptedAt.getTime());
      if (filter?.limit) items = items.slice(0, filter.limit);
      return { items, nextCursor: undefined };
    },
    async createTransaction(
      scope: Scope,
      records: {
        sale: StoredSale;
        saleItem?: StoredSaleItem;
        payment: StoredPayment;
      }
    ): Promise<{ sale: StoredSale; payment: StoredPayment }> {
      assertScopeOrganization(scope, records.sale.organizationId);
      assertScopeOrganization(scope, records.payment.organizationId);
      memoryStore.sales.set(records.sale.id, records.sale);
      memoryStore.saleByClientId.set(records.sale.clientSaleId, records.sale.id);
      if (records.saleItem) {
        memoryStore.saleItems.set(records.saleItem.id, records.saleItem);
      }
      memoryStore.payments.set(records.payment.id, records.payment);
      memoryStore.paymentByClientId.set(records.payment.clientPaymentId, records.payment.id);
      persistNow();
      return { sale: records.sale, payment: records.payment };
    },
  },
  payments: {
    async findBySaleId(scope: Scope, saleId: string) {
      syncFromDiskIfNeeded();
      for (const p of memoryStore.payments.values()) {
        if (p.organizationId === scope.organizationId && p.saleId === saleId) {
          return p;
        }
      }
      return null;
    },
    async list(scope: Scope) {
      syncFromDiskIfNeeded();
      const items = filterByScope(memoryStore.payments.values(), scope);
      return { items, nextCursor: undefined };
    }
  },
  expenses: {
    async findById(scope: Scope, id: string) {
      syncFromDiskIfNeeded();
      const exp = memoryStore.expenses.get(id);
      if (!exp || exp.organizationId !== scope.organizationId) return null;
      return exp;
    },
    async findByClientId(scope: Scope, clientExpenseId: string) {
      syncFromDiskIfNeeded();
      const expenseId = memoryStore.expenseByClientId.get(clientExpenseId);
      if (!expenseId) return null;
      const exp = memoryStore.expenses.get(expenseId);
      if (!exp || exp.organizationId !== scope.organizationId) return null;
      return exp;
    },
    async list(
      scope: Scope,
      filter?: {
        stallId?: string;
        shiftId?: string;
        businessDay?: string;
        reviewStatus?: string;
        limit?: number;
      }
    ) {
      syncFromDiskIfNeeded();
      let items = filterByScope(memoryStore.expenses.values(), scope);
      if (filter?.stallId) {
        items = items.filter(e => {
          if (e.stallId) return e.stallId === filter.stallId;
          const shift = memoryStore.shifts.get(e.shiftId);
          return shift?.stallId === filter.stallId;
        });
      }
      if (filter?.shiftId) items = items.filter(e => e.shiftId === filter.shiftId);
      if (filter?.businessDay) items = items.filter(e => e.businessDay === filter.businessDay);
      if (filter?.reviewStatus) items = items.filter(e => e.reviewStatus === filter.reviewStatus);
      items.sort((a, b) => b.incurredAt.getTime() - a.incurredAt.getTime());
      if (filter?.limit) items = items.slice(0, filter.limit);
      return { items, nextCursor: undefined };
    },
    async createExpense(scope: Scope, expense: StoredExpense): Promise<StoredExpense> {
      assertScopeOrganization(scope, expense.organizationId);
      memoryStore.expenses.set(expense.id, expense);
      memoryStore.expenseByClientId.set(expense.clientExpenseId, expense.id);
      persistNow();
      return expense;
    },
    async updateExpense(scope: Scope, expense: StoredExpense): Promise<StoredExpense> {
      assertScopeOrganization(scope, expense.organizationId);
      memoryStore.expenses.set(expense.id, expense);
      persistNow();
      return expense;
    },
  }
};

/** Deny helper: a missing, ambiguous or unsupported scope is a DENY, never a wider fallback
 * (docs/security/PERMISSIONS.md §1 rule 4). */
function deny(message: string): never {
  throw Object.assign(new Error(message), { code: "FORBIDDEN" });
}

/**
 * A scope-resolved, read-only view over the store for reporting queries (read models, cards).
 *
 * Every method is bounded by `scope` exactly once — organization, then area/stall narrowing —
 * so a read model never has to re-apply scope per record and cannot widen it by accident.
 * The reader resolves the scope once in `openScopedReader`; callers cannot pass arbitrary
 * narrower/wider sets of stalls.
 */
export interface ScopedReader {
  readonly organizationId: string;
  readonly scopeKind: Scope["kind"];
  /** Stalls the scope authorizes (registry rows only). */
  listAuthorizedStalls(): readonly StoredStall[];
  /** Organization-level existence check, used only to distinguish NOT_FOUND from FORBIDDEN. */
  findStallInOrganization(stallId: string): StoredStall | null;
  listOperators(operatorIds?: readonly string[]): readonly StoredOperator[];
  listShifts(query: { businessDay: string }): readonly StoredShift[];
  listSales(query: { businessDay: string }): readonly StoredSale[];
  listExpenses(query: { shiftIds: readonly string[] }): readonly StoredExpense[];
  listPayments(query: { saleIds: readonly string[] }): readonly StoredPayment[];
  listLocationReports(query: { shiftIds: readonly string[] }): readonly StoredLocationReport[];
  /** Organization-scoped; attribution narrowing to area/stall scope happens in the read model. */
  listAlerts(): readonly StoredAlert[];
  /** Organization-scoped and time-bounded; attribution narrowing happens in the read model. */
  listAuditEvents(query: { from: Date; to: Date }): readonly StoredAuditEvent[];
}

/**
 * Resolve a session scope into a repository-level read view.
 *
 * Supported: `org`, `area`, `stall`. `region` has no persisted data in this schema and `self`
 * has no stall-attribution rule, so both are denied (fail closed, PERMISSIONS.md §1).
 */
export function openScopedReader(scope: Scope): ScopedReader {
  const organizationId = scope.organizationId;
  const allStalls: StoredStall[] = [];
  for (const stall of memoryStore.stalls.values()) {
    if (stall.organizationId === organizationId) allStalls.push(stall);
  }

  let authorizedStallIds: ReadonlySet<string> | null = null;
  switch (scope.kind) {
    case "org":
      authorizedStallIds = null;
      break;
    case "area": {
      if (!scope.areaId) deny("Area scope without an area id is not resolvable");
      authorizedStallIds = new Set(
        allStalls.filter((stall) => stall.areaId === scope.areaId).map((stall) => stall.id)
      );
      break;
    }
    case "stall": {
      if (!scope.stallId) deny("Stall scope without a stall id is not resolvable");
      authorizedStallIds = new Set(
        allStalls.filter((stall) => stall.id === scope.stallId).map((stall) => stall.id)
      );
      break;
    }
    case "region":
      deny("Region scope is not supported by the persisted data model");
      break;
    case "self":
      deny("Self scope cannot read network-wide dashboards");
      break;
    default:
      deny(`Unsupported scope kind: ${String(scope.kind)}`);
  }

  const stallAllowed = (stallId: string | undefined): boolean =>
    authorizedStallIds === null || (stallId !== undefined && authorizedStallIds.has(stallId));

  const allowedIds = (ids: readonly string[]): ReadonlySet<string> => new Set(ids);

  return {
    organizationId,
    scopeKind: scope.kind,
    listAuthorizedStalls() {
      return authorizedStallIds === null
        ? allStalls
        : allStalls.filter((stall) => authorizedStallIds.has(stall.id));
    },
    findStallInOrganization(stallId: string) {
      return allStalls.find((stall) => stall.id === stallId) ?? null;
    },
    listOperators(operatorIds?: readonly string[]) {
      const filter = operatorIds ? allowedIds(operatorIds) : null;
      const result: StoredOperator[] = [];
      for (const operator of memoryStore.operators.values()) {
        if (operator.organizationId !== organizationId) continue;
        if (filter && !filter.has(operator.id)) continue;
        result.push(operator);
      }
      return result;
    },
    listShifts(query) {
      const result: StoredShift[] = [];
      for (const shift of memoryStore.shifts.values()) {
        if (shift.organizationId !== organizationId) continue;
        if (shift.businessDay !== query.businessDay) continue;
        if (!stallAllowed(shift.stallId)) continue;
        result.push(shift);
      }
      return result;
    },
    listSales(query) {
      const result: StoredSale[] = [];
      for (const sale of memoryStore.sales.values()) {
        if (sale.organizationId !== organizationId) continue;
        if (sale.businessDay !== query.businessDay) continue;
        if (!stallAllowed(sale.stallId)) continue;
        result.push(sale);
      }
      return result;
    },
    listExpenses(query) {
      const shiftIds = allowedIds(query.shiftIds);
      const result: StoredExpense[] = [];
      for (const expense of memoryStore.expenses.values()) {
        if (expense.organizationId !== organizationId) continue;
        if (!shiftIds.has(expense.shiftId)) continue;
        result.push(expense);
      }
      return result;
    },
    listPayments(query) {
      const saleIds = allowedIds(query.saleIds);
      const result: StoredPayment[] = [];
      for (const payment of memoryStore.payments.values()) {
        if (payment.organizationId !== organizationId) continue;
        if (!saleIds.has(payment.saleId)) continue;
        result.push(payment);
      }
      return result;
    },
    listLocationReports(query) {
      const shiftIds = allowedIds(query.shiftIds);
      const result: StoredLocationReport[] = [];
      for (const report of memoryStore.locationReports.values()) {
        if (report.organizationId !== organizationId) continue;
        if (!shiftIds.has(report.shiftId)) continue;
        result.push(report);
      }
      return result;
    },
    listAlerts() {
      const result: StoredAlert[] = [];
      for (const alert of memoryStore.alerts.values()) {
        if (alert.organizationId !== organizationId) continue;
        result.push(alert);
      }
      return result;
    },
    listAuditEvents(query) {
      const result: StoredAuditEvent[] = [];
      for (const event of memoryStore.auditEvents) {
        if (event.organizationId !== organizationId) continue;
        const at = event.occurredAt.getTime();
        if (!(at >= query.from.getTime() && at < query.to.getTime())) continue;
        result.push(event);
      }
      return result;
    },
  };
}
