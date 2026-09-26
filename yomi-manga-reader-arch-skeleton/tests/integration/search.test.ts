/**
 * TEST STRATEGY integration test — search (TEST_STRATEGY §4).
 *
 * Coverage:
 * - INT-SEARCH-001: trigram search — seed corpus (titles/aliases),
 *   ranked results (title > alias), kind/match hints, cursor paging
 *   stable under concurrent inserts (no dupes/losses), empty-catalog
 *   state (SEARCH_EMPTY), 2-char minimum enforced.
 *
 * TODO(INT-SEARCH-001): replace with real tests (real PG + pg_trgm).
 */
import { describe } from 'vitest';

describe.todo('trigram search (INT-SEARCH-001)');
