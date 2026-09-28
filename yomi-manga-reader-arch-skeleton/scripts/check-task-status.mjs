#!/usr/bin/env node
/**
 * check-task-status — derive each task's build state from evidence in the tree.
 *
 * Why this exists
 * ---------------
 * TASKS.md has 137 tasks and no status column, so "which of these are actually built" was
 * answerable only by grepping the source for TODO comments. That is the wrong place to look:
 * the source is where the work is described, not where it is accounted for, and the two drift.
 *
 * This reads the task list and reports what the tree says about each one. It does not decide
 * whether a task is *done* — a human signs that off, against the DoD in AGENTS.md §5. What it
 * does is separate the three states that look identical in a grep:
 *
 *   BLOCKED  the code for this task exists and says so: `throw new Error("Not implemented:
 *            T-…")`. The task is written down, and its own file says the wiring is missing.
 *   STUB     no throw, but TODOs naming this task remain. The shape is there; the behaviour
 *            is not.
 *   WIRED    the id appears in the tree with no TODO and no throw. This means the task's
 *            subject is present — it is evidence to review, not a completion claim.
 *
 * Anything it cannot classify is reported as UNCLEAR rather than quietly bucketed, because a
 * status report that invents an "unknown" bucket into "wired" is worse than no report.
 *
 * Usage
 * -----
 *   node scripts/check-task-status.mjs              # table, grouped by state
 *   node scripts/check-task-status.mjs --json       # machine-readable
 *   node scripts/check-task-status.mjs --blocked    # only the blocked ones
 *   node scripts/check-task-status.mjs --strict     # exit 1 if any task is BLOCKED
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const TASKS_MD = join(REPO_ROOT, 'TASKS.md');

const SKIP_DIRECTORIES = new Set([
  'node_modules', '.next', 'dist', 'build', 'coverage', '.git',
  '__pycache__', '.turbo', 'playwright-report', 'test-results',
]);

const args = new Set(process.argv.slice(2));

/** This file quotes the patterns it searches for, so it must not match itself. */
const SELF = 'scripts/check-task-status.mjs';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else {
      const file = join(dir, entry.name);
      try {
        if (statSync(file).isFile()) out.push(file);
      } catch {
        /* raced away */
      }
    }
  }
  return out;
}

function main() {
  const tasksSource = readFileSync(TASKS_MD, 'utf8');
  const taskIds = [...tasksSource.matchAll(/^## (T-[A-Z0-9]+-\d+)/gm)].map((m) => m[1]);

  // One pass over the tree, bucketing every task id the files mention.
  const throwsFor = new Map();   // id -> [files]
  const todosFor = new Map();    // id -> [files]
  const mentions = new Map();    // id -> [files]
  const allFiles = walk(REPO_ROOT);

  for (const file of allFiles) {
    const rel = relative(REPO_ROOT, file);
    if (rel === 'TASKS.md' || rel === SELF) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!text.includes('T-')) continue;

    // Only a real `throw new Error('… Not implemented: T-…')` counts. A bare literal match
    // also fires on prose that merely quotes one — a page comment saying "T-SEARCH-001 is not
    // implemented" is documentation, not a code site, and treating it as one reports a task as
    // blocked because someone described it accurately.
    for (const m of text.matchAll(
      /throw\s+new\s+Error\(\s*['"`][^'"`]*Not implemented:\s*(T-[A-Z0-9]+-\d+)/g,
    )) {
      add(throwsFor, m[1], rel);
    }
    for (const m of text.matchAll(/TODO\(\s*(T-[A-Z0-9]+-\d+)/g)) {
      add(todosFor, m[1], rel);
    }
    for (const m of text.matchAll(/\b(T-[A-Z0-9]+-\d+)\b/g)) {
      add(mentions, m[1], rel);
    }
  }

  function add(map, key, value) {
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.includes(value)) list.push(value);
  }

  const report = taskIds.map((id) => {
    const thrown = throwsFor.get(id) ?? [];
    const todo = todosFor.get(id) ?? [];
    const mentioned = (mentions.get(id) ?? []).filter(
      (f) => !thrown.includes(f) && !todo.includes(f),
    );
    let state;
    if (thrown.length) state = 'BLOCKED';
    else if (todo.length) state = 'STUB';
    else if (mentioned.length) state = 'WIRED';
    else state = 'UNCLEAR';
    return { id, state, thrown, todo, mentioned: mentioned.slice(0, 3) };
  });

  const counts = report.reduce((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({ total: report.length, counts, report }, null, 2)}\n`);
    process.exit(args.has('--strict') && (counts.BLOCKED ?? 0) > 0 ? 1 : 0);
  }

  const order = ['BLOCKED', 'STUB', 'WIRED', 'UNCLEAR'];
  const shown = args.has('--blocked') ? report.filter((r) => r.state === 'BLOCKED') : report;

  console.log('check-task-status — derived from the tree, not asserted\n');
  console.log(
    `  ${report.length} tasks: ` +
      order.map((s) => `${s} ${counts[s] ?? 0}`).join(' · '),
  );
  console.log('  WIRED means the task id appears with no TODO and no throw. It is not a claim of done.\n');

  for (const state of order) {
    const group = shown.filter((r) => r.state === state);
    if (group.length === 0) continue;
    console.log(`${state} (${group.length})`);
    for (const r of group) {
      const evidence =
        state === 'BLOCKED'
          ? r.thrown[0]
          : state === 'STUB'
            ? r.todo[0]
            : state === 'WIRED'
              ? r.mentioned[0]
              : 'no evidence either way';
      console.log(`  ${pad(r.id, 20)} ${evidence}`);
    }
    console.log('');
  }

  process.exit(args.has('--strict') && (counts.BLOCKED ?? 0) > 0 ? 1 : 0);
}

function pad(value, width) {
  return String(value).padEnd(width);
}

main();
