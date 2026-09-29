import type { Scope } from "../../shared/types/scope";
import {
  memoryStore,
  syncFromDiskIfNeeded,
  persistNow,
  type StoredSale,
  type StoredSaleItem,
  type StoredPayment,
  type StoredExpense,
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
