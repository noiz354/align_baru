#!/usr/bin/env node
/**
 * VS-0 exit gate (T-DOCS-003).
 *
 * Verifies the seven VS-0 exit criteria from `ROADMAP.md` mechanically, so the "the repository is a
 * truthful specification" claim cannot silently rot. Read-only: it never rewrites a document or a
 * source file. A finding is fixed in the offending document or module, never by widening a list here.
 *
 * Usage:  node ops/verify-vs0.mjs            (human-readable table, exit 1 on any FAIL)
 *         node ops/verify-vs0.mjs --json     (machine-readable, for CI annotations)
 *
 * Criteria (ROADMAP.md §VS-0 · Exit criteria), and how each is checked:
 *   1  every P0/P1 requirement ID defined in PRD.md appears in docs/TRACEABILITY.md
 *   2  `npm run typecheck` (tsc --noEmit) exits 0
 *   3  every `Not implemented: <id>` names a task that exists in TASKS.md, and src/** contains no
 *      constant-success return (the "never fake an implementation" rule, AGENTS.md §4.1)
 *   4  tests/** contain placeholders only: zero executable assertions (`expect(`)
 *   5  docs/architecture/FINAL-REVIEW.md answers every `### 2.x` challenge with a body that cites a
 *      concrete mechanism (a document, ADR, task or module)
 *   6  every declared dependency is classified in docs/research/STACK-2026.md (AGENTS.md §3); the
 *      Phase 0 rule "no provider SDK, ORM, auth library or test runner" is reported separately,
 *      because it is deliberately superseded for product dependencies once the freeze is lifted
 *   7  the reviewer reading list is printed - this one is attested by a human, not by a script
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const REQ_ID = /\b(?:N?FR-[A-Z0-9]+-\d{3})\b/g;
const TASK_ID = /\bT-[A-Z]+-\d{3}\b/g;

/** Product/runtime dependencies that must not be declared while the Phase 0 freeze is in force. */
const PHASE0_PRODUCT_DEPENDENCIES = [
  "next",
  "react",
  "react-dom",
  "better-auth",
  "drizzle-orm",
  "drizzle-kit",
  "pg",
  "postgres",
  "zod",
  "bullmq",
  "ioredis",
];

const results = [];
const record = (criterion, status, detail) => results.push({ criterion, status, detail });

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function walk(dir, filter = () => true, acc = []) {
  const abs = join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, filter, acc);
    else if (filter(entry.name)) acc.push(rel);
  }
  void statSync;
  return acc;
}

const unique = (arr) => [...new Set(arr)];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ── 1 · every P0/P1 requirement appears in docs/TRACEABILITY.md ────────────────────────────────────
{
  const prd = read("PRD.md");
  const traceability = read("docs/TRACEABILITY.md");
  const rows = [...prd.matchAll(/^\|\s*(N?FR-[A-Z0-9]+-\d{3})\s*\|\s*(P\d)\s*\|/gm)];
  const wanted = unique(rows.filter((r) => r[2] === "P0" || r[2] === "P1").map((r) => r[1])).sort();
  const present = new Set([...traceability.matchAll(REQ_ID)].map((m) => m[0]));
  const missing = wanted.filter((id) => !present.has(id));
  record(
    1,
    missing.length === 0 ? "PASS" : "FAIL",
    missing.length === 0
      ? `${plural(wanted.length, "P0/P1 requirement")} traced (of ${plural(unique([...prd.matchAll(REQ_ID)].map((m) => m[0])).length, "requirement")} in PRD.md)`
      : `missing from docs/TRACEABILITY.md: ${missing.join(", ")}`,
  );
}

// ── 2 · `npm run typecheck` passes on the skeleton ────────────────────────────────────────────────
{
  const tsc = spawnSync("npx", ["tsc", "--noEmit"], { cwd: ROOT, encoding: "utf8" });
  const output = `${tsc.stdout ?? ""}${tsc.stderr ?? ""}`.trim();
  const errors = output.split("\n").filter((line) => line.includes("error TS"));
  record(
    2,
    tsc.status === 0 ? "PASS" : "FAIL",
    tsc.status === 0 ? "tsc --noEmit: 0 errors" : `${plural(errors.length, "type error")}\n${errors.slice(0, 10).join("\n")}`,
  );
}

