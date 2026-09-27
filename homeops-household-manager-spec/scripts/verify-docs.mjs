#!/usr/bin/env node
// HomeOps — documentation & traceability gate (T-PLAT-008).
//
// The cases this gate must cover are fixed by TASKS.md T-PLAT-008:
//   1. a requirement missing from TRACEABILITY.md;
//   2. an unknown task id cited by code;
//   3. a missing ADR file;
//   4. a skeleton/module path that does not exist;
//   5. a fake implementation (`return []` / `return true` in a service);
//   6. a stray TODO without a task id.
// Plus the dependency rule from AGENTS.md §9 (every added dependency is validated in STACK-2026.md
// and recorded in DECISIONS.md). It reports every problem it finds, then exits non-zero.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const problems = [];
const fail = (message) => problems.push(message);

function read(path) {
  const absolute = join(ROOT, path);
  if (!existsSync(absolute)) {
    fail(`missing document: ${path}`);
    return null;
  }
  return readFileSync(absolute, 'utf8');
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.turbo') continue;
    const absolute = join(dir, entry);
    if (statSync(absolute).isDirectory()) walk(absolute, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(absolute);
  }
  return out;
}

const SOURCE_FILES = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'tests')),
  ...walk(join(ROOT, 'scripts')),
];
const rel = (absolute) => relative(ROOT, absolute);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const tasksDoc = read('TASKS.md') ?? '';
const KNOWN_TASKS = new Set(tasksDoc.match(/T-[A-Z]{2,6}-\d{3}/g) ?? []);
const TASK_ID = /T-[A-Z]{2,6}-\d{3}/;

/* ------------------------------------------- 1. PRD requirements ↔ TRACEABILITY.md coverage */

const prd = read('PRD.md');
const traceability = read('docs/TRACEABILITY.md');
const REQUIREMENT_ID = /\b(?:NFR|FR|I)-[A-Z]{2,6}-\d{3}\b/g;

if (prd && traceability) {
  const specified = new Set(prd.match(REQUIREMENT_ID) ?? []);
  const traced = new Set(traceability.match(REQUIREMENT_ID) ?? []);
  for (const id of specified) {
    if (!traced.has(id)) fail(`TRACEABILITY.md has no row for requirement ${id} (PRD.md)`);
  }
  // A row whose Task cell reads NONE is a planning defect the generator prints loudly.
  for (const row of traceability.split('\n')) {
    if (!row.startsWith('|')) continue;
    const cells = row.split('|').map((cell) => cell.trim());
    if (cells.some((cell) => cell === 'NONE')) {
      fail(`TRACEABILITY.md row has a NONE cell (unmapped requirement): ${cells[1] ?? row.slice(0, 60)}`);
    }
  }
}

/* ------------------------------------------------------- 2. task ids cited by code must exist */

for (const file of SOURCE_FILES) {
  if (rel(file) === 'scripts/verify-docs.mjs') continue; // this gate's own patterns are not citations
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/T-[A-Z]{2,6}-\d{3}/g)) {
    if (KNOWN_TASKS.size > 0 && !KNOWN_TASKS.has(match[0])) {
      fail(`${rel(file)}:${lineOf(text, match.index)}: cites unknown task id ${match[0]}`);
    }
  }
}

/* ------------------------------------------------------------- 3. cited ADRs must have a file */

const adrDir = join(ROOT, 'docs/adr');
const adrFiles = existsSync(adrDir) ? readdirSync(adrDir) : [];
// ADR.md registers decisions that are *proposed* (a trigger, not a file yet): ADR-017 photo storage,
// ADR-018 queue adoption, ADR-019 email provider. Citing those is correct; citing an unregistered
// id is not. `ADR-000` is the generator's own placeholder.
const adrIndex = read('ADR.md') ?? '';
const proposedAdrs = new Set((adrIndex.match(/ADR-\d{3}\s*\(proposed\)/g) ?? []).map((m) => m.slice(0, 7)));
proposedAdrs.add('ADR-000');
const citedAdrs = new Map();

