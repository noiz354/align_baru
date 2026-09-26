/**
 * Integration tests — media delivery + schema (real PG; storage may use
 * a port-level fake).
 * Canonical plan: TEST_STRATEGY.md §3 (INT-MEDIA-001); schema legs per
 * T-FOUND-006 + non-functional gates §5.
 *
 * TODO(T-CATALOG-010, T-FOUND-006): replace describe.todo with real
 * tests.
 */
import { describe } from 'vitest';

// INT-MEDIA-001 (T-CATALOG-010): variant content-type per STORED format,
// immutable headers (public, max-age=31536000), ETag, nosniff; 404 on
// unknown/draft key (no existence leak); storage failure → 502
// STORAGE_ERROR with no vendor text (THREAT T-11/T-13).
describe.todo('INT-MEDIA-001 delivery contract');

// Schema assertions (T-FOUND-006; no dedicated INT ID in the plan):
// tables/FKs/CHECKs/partial indexes match DATA_MODEL.md (introspection
// diff), pg_trgm present, app role has no DDL, audit table append-only
// for app role (NFR-SEC-015, T-SEC-005).
describe.todo('schema assertions (T-FOUND-006)');
