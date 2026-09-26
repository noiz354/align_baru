#!/usr/bin/env node
/**
 * tools/census.mjs — traceability census (docs/TRACEABILITY.md).
 * Counts stable IDs and verifies that every requirement ID cited outside PRD.md exists in PRD.md.
 * Run: node tools/census.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const prd = readFileSync(join(ROOT, "PRD.md"), "utf8");
const rows = [...prd.matchAll(/^\| ((?:FR|NFR)-[A-Z]+-\d{3})/gm)].map((m) => m[1]);
const fr = rows.filter((i) => i.startsWith("FR-"));
const nfr = rows.filter((i) => i.startsWith("NFR-"));
const have = new Set(rows);

const tasks = readFileSync(join(ROOT, "TASKS.md"), "utf8").match(/^## (T-[A-Z]+-\d{3})/gm) ?? [];
const adrs = readdirSync(join(ROOT, "docs/adr")).filter((f) => /^ADR-\d{4}-/.test(f)).length;

let stubs = 0;
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) {
      stubs += (readFileSync(full, "utf8").match(/Not implemented: T-[A-Z]+-\d{3}/g) ?? []).length;
    }
  }
}
walk(join(ROOT, "src"));

const missing = [];
for (const file of [...walkMd(ROOT)]) {
  if (file.endsWith("PRD.md")) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?:FR|NFR)-[A-Z]+-\d{3}/g)) {
    if (!have.has(m[0])) missing.push(`${relative(ROOT, file)} -> ${m[0]}`);
  }
}
function* walkMd(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      yield* walkMd(full);
    } else if (entry.endsWith(".md")) yield full;
  }
}

console.log("SiomayOps Phase 0 census");
console.log("  functional requirements :", fr.length);
console.log("  non-functional reqs     :", nfr.length);
console.log("  total stable requirement ids:", rows.length, "(unique:", have.size + ")");
console.log("  tasks (T-*):", tasks.length);
console.log("  ADR records:", adrs);
console.log("  NotImplemented stubs in src/:", stubs);

// P0 coverage: requirements whose priority is P0 must appear in at least one task Requirements line.
// Task lines may use ranges (FR-X-001..004), so ranges are expanded before matching.
const tasksMd = readFileSync(join(ROOT, "TASKS.md"), "utf8");
const expand = (text) => {
  const ids = new Set();
  for (const m of text.matchAll(/((?:FR|NFR)-[A-Z]+-)(\d{3})\.\.(\d{3})/g)) {
    for (let n = Number(m[2]); n <= Number(m[3]); n += 1) ids.add(`${m[1]}${String(n).padStart(3, "0")}`);
  }
  const withoutRanges = text.replace(/((?:FR|NFR)-[A-Z]+-)\d{3}\.\.\d{3}/g, " ");
  for (const m of withoutRanges.matchAll(/(?:FR|NFR)-[A-Z]+-\d{3}/g)) ids.add(m[0]);
  return ids;
};
const inTasks = new Set();
for (const line of tasksMd.split("\n")) {
  if (line.startsWith("- **Requirements:**")) {
    for (const id of expand(line)) inTasks.add(id);
  }
}
const prdRows = [...prd.matchAll(/^\| ((?:FR|NFR)-[A-Z]+-\d{3}) \| (.*)$/gm)];
const p0 = prdRows.filter(([, , row]) => /\|\s*P0\s*\|/.test(row)).map(([, id]) => id);
const uncovered = p0.filter((id) => !inTasks.has(id));
console.log(`  P0 requirements: ${p0.length}, task-covered: ${p0.length - uncovered.length}`);
if (uncovered.length) {
  console.error("census: FAILED — P0 requirements with no task coverage:", uncovered.join(", "));
  process.exit(1);
}

if (missing.length) {
  console.error("census: FAILED — requirement ids cited but absent from PRD.md:");
  for (const m of missing.slice(0, 40)) console.error("  - " + m);
  process.exit(1);
}
console.log("census: OK — every cited requirement id exists in PRD.md");
