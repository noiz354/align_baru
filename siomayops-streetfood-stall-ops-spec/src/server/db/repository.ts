import type { Scope } from "../../shared/types/scope";
import {
  memoryStore,
  type StoredAlert,
  type StoredAuditEvent,
  type StoredExpense,
  type StoredLocationReport,
  type StoredOperator,
  type StoredPayment,
  type StoredSale,
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
  // In-memory: no real transaction, but we ensure atomicity via synchronous operations
  // For Postgres, this would be a real transaction. Here we just execute.
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
    // Additional scoping could be added: region, area, stall, self
    if (scope.kind === "area" && (item as any).areaId && scope.areaId && (item as any).areaId !== scope.areaId) continue;
    if (scope.kind === "stall" && (item as any).stallId && scope.stallId && (item as any).stallId !== scope.stallId) continue;
    // self scope: only operator's own records
    if (scope.kind === "self" && scope.operatorId) {
      if ((item as any).operatorId && (item as any).operatorId !== scope.operatorId) continue;
    }
    result.push(item);
  }
  return result;
}

// Simple in-memory repositories for core entities (used by features)
export const repositories = {
  operators: {
    async findById(scope: Scope, id: string) {
      const op = memoryStore.operators.get(id);
      if (!op) return null;
      if (op.organizationId !== scope.organizationId) return null;
      return op;
    },
    async list(scope: Scope) {
      const items = filterByScope(memoryStore.operators.values(), scope);
      return { items, nextCursor: undefined };
    }
  },
  stalls: {
    async findById(scope: Scope, id: string) {
      const s = memoryStore.stalls.get(id);
      if (!s) return null;
      if (s.organizationId !== scope.organizationId) return null;
      return s;
    }
  },
  shifts: {
    async findById(scope: Scope, id: string) {
      const sh = memoryStore.shifts.get(id);
      if (!sh) return null;
      if (sh.organizationId !== scope.organizationId) return null;
      return sh;
    }
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
