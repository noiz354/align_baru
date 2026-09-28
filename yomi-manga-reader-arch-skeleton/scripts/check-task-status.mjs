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
 * does is separate the states that look identical in a grep:
 *
 *   BLOCKED     the code for this task exists and says so:
 *                `throw new Error("Not implemented: T-…")`.
 *   STUB        a `TODO(…)` names this task. The shape is there; the behaviour is not.
 *   PLACEHOLDER a page renders `NotYetBuilt` with `task="T-…"`: the route exists, the address
 *                works, and the page states in its own text that it is not built.
 *   ABSENT      nothing in the tree speaks about this task.
 *
 * There is deliberately no "WIRED" bucket, and its removal is the point of this revision. The
 * previous state said "WIRED means the task id appears in the tree with no TODO and no throw" —
 * which counted a page's own blocker note as proof that the blocker was resolved. T-LIB-003
 * reported WIRED while `/library` rendered "This page is not built yet… Once T-LIB-003 lands",
 * and T-READER-025 reported WIRED when only its port interface existed and no adapter had ever
 * been written. A bucket that fills itself with the very text that describes the gap is worse
 * than no bucket: it made 79 of 137 tasks look further along than they were, and any plan built
 * from that number would be wrong.
 *
 * Every state above is falsifiable from a file. A mention that is not one of them is ABSENT,
 * because "some comment somewhere contained the string" is not evidence of anything.
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
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.git',
  '__pycache__',
  '.turbo',
  'playwright-report',
  'test-results',
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
  const throwsFor = new Map(); // id -> [files]
  const todosFor = new Map(); // id -> [files]
  const placeholdersFor = new Map(); // id -> [files]
  const mentions = new Map(); // id -> [files]  (audit only, never a state)
  const placeholderPageFiles = []; // files that render NotYetBuilt, counted from the tree
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

    // EVERY id inside the parens, not just the first. `TODO(T-AUTH-012, T-READER-018,
    // T-SEARCH-004)` on one line of FormField.tsx is three unfinished tasks; the old pattern
    // captured only T-AUTH-012 and reported the other two as finished, which is how T-SEARCH-004
    // came to be counted as WIRED while a TODO sat in the file naming it.
    for (const m of text.matchAll(/TODO\(([^)]*)\)/g)) {
      for (const id of m[1].matchAll(/\b(T-[A-Z0-9]+-\d+)\b/g)) {
        add(todosFor, id[1], rel);
      }
    }

    // A page that renders `NotYetBuilt` is not wired, whatever else it mentions. The task is
    // read off the component's own `task` prop rather than by scanning the file for any id,
    // because the page's docstring names every task it depends on — including several that are
    // genuinely done.
    //
    // The PAGE is recorded separately from the task ids, because the two answer different
    // questions and only one of them survived. `admin/manga/[id]/page.tsx` writes
    // `task="T-ADMIN-002…005"` — a range with an ellipsis — which the id pattern below
    // cannot match, so that page attributed to no task at all and the summary understated
    // itself by one. Deriving the page list from the files removes the dependency on the
    // prop being well-formed: a page that renders `NotYetBuilt` is a placeholder page
    // whatever it happens to call itself.
    if (rel.endsWith('page.tsx') && text.includes('NotYetBuilt')) {
      placeholderPageFiles.push(rel);
    }
    for (const m of text.matchAll(
      /<NotYetBuilt\b[\s\S]{0,400}?\btask=["'`](T-[A-Z0-9]+-\d+)["'`]/g,
    )) {
      add(placeholdersFor, m[1], rel);
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
    const placeholder = placeholdersFor.get(id) ?? [];
    let state;
    if (thrown.length) state = 'BLOCKED';
    else if (todo.length) state = 'STUB';
    else if (placeholder.length) state = 'PLACEHOLDER';
    else state = 'ABSENT';
    return {
      id,
      state,
      thrown,
      todo,
      placeholder,
      // Kept for auditing, never for classification: a bare mention is not a state.
      mentions: (mentions.get(id) ?? []).length,
    };
  });

  const counts = report.reduce((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});

  // A page count, because "how many of these pages actually work" is the question this report
  // kept failing to answer. PLACEHOLDER is nearly always shadowed by STUB — a placeholder page
  // usually also carries a TODO naming its blocker — so the bucket reads 0 while fifteen pages
  // are still placeholders. The count is stated separately for exactly that reason.
  const placeholderPages = placeholderPageFiles;

  if (args.has('--json')) {
    process.stdout.write(
      `${JSON.stringify({ total: report.length, counts, placeholderPages: placeholderPages.length, report }, null, 2)}\n`,
    );
    process.exit(args.has('--strict') && (counts.BLOCKED ?? 0) > 0 ? 1 : 0);
  }

  const order = ['BLOCKED', 'STUB', 'PLACEHOLDER', 'ABSENT'];
  const shown = args.has('--blocked') ? report.filter((r) => r.state === 'BLOCKED') : report;

  console.log('check-task-status — derived from the tree, not asserted\n');
  console.log(
    `  ${report.length} tasks: ` + order.map((s) => `${s} ${counts[s] ?? 0}`).join(' · '),
  );
  console.log(
    `  ${placeholderPages.length} page(s) render NotYetBuilt: a route that answers, and says so.\n`,
  );
  console.log(
    '  Every state is read from a file. There is no "looks wired" bucket: a task counts as\n' +
      '  nothing here unless something in the tree is explicitly unfinished about it.\n',
  );

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
            : state === 'PLACEHOLDER'
              ? r.placeholder[0]
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
