/**
 * Schema barrel - the single import point for Drizzle table definitions.
 *
 * Where this belongs: `server/db/schema`. Feature code never imports tables directly; it goes through
 * repositories in `server/db/repositories/**` (ADR-0017 layer 2: ad-hoc queries in feature code are
 * forbidden).
 *
 * Task ownership: T-ARCH-001 (contract registry / schema scaffolding), T-SEC-001 (tenancy),
 * T-ORG-001 (identity), T-SEC-007 (audit).
 */
export * from "./audit";
export * from "./identity";
export * from "./tenancy";
export * from "./events";
export * from "./registrations";

import * as audit from "./audit";
import * as identity from "./identity";
import * as tenancy from "./tenancy";
import * as events from "./events";
import * as registrations from "./registrations";

/** Passed to `drizzle(pool, { schema })` so relational queries are typed. */
export const schema = { ...audit, ...identity, ...tenancy, ...events, ...registrations };

export type Schema = typeof schema;
