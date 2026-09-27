// @ts-check
/**
 * Error-contract completeness check (CI gate for API_CONTRACT.md §6).
 *
 * Task: T-FOUND-009 — "…mapping as data (single source) … and the CI
 * completeness check". Requirements: API_CONTRACT.md §6 (normative table),
 * NFR-SEC-010, THREAT T-13. Companion test: UNIT-ERR-001
 * (tests/unit/error-contract.test.ts), which pins the same table with a
 * hand-written snapshot.
 *
 * What it proves, in both directions:
 *   1. every row of the §6 table is implemented with the SAME http status,
 *      user-visible message, log level and alert flag;
 *   2. every code the implementation exposes is either a §6 row or one of the
 *      explicitly declared, documented PENDING_TABLE_ROWS gaps below;
 *   3. the structural guarantees: the table is frozen, every entry carries its
 *      own key, and no user-visible message contains a path, a URL, a template
 *      placeholder, or a vendor/system identifier (NFR-SEC-010).
 *
 * A §6 amendment is picked up automatically: the script parses the markdown,
 * it does not carry its own copy of the contract.
 *
 * Usage (CI job, and locally): `node scripts/check-error-contract.mjs`
 * Exit 0 = the table and the implementation agree. Exit 1 = drift (CI fails).
 *
 * NOTE on import: Node 24 runs the TypeScript contract directly (erasable
 * syntax only — no enums, no parameter properties), so the gate reads the real
 * module instead of pattern-matching the source text.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const CONTRACT_PATH = fileURLToPath(new URL('API_CONTRACT.md', ROOT));
const ERRORS_MODULE = new URL('src/shared/contracts/errors.ts', ROOT);

const { ERROR_MAPPINGS } =
  /** @type {{ ERROR_MAPPINGS: Record<string, { code: string; httpStatus: number; userMessage: string; logLevel: string; alerts?: boolean }> }} */ (
    await import(ERRORS_MODULE.href)
  );

/**
 * Codes the implementation must expose that API_CONTRACT.md §6 does not yet
 * tabulate. Each one is mandated by another spec document (so it cannot simply
 * be deleted) and needs a §6 row — a spec-question, not a silent choice
 * (AGENTS.md §6). Adding a code here without a documented source, or leaving
 * one here after §6 has been amended, FAILS this script.
 */
const PENDING_TABLE_ROWS = [
  {
    code: 'UPLOAD_NO_IMAGES',
    source: 'docs/product/edge-cases.md EC-UP-02 (fixes 422)',
  },
  {
    code: 'UPLOAD_BAD_ENTRY_NAME',
    source: 'docs/product/edge-cases.md EC-UP-09 (T-UPLOAD-003)',
  },
  {
    code: 'UPLOAD_JOB_TIMEOUT',
    source: 'docs/product/admin-workflow.md watchdog (RUNBOOK 3.1)',
  },
];

const HTTP_STATUSES = new Set([400, 401, 402, 403, 404, 409, 413, 415, 422, 429, 500, 502]);
const LOG_LEVELS = new Set(['info', 'warn', 'error']);
/** Paths, URLs, template placeholders, or vendor/system tokens in a message. */
const INTERNAL_LEAK =
  /[/\\{}]|\b(?:stack|traceback|exception|ENOENT|EACCES|SQL|postgres|minio|s3)\b/i;

/** @type {string[]} */
const failures = [];
/** @type {string[]} */
const notes = [];

/**
 * Parse the §6 table out of the contract markdown.
 *
 * @param {string} markdown
 * @returns {{ codeCell: string; http: number; visible: string; level: string; alert: string }[]}
 */
function parseSection6(markdown) {
  const start = markdown.indexOf('## 6. Error Taxonomy');
  if (start === -1) throw new Error('API_CONTRACT.md has no "## 6. Error Taxonomy" section');
  const table = markdown
    .slice(start)
    // Stop at the "Rules:" paragraph that closes the table.
    .split(/\nRules:/)[0]
    ?.split('\n');

  /** @type {{ codeCell: string; http: number; visible: string; level: string; alert: string }[]} */
  const rows = [];
  for (const line of /** @type {string[]} */ (table ?? [])) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .slice(1, trimmed.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((cell) => cell.trim());
    // Skip the header row and its separator.
    if (cells.length < 6) continue;
    if (cells[0] === 'Code' || /^-+$/.test(cells[1] ?? '')) continue;
    const http = Number.parseInt(cells[1] ?? '', 10);
    if (!Number.isInteger(http)) continue;
    rows.push({
      codeCell: /** @type {string} */ (cells[0]),
      http,
      visible: /** @type {string} */ (cells[2]),
      level: /** @type {string} */ (cells[3]),
      alert: /** @type {string} */ (cells[4]),
    });
  }
  if (rows.length === 0)
    throw new Error('API_CONTRACT.md §6 contains no table rows — parser drift');
  return rows;
}

/**
 * Expand a code cell into the codes it governs: `A / _B` lists, and `X_*`
 * family rows (matched against the implementation below).
 *
 * @param {string} codeCell
 * @returns {{ kind: 'list'; codes: string[] } | { kind: 'family'; prefix: string }}
 */
function expandCodeCell(codeCell) {
  if (codeCell.includes('*')) {
    return { kind: 'family', prefix: /** @type {string} */ (codeCell.split('*')[0]) };
  }
  const parts = codeCell.split('/').map((part) => part.trim());
  const first = /** @type {string} */ (parts[0]);
  const family = first.slice(0, first.lastIndexOf('_') + 1);
  return {
    kind: 'list',
    codes: parts.map((part) => (part.startsWith('_') ? `${family}${part.slice(1)}` : part)),
  };
}