// ── 3 · every unimplemented function names a real task; no fake success returns ────────────────────
{
  const tasks = new Set([...read("TASKS.md").matchAll(TASK_ID)].map((m) => m[0]));
  const sourceFiles = walk("src", (name) => /\.(ts|tsx)$/.test(name));
  const stubIds = new Set();
  const unknownIds = new Set();
  const fakeReturns = [];
  // "claims an effect happened": a return of an object literal that is NOTHING BUT constants and carries
  // a success-ish flag. Every value must be a literal - `return { ok: true, entries: rows.length }` is a
  // real result that happens to report success, not a fabricated one, and flagging it trains people to
  // ignore this gate. This is the same semantics as the `majelishub/no-fake-implementation` rule
  // (`constant-success`), so the two gates cannot disagree about what a fake looks like.
  const FAKE_RETURN = /return\s*\{([^{}]*)\}\s*;/;
  const SUCCESS_FLAG = /\b(?:success|ok)\s*:\s*true\b/;
  const LITERAL_VALUE = /^(?:true|false|null|[-+]?\d+(?:\.\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/;
  const isConstantSuccessReturn = (line) => {
    const match = FAKE_RETURN.exec(line);
    if (!match || !SUCCESS_FLAG.test(match[1])) return false;
    return match[1].split(",").every((part) => {
      const property = part.trim();
      if (property === "") return true;
      const colon = property.indexOf(":");
      // A shorthand property (`ok,`) or a computed value means the object carries real state.
      if (colon === -1) return false;
      return LITERAL_VALUE.test(property.slice(colon + 1).trim());
    });
  };

  for (const file of sourceFiles) {
    const text = read(file);
    for (const m of text.matchAll(/Not implemented:\s*(T-[A-Z]+-\d{3})/g)) {
      stubIds.add(m[1]);
      if (!tasks.has(m[1])) unknownIds.add(`${m[1]} (${file})`);
    }
    text.split("\n").forEach((line, index) => {
      if (isConstantSuccessReturn(line)) fakeReturns.push(`${file}:${index + 1}`);
    });
  }

  const ok = unknownIds.size === 0 && fakeReturns.length === 0;
  record(
    3,
    ok ? "PASS" : "FAIL",
    ok
      ? `${plural(stubIds.size, "stub")} across ${plural(sourceFiles.length, "source file")}, all naming a task defined in TASKS.md; 0 constant-success returns`
      : [
          unknownIds.size > 0 ? `unknown task id: ${[...unknownIds].join(", ")}` : "",
          fakeReturns.length > 0 ? `constant-success return: ${fakeReturns.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
  );
}

// ── 4 · test files are placeholders unless their owning task is delivered ─────────────────────────
{
  const taskSections = read("TASKS.md").split(/^### (?=T-[A-Z]+-\d{3})/m);
  const delivered = new Set(
    taskSections
      .filter((section) => /\*\*Delivered:\*\*/.test(section))
      .map((section) => /^(T-[A-Z]+-\d{3})/.exec(section)?.[1])
      .filter(Boolean),
  );

  const testFiles = walk("tests", (name) => /\.(test|spec)\.ts$/.test(name));
  const orphaned = [];
  const tested = new Set();
  let vitestPlaceholders = 0;
  let playwrightPlaceholders = 0;
  let placeholdersOnly = 0;

  for (const file of testFiles) {
    const text = read(file);
    const hasAssertions = /(^|[^.\w])expect\s*\(/.test(text);
    vitestPlaceholders += (text.match(/\b(?:describe|test|it)\.todo\(/g) ?? []).length;
    playwrightPlaceholders += (text.match(/\btest\.fixme\(/g) ?? []).length;
    if (!hasAssertions) {
      placeholdersOnly += 1;
      continue;
    }
    // Every test file names the task it belongs to in its header (AGENTS.md §5). A file with real
    // assertions is only legitimate once that task is recorded as delivered — otherwise a spec that
    // claims "nothing is implemented" would be carrying tests that prove otherwise, or worse, tests
    // nobody owns.
    const owner = /Owning task:\s*(T-[A-Z]+-\d{3})/.exec(text)?.[1];
    if (owner && delivered.has(owner)) tested.add(`${owner} (${file})`);
    else orphaned.push(`${file}${owner ? ` (${owner} is not marked delivered)` : " (no owning task)"}`);
  }

  // The nine Playwright file headers document the placeholder form; they are comments, not tests.
  const documented = 9;
  const ok = orphaned.length === 0;
  record(
    4,
    ok ? "PASS" : "FAIL",
    ok
      ? `${placeholdersOnly} files still placeholders (${vitestPlaceholders} Vitest + ${playwrightPlaceholders - documented} Playwright); ${plural(tested.size, "file")} with real assertions, each naming a delivered task`
      : `tests without a delivered owning task: ${orphaned.join(", ")}`,
  );
}

// ── 5 · FINAL-REVIEW answers every challenge with a concrete mechanism ────────────────────────────
{
  const review = read("docs/architecture/FINAL-REVIEW.md");
  const sections = [...review.matchAll(/^###\s+(\d+\.\d+)\s+"([^"]+)"/gm)];
  // A concrete mechanism = it points at something a reader can open: a document, an ADR, a task,
  // a QA scenario, or a path in the repository.
  const mechanism = /(?:[\w./@-]+\.md|ADR-\d{4}|T-[A-Z]+-\d{3}|QA-\d{2}|src\/|tests\/|ops\/)/;
  const weak = [];
  for (const [index, section] of sections.entries()) {
    const start = section.index + section[0].length;
    const end = sections[index + 1]?.index ?? review.length;
    const body = review.slice(start, end);
    if (body.trim().length < 200 || !mechanism.test(body)) weak.push(section[1]);
  }
  record(
    5,
    sections.length > 0 && weak.length === 0 ? "PASS" : "FAIL",
    sections.length > 0 && weak.length === 0
      ? `${plural(sections.length, "challenge")} answered, each citing a document, ADR, task or module`
      : `challenges without a cited mechanism: ${weak.join(", ")}`,
  );
}

// ── 6 · dependency discipline ─────────────────────────────────────────────────────────────────────
{
  const pkg = JSON.parse(read("package.json"));
  const declared = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].sort();
  const stack = read("docs/research/STACK-2026.md");
  const unclassified = declared.filter((name) => !stack.includes(name));
  const product = declared.filter((name) => PHASE0_PRODUCT_DEPENDENCIES.includes(name));
  const status = unclassified.length > 0 ? "FAIL" : product.length > 0 ? "WARN" : "PASS";
  const detail =
    unclassified.length > 0
      ? `unclassified in docs/research/STACK-2026.md: ${unclassified.join(", ")}`
      : product.length > 0
        ? `${declared.length} dependenc${declared.length === 1 ? "y" : "ies"} declared, all classified; product dependencies present (${product.join(", ")}) - VS-0 criterion 6 is superseded once the freeze is lifted for VS-1 (ROADMAP.md §Phase 0 state)`
        : `${declared.length} dependenc${declared.length === 1 ? "y" : "ies"} declared, all classified; no provider SDK, ORM, auth library or framework`;
  record(6, status, detail);
}

// ── 7 · reviewer comprehension (human attestation) ────────────────────────────────────────────────
{
  const list = ["README.md", "ARCHITECTURE.md", "docs/adr/ADR-0006-opaque-checkin-tokens.md", "docs/adr/ADR-0012-mandatory-human-review.md"];
  const missing = list.filter((file) => {
    try {
      return read(file).trim().length === 0;
    } catch {
      return true;
    }
  });
  record(
    7,
    missing.length === 0 ? "ATTEST" : "FAIL",
    missing.length === 0
      ? `reading list present (${list.join(", ")}) - a human confirms the check-in path and the transcript gate`
      : `missing reading-list document: ${missing.join(", ")}`,
  );
}

// ── report ────────────────────────────────────────────────────────────────────────────────────────
/**
 * `console.*` is banned across `src/`, `tests/` and `ops/` (OBSERVABILITY.md §5, T-OBS-002), so this
 * report goes to stdout directly like `ops/docs-lint.mjs` does.
 */
const out = (text) => process.stdout.write(`${text}\n`);

const failed = results.filter((r) => r.status === "FAIL");
const warned = results.filter((r) => r.status === "WARN");

if (process.argv.includes("--json")) {
  out(JSON.stringify({ criteria: results, failed: failed.length, warned: warned.length }, null, 2));
} else {
  out("\nVS-0 exit gate (T-DOCS-003) — ROADMAP.md §VS-0\n");
  for (const { criterion, status, detail } of results) {
    out(`  ${status.padEnd(6)} ${criterion}. ${detail.split("\n")[0]}`);
  }
  out(
    `\n  ${results.length - failed.length - warned.length} pass · ${warned.length} warn · ${failed.length} fail\n`,
  );
  for (const { criterion, detail } of failed) out(`  FAIL ${criterion}: ${detail}\n`);
  out(
    "  Criterion 7 cannot be proven by a script: it is satisfied when a reviewer who has never seen\n" +
      "  the project can explain the check-in path and the transcript gate from the reading list.\n",
  );
}

process.exit(failed.length > 0 ? 1 : 0);
