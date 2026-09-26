/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Identifiers (ADR-0032): UUIDv7 primary keys, opaque to clients as authorization tokens,
 * plus short human-readable business codes that are never used for security decisions.
 */
export type Uuid = string;
export type UuidV7 = Uuid;
export type OrganizationId = Uuid;
export type RegionId = Uuid;
export type AreaId = Uuid;
export type StallId = Uuid;
export type SellingLocationId = Uuid;
export type OperatorId = Uuid;
export type ShiftId = Uuid;
export type SaleId = Uuid;
export type PaymentId = Uuid;
export type ExpenseId = Uuid;
export type StockItemId = Uuid;
export type IncidentId = Uuid;
export type ClosingId = Uuid;
export type LoyaltyAccountId = Uuid;
export type RewardInstanceId = Uuid;

/** Offline-creatable records carry a client-generated UUIDv7 alias, unique per organisation. */
export type ClientRecordId = UuidV7;

/** Human-facing codes: unique per organisation, immutable, never an auth token. */
export type BusinessCode = string; // e.g. ST-014, SH-2026-09-26-0007
