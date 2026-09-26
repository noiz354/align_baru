#!/usr/bin/env node
/**
 * tools/check-docs.mjs — documentation integrity gate (ADR-0037 / AGENTS.md).
 *
 *  1. every markdown path referenced in backticks anywhere in the docs resolves on disk;
 *  2. every ADR linked from ADR.md exists, and docs/adr/ contains no unlisted ADR file;
 *  3. docs/adr/INDEX.md lists the same ADR count as ADR.md;
 *  4. every required root document from README.md exists and is non-empty.
 *
 * Run: node tools/check-docs.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const problems = [];

function md(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      out.push(...md(full));
    } else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

const files = md(ROOT);
const LINK_RE = /`([A-Za-z0-9_./-]+\.md)`|\(([A-Za-z0-9_./-]+\.md)\)/g;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(LINK_RE)) {
    const target = m[1] ?? m[2];
    if (!target || target.startsWith("http")) continue;
    const fromRoot = join(ROOT, target);
    const fromFile = join(file, "..", target);
    const base = target.split("/").pop();
    const uniqueBasename = files.some((f) => f.endsWith("/" + base)) &&
      files.filter((f) => f.endsWith("/" + base)).length === 1;
    if (!existsSync(fromRoot) && !existsSync(fromFile) && !uniqueBasename) {
      problems.push(`${relative(ROOT, file)}: dangling reference -> ${target}`);
    }
  }
}

const adrIndex = readFileSync(join(ROOT, "ADR.md"), "utf8");
const listed = [...adrIndex.matchAll(/ADR-(\d{4})-[a-z0-9-]+\.md/g)].map((m) => m[1]);
const onDisk = readdirSync(join(ROOT, "docs/adr"))
  .filter((f) => /^ADR-\d{4}-/.test(f))
  .map((f) => f.slice(4, 8));

for (const num of listed) if (!onDisk.includes(num)) problems.push(`ADR.md links ADR-${num} but the file is missing`);
for (const num of onDisk) if (!listed.includes(num)) problems.push(`docs/adr/ADR-${num} exists but is not listed in ADR.md`);

const nested = readFileSync(join(ROOT, "docs/adr/INDEX.md"), "utf8");
const nestedCount = (nested.match(/^\| \[\d{4}\]/gm) ?? []).length;
if (nestedCount !== onDisk.length) {
  problems.push(`docs/adr/INDEX.md lists ${nestedCount} records but ${onDisk.length} exist`);
}

const REQUIRED = readFileSync(join(ROOT, "README.md"), "utf8")
  .match(/^([A-Z][A-Z0-9-]+\.md)$/gm)
  ?.map((l) => l.trim()) ?? [];
for (const name of REQUIRED) {
  const p = join(ROOT, name);
  if (!existsSync(p)) problems.push(`README lists ${name} but it does not exist`);
  else if (statSync(p).size < 200) problems.push(`${name} looks empty (${statSync(p).size} bytes)`);
}

if (problems.length) {
  console.error("check-docs: FAILED");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`check-docs: OK (${files.length} markdown files, ${onDisk.length} ADRs)`);
