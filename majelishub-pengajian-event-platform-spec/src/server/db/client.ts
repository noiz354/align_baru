/**
 * Database client and transaction helpers.
 *
 * Where this belongs: server/db (infrastructure; the ONLY place SQL is issued). Domain code never sees
 * this module - it goes through repositories.
 * Specification: docs/research/STACK-2026.md §5 (Postgres 18 + Drizzle), ADR-0020 (no migrations on
 *   boot), DATA_MODEL.md §11 (14 constraint invariants), ADR-0017 (RLS session variables per tx).
 * Invariants:
 *   1. Migrations are applied by an explicit deploy step (`npm run db:migrate`) - never at application
 *      start-up (ADR-0020).
 *   2. Every transaction that touches tenant data sets the RLS session variables from the TenantScope.
 *   3. Statement timeouts are configured so a runaway query cannot hold an entrance hostage.
 *   4. No query is constructed by string interpolation of user input.
 * Task ownership: T-SEC-001/003 (scope + RLS), T-ARCH-001 (schema scaffolding).
 */
export interface DbTransaction {
  /** Opaque handle; repositories are the only consumers. */
  readonly scopeId: string;
}

/** @throws Error("Not implemented: T-ARCH-001") */
export async function withTransaction<T>(scope: import("@/shared/contracts/scope").TenantScope, fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  throw new Error("Not implemented: T-ARCH-001");
}

/** @throws Error("Not implemented: T-ARCH-001") */
export function db(): never {
  throw new Error("Not implemented: T-ARCH-001");
}