for (const file of [
  ...SOURCE_FILES,
  join(ROOT, 'docs/architecture/MODULE-MAP.md'),
  join(ROOT, 'ROADMAP.md'),
]) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bADR-(\d{3})\b/g)) {
    if (!citedAdrs.has(match[0])) citedAdrs.set(match[0], `${rel(file)}:${lineOf(text, match.index)}`);
  }
}
for (const [id, where] of citedAdrs) {
  if (proposedAdrs.has(id)) continue;
  if (!adrFiles.some((name) => name.startsWith(`${id}-`))) {
    fail(`${where}: cites ${id} but docs/adr/${id}-*.md does not exist`);
  }
}

/* --------------------------------------------- 4. module/skeleton paths must exist on disk */

const moduleMap = read('docs/architecture/MODULE-MAP.md');
if (moduleMap) {
  for (const match of moduleMap.matchAll(/`(src\/[A-Za-z0-9_@./[\]()-]+)`/g)) {
    const path = match[1];
    if (/\.(md|json)$/.test(path)) continue;
    const absolute = join(ROOT, path);
    // A directory entry is normative for a layer; a file entry is normative for a module.
    if (!existsSync(absolute)) {
      fail(`MODULE-MAP.md:${lineOf(moduleMap, match.index)}: references ${path}, which does not exist`);
    }
  }
}

/* --------------------------------------- 5. fake implementations in domain/features/server */

// A service that "works" by returning an empty collection or a constant is the failure mode the
// audit rule targets. Registered skeletons are exempt: they throw `Not implemented: <TASK>` or
// carry the owning task id on the placeholder line, so a reader can see the work is pending.
const TRIVIAL_RETURN = /^\s*return\s*(\[\]|\{\}|true|false|null|undefined)\s*;\s*(\/\/.*)?$/;

for (const file of SOURCE_FILES) {
  const path = rel(file);
  if (!path.startsWith('src/domain/') && !path.startsWith('src/features/') && !path.startsWith('src/server/'))
    continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const match = TRIVIAL_RETURN.exec(line);
    if (!match) return;
    const comment = match[2] ?? '';
    if (TASK_ID.test(comment)) return; // registered skeleton placeholder
    // Only suspicious when it is the whole body of an async function: sync predicates legitimately
    // return a constant (e.g. a feature flag), and an async body with one trivial return pretends
    // to have performed work.
    const header = lines
      .slice(Math.max(0, index - 12), index)
      .reverse()
      .find((l) => /function\s+\w+|\w+\s*\(|=>/.test(l) && /async/.test(l));
    if (!header) return;
    const previous = lines[index - 1]?.trim() ?? '';
    const opensBody = /\{\s*$/.test(previous) || /\{\s*$/.test(header);
    if (!opensBody) return;
    fail(
      `${path}:${index + 1}: fake implementation — async body is only \`${line.trim()}\` (implement it or throw \`Not implemented: <TASK>\`)`,
    );
  });
}

/* ------------------------------------------------------- 6. stray TODO/FIXME without a task id */

for (const file of SOURCE_FILES) {
  if (rel(file) === 'scripts/verify-docs.mjs') continue;
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, index) => {
    if (!/\b(TODO|FIXME|HACK)\b/.test(line)) return;
    if (TASK_ID.test(line)) return;
    fail(`${rel(file)}:${index + 1}: stray marker without a task id — ${line.trim().slice(0, 80)}`);
  });
}

/**
 * STACK-2026.md names *candidates* ("Drizzle ORM", "Playwright"), while package.json names
 * *packages* (`drizzle-kit`, `@playwright/test`). A dependency counts as validated when either the
 * package name or the candidate it implements appears in the research doc.
 */
