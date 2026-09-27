import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, type ErrorCode } from '../../../src/shared/errors/codes';
import {
  toHttpStatus,
  domainError,
  isDomainError,
  toOperationResult,
} from '../../../src/server/errors/map-error';

// Documentation and code must not drift: the catalogue is part of the contract.
// T-PLAT-007, NFR-MAINT-003, docs/domain/ERRORS.md, docs/api/ERROR-CATALOG.md.

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** `| \`CODE\` | … |` rows: the first cell of every catalogue table. */
function codeRows(doc: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of read(doc).split('\n')) {
    const match = /^\|\s*`([A-Z][A-Z0-9_]+)`\s*\|(.*)$/.exec(line);
    if (match?.[1])
      rows.set(
        match[1],
        (match[2] ?? '').split('|').map((cell) => cell.trim()),
      );
  }
  return rows;
}

const DOMAIN_ERRORS = codeRows('docs/domain/ERRORS.md');
const ERROR_CATALOG = codeRows('docs/api/ERROR-CATALOG.md');

describe('error catalogue', () => {
  it('T-PLAT-007 NFR-MAINT-003: every code in docs/domain/ERRORS.md exists in src/shared/errors/codes.ts', () => {
    const implemented = new Set<string>(ERROR_CODES);
    const missing = [...DOMAIN_ERRORS.keys()].filter((code) => !implemented.has(code));
    expect(missing).toEqual([]);
  });

  it('T-PLAT-007 NFR-MAINT-003: every code in the vocabulary is documented in docs/domain/ERRORS.md', () => {
    // The reverse direction: a code that no document describes is a code nobody asked for
    // (AGENTS.md §3).
    const undocumented = ERROR_CODES.filter((code) => !DOMAIN_ERRORS.has(code));
    expect(undocumented).toEqual([]);
  });

  it('T-PLAT-007 NFR-MAINT-003: every code has a row in docs/api/ERROR-CATALOG.md with an HTTP status, or is internal', () => {
    const withoutTransportRow = ERROR_CODES.filter((code) => !ERROR_CATALOG.has(code));
    for (const code of withoutTransportRow) {
      const cells = DOMAIN_ERRORS.get(code) ?? [];
      // Internal codes are documented with `—` in the HTTP column: logged, never transported.
      const documentedInternal = cells.some((cell) => /^—/.test(cell) || /internal/i.test(cell));
      expect(
        documentedInternal,
        `${code} has no ERROR-CATALOG row and is not marked internal in ERRORS.md`,
      ).toBe(true);
    }
  });

  it('T-PLAT-007 NFR-MAINT-003: the HTTP status table matches docs/api/ERROR-CATALOG.md', () => {
    const mismatches: string[] = [];
    for (const [code, cells] of ERROR_CATALOG) {
      const status = Number.parseInt(cells[0] ?? '', 10);
      if (Number.isNaN(status)) continue; // a row whose first cell is not a status (policy tables)
      if (!ERROR_CODES.includes(code as ErrorCode)) {
        mismatches.push(`${code}: catalogued but absent from ERROR_CODES`);
        continue;
      }
      const actual = toHttpStatus(domainError(code as ErrorCode, 'test'));
      if (actual !== status)
        mismatches.push(`${code}: ERROR-CATALOG says ${status}, map-error says ${actual}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('T-PLAT-007 NFR-MAINT-003: codes are unique and match SCREAMING_SNAKE_CASE', () => {
    const seen = new Set<string>();
    const duplicates = ERROR_CODES.filter((code) => (seen.has(code) ? true : (seen.add(code), false)));
    expect(duplicates).toEqual([]);
    for (const code of ERROR_CODES) {
      expect(code, `${code} is not SCREAMING_SNAKE_CASE`).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    }
  });

  it('T-PLAT-007 NFR-SEC-003: an unknown error becomes INTERNAL with no internal detail', () => {
    // SECURITY.md §5: a stack trace, a SQL fragment, or a driver message never reaches a member.
    const leaked = new Error('duplicate key value violates unique constraint "uq_room_household_name_lower"');
    expect(isDomainError(leaked)).toBe(false);
    const result = toOperationResult<null>({ error: leaked, requestId: 'req_1' });
    if (result.ok) throw new Error('expected a failure result');
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.message).not.toMatch(/unique constraint|duplicate key|uq_/i);
    expect(toHttpStatus(result.error)).toBe(500);
    // The correlation id is the only diagnostic detail that crosses the boundary (E-5/E-7).
    expect(result.error.details?.reference).toBe('req_1');
    expect(result.meta?.clientRequestId).toBe('req_1');
  });

  it('T-PLAT-007: a domain error keeps its code, and NOT_FOUND never becomes FORBIDDEN', () => {
    // SECURITY.md §3 / I-XA-002: a cross-household id is "not found", never "forbidden".
    const notFound = domainError('NOT_FOUND', 'room');
    expect(toOperationResult<null>({ error: notFound, requestId: 'req_2' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(toHttpStatus(notFound)).toBe(404);
  });
});
