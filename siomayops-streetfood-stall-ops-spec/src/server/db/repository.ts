import type { Scope } from "../../shared/types/scope";
import { memoryStore } from "./memory-store";

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
