/**
 * PHASE 0 — NO TABLES ARE DEFINED YET, ON PURPOSE.
 * The data model is specified in DATA_MODEL.md (entity verdicts, keys, constraints, derived-vs-stored
 * decisions) and the schema is created in the owning tasks (T-FOUND-003, T-OP-001, T-SHIFT-001, ...).
 * Writing tables here without their tasks would silently pre-empt design decisions.
 *
 * Binding rules when tables are written (ADR-0003, ADR-0031, INV-10):
 *  - every table carries `organization_id`
 *  - every unique constraint includes `organization_id`
 *  - money columns are integer minor units and carry an explicit currency column
 *  - timestamps are `timestamptz`; business day is derived, not stored as the only date
 *  - append-only tables (audit, stock movements, loyalty ledger) revoke UPDATE/DELETE
 *  - client-created records carry a unique `(organization_id, client_record_id)` alias
 *  - offline-creatable records are keyed by UUIDv7, never by an auto-increment integer
 */
export const SCHEMA_IS_INTENTIONALLY_EMPTY_IN_PHASE_0 = true;
