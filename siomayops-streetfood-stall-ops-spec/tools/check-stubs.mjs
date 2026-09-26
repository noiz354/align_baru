#!/usr/bin/env node
/**
 * tools/check-stubs.mjs — Phase 0 gate (AGENTS.md, ADR-0036).
 *
 * Checks that the Phase 0 skeleton stays honest:
 *  1. every `Not implemented: T-XXX-XXX` names a real task in TASKS.md (or a documented alias);
 *  2. no source file under src/ imports a PLANNED/REJECTED dependency from STACK-2026.md;
 *  3. no source file under src/ uses background geolocation APIs (ADR-0007 / INV-07);
 *  4. every exported function under src/ either throws NotImplemented or is a pure constructor
 *     listed in PURE_ALLOWED below;
 *  5. every file under src/ carries a PHASE 0 marker.
 *
 * Run: node tools/check-stubs.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const TASKS = readFileSync(join(ROOT, "TASKS.md"), "utf8");
const TASK_IDS = new Set(TASKS.match(/T-[A-Z]+-\d{3}/g) ?? []);
/** Documented alias from the product brief: T-SHIFT-031 is the mandated example stub id used by
 *  prepareShiftClosing; the canonical task is T-CLOSE-001. */
const ALLOWED_ALIASES = new Set(["T-SHIFT-031"]);
/** Pure constructors/constants that legitimately contain no `throw` in Phase 0. */
const PURE_ALLOWED = ["money", "fixedClock", "ok", "err"];

const FORBIDDEN_IMPORTS = [
  "better-auth", "@aws-sdk/client-s3", "pg-boss", "serwist", "@serwist/next",
  "@tanstack/react-query", "drizzle-orm", "pg", "ioredis", "bullmq", "kafkajs", "graphql",
  "@prisma/client", "socket.io", "@sentry/node"
];
const FORBIDDEN_PATTERNS = [
  { name: "background geolocation", re: /navigator\.geolocation|watchPosition/g },
  { name: "continuous tracking loop", re: /setInterval\([^)]*position/gi }
];

const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if ([".ts", ".tsx", ".mjs"].includes(extname(full))) check(full);
  }
}

function check(file) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");

  if (!src.includes("PHASE 0")) problems.push(`${rel}: missing "PHASE 0" marker`);

  for (const m of src.matchAll(/Not implemented: (T-[A-Z]+-\d{3})/g)) {
    if (!TASK_IDS.has(m[1]) && !ALLOWED_ALIASES.has(m[1])) {
      problems.push(`${rel}: unknown task id in stub -> ${m[1]}`);
    }
  }

  for (const dep of FORBIDDEN_IMPORTS) {
    if (new RegExp(`from\\s+["']${dep.replace(/[/@]/g, "\\$&")}`).test(src)) {
      problems.push(`${rel}: imports ${dep}, which is PLANNED/REJECTED for Phase 0`);
    }
  }

  for (const { name, re } of FORBIDDEN_PATTERNS) {
    if (re.test(src)) problems.push(`${rel}: uses ${name}, forbidden by ADR-0007 / INV-07`);
  }

  const fnRe = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
  for (const m of src.matchAll(fnRe)) {
    const name = m[1];
    if (PURE_ALLOWED.includes(name)) continue;
    const from = m.index ?? 0;
    const tail = src.slice(from, from + 1500);
    if (!tail.includes("Not implemented:")) {
      problems.push(`${rel}: exported function ${name}() contains logic without a NotImplemented stub`);
    }
  }

}

walk(join(ROOT, "src"));

if (problems.length) {
  console.error("check-stubs: FAILED");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`check-stubs: OK (${TASK_IDS.size} known task ids, 0 violations)`);