const STACK_ALIASES = {
  'better-auth': ['Better Auth'],
  'drizzle-orm': ['Drizzle ORM', 'Drizzle'],
  'drizzle-kit': ['Drizzle'],
  postgres: ['postgres.js'],
  zod: ['Zod'],
  vitest: ['Vitest'],
  '@vitest/browser': ['Vitest'],
  '@playwright/test': ['Playwright'],
  '@axe-core/playwright': ['axe-core'],
  '@axe-core/cli': ['axe-core'],
  tailwindcss: ['Tailwind CSS', 'Tailwind'],
  '@tailwindcss/postcss': ['Tailwind CSS', 'Tailwind'],
  eslint: ['ESLint'],
  'typescript-eslint': ['ESLint'],
  '@eslint/js': ['ESLint'],
  prettier: ['Prettier'],
  '@testing-library/react': ['testing-library'],
  '@testing-library/dom': ['testing-library'],
  '@testing-library/jest-dom': ['jest-dom'],
  '@testing-library/user-event': ['testing-library'],
};

function stackMentions(stackDoc, name) {
  if (stackDoc.includes(name)) return true;
  return (STACK_ALIASES[name] ?? []).some((alias) => stackDoc.toLowerCase().includes(alias.toLowerCase()));
}

/* ------------------------------------------- 7. dependency governance (AGENTS.md §9) */

const pkgText = read('package.json');
const stack = read('docs/research/STACK-2026.md');
const decisions = read('DECISIONS.md');

if (pkgText && stack && decisions) {
  const pkg = JSON.parse(pkgText);
  const dependencies = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  // Toolchain that STACK-2026.md §0 treats as the framework baseline (Next/React/TS) is named in
  // prose rather than as a package row, so it is exempt from the row check.
  const BASELINE = new Set(['next', 'react', 'react-dom', 'typescript', 'tsx']);
  for (const name of dependencies) {
    if (name.startsWith('@types/') || BASELINE.has(name)) continue;
    if (!stackMentions(stack, name)) {
      fail(`dependency "${name}" is not validated in docs/research/STACK-2026.md (AGENTS.md §9)`);
    }
    if (!decisions.includes(name)) {
      fail(`dependency "${name}" has no DECISIONS.md entry (AGENTS.md §9 requires one per addition)`);
    }
  }
  // A DECISIONS entry that adds or upgrades a package must correspond to something installed.
  for (const match of decisions.matchAll(
    /\b(?:Add|Added|Upgrade|Upgraded|Downgrade|Pin|Pinned)\s+`([@a-z0-9][\w./-]*)`/gi,
  )) {
    const name = match[1];
    if (!dependencies.includes(name)) {
      fail(
        `DECISIONS.md:${lineOf(decisions, match.index)}: records "${name}" but package.json does not list it`,
      );
    }
  }
  // DECISIONS.md's own format rule: every entry states a reversal cost and a relation.
  for (const block of decisions.split(/^### /m).slice(1)) {
    const title = block.split('\n')[0].trim();
    if (!/\*\*Reversal cost:\*\*/.test(block)) fail(`DECISIONS.md entry "${title}" has no reversal cost`);
    if (!/\*\*Related:\*\*/.test(block)) fail(`DECISIONS.md entry "${title}" has no Related field`);
  }
}

/* ------------------------------------------- 8. npm scripts must point at files that exist */

if (pkgText) {
  const pkg = JSON.parse(pkgText);
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    for (const match of String(command).matchAll(/(?:^|[\s&|;])([\w.@/-]+\.(?:mjs|ts|sh|js))\b/g)) {
      const target = match[1];
      if (!existsSync(join(ROOT, target))) {
        fail(`package.json script "${name}" references ${target}, which does not exist`);
      }
    }
  }
}

/* ---------------------------------------------------------------------------- report + exit */

if (problems.length > 0) {
  console.error(`verify-docs: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  'verify-docs: requirements, task ids, ADRs, module paths, implementations and dependencies are consistent.',
);