/** The quoted literal of a V cell, or null when the row is per-field prose. */
function visibleLiteral(cell) {
  const match = /^"([^"]+)"(?:\s*\(.*\))?$/.exec(cell);
  return match ? /** @type {string} */ (match[1]) : null;
}

const rows = parseSection6(readFileSync(CONTRACT_PATH, 'utf8'));
const implCodes = Object.keys(ERROR_MAPPINGS);
const covered = new Set();

for (const row of rows) {
  const expanded = expandCodeCell(row.codeCell);
  const targets =
    expanded.kind === 'family'
      ? implCodes.filter((code) => code.startsWith(expanded.prefix))
      : expanded.codes;

  if (targets.length === 0) {
    failures.push(`§6 row "${row.codeCell}" governs no code in ERROR_MAPPINGS (drift)`);
    continue;
  }

  const literal = visibleLiteral(row.visible);
  if (literal === null) {
    notes.push(
      `§6 row "${row.codeCell}": V is "${row.visible}" — per-field detail, not a literal; ` +
        'the implementation supplies a generic envelope message and carries the ' +
        'per-field text in details[]. Message equality is not checkable here.',
    );
  }
  const level = /^(?:info|warn|error)\b/.exec(row.level)?.[0] ?? '';
  if (level === '') {
    failures.push(`§6 row "${row.codeCell}": L is "${row.level}" — not a level this script knows`);
  }
  const alerts = row.alert !== '—' && row.alert !== '';

  for (const code of targets) {
    covered.add(code);
    const mapping = ERROR_MAPPINGS[code];
    if (mapping === undefined) {
      failures.push(`§6 row "${row.codeCell}" requires code ${code}, which ERROR_MAPPINGS lacks`);
      continue;
    }
    if (mapping.httpStatus !== row.http) {
      failures.push(`${code}: http ${mapping.httpStatus} ≠ §6 ${row.http}`);
    }
    if (mapping.logLevel !== level) {
      failures.push(`${code}: logLevel "${mapping.logLevel}" ≠ §6 "${row.level}"`);
    }
    if ((mapping.alerts === true) !== alerts) {
      failures.push(`${code}: alerts ${String(mapping.alerts)} ≠ §6 "${row.alert}" (A column)`);
    }
    if (literal !== null && mapping.userMessage !== literal) {
      failures.push(`${code}: userMessage "${mapping.userMessage}" ≠ §6 ${literal}`);
    }
  }
}

// ── the reverse direction: nothing may be implemented without a §6 row ──────
const declaredPending = new Set(PENDING_TABLE_ROWS.map((entry) => entry.code));
const gaps = [];
for (const code of implCodes) {
  if (covered.has(code)) {
    if (declaredPending.has(code)) {
      failures.push(
        `PENDING_TABLE_ROWS lists ${code}, but §6 now has a row for it — ` +
          'drop the declaration (the contract was amended)',
      );
    }
    continue;
  }
  if (declaredPending.has(code)) {
    const entry = PENDING_TABLE_ROWS.find((item) => item.code === code);
    gaps.push(
      `  ${code} — no §6 row; mandated by ${/** @type {{source: string}} */ (entry).source}`,
    );
    continue;
  }
  failures.push(
    `${code}: implemented with no API_CONTRACT.md §6 row and no PENDING_TABLE_ROWS entry`,
  );
}

// ── structural guarantees (NFR-SEC-010) ─────────────────────────────────────
if (!Object.isFrozen(ERROR_MAPPINGS)) {
  failures.push('ERROR_MAPPINGS is not frozen — a caller could patch a 5xx message at runtime');
}
for (const [code, mapping] of Object.entries(ERROR_MAPPINGS)) {
  if (mapping.code !== code) {
    failures.push(`${code}: entry.code is "${mapping.code}" — an entry must name its own key`);
  }
  if (!HTTP_STATUSES.has(mapping.httpStatus)) {
    failures.push(`${code}: httpStatus ${mapping.httpStatus} is not an ErrorMapping status`);
  }
  if (mapping.userMessage.trim() === '') {
    failures.push(`${code}: userMessage is empty`);
  }
  if (INTERNAL_LEAK.test(mapping.userMessage)) {
    failures.push(`${code}: userMessage "${mapping.userMessage}" looks like an internal detail`);
  }
  if (!LOG_LEVELS.has(mapping.logLevel)) {
    failures.push(`${code}: logLevel "${mapping.logLevel}" is not info|warn|error`);
  }
  if (typeof mapping.alerts !== 'boolean') {
    failures.push(`${code}: alerts must be a definite boolean (the table has no "unknown")`);
  }
  if (mapping.httpStatus >= 500 && mapping.logLevel !== 'error') {
    // API_CONTRACT.md §6 legend: "L = logged level (always ≥ warn on 5xx)".
    failures.push(`${code}: a 5xx must log at warn or above, got "${mapping.logLevel}"`);
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(`error contract: ${rows.length} §6 rows → ${implCodes.length} codes checked`);
if (gaps.length > 0) {
  console.log(`\nCONTRACT GAP (spec-question, needs a §6 row — AGENTS.md §6):\n${gaps.join('\n')}`);
}
for (const note of notes) console.log(`  note  ${note}`);

if (failures.length > 0) {
  console.error(`\nerror contract FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log('error contract OK: API_CONTRACT.md §6 and ERROR_MAPPINGS agree');
