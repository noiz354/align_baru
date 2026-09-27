#!/usr/bin/env node
/**
 * scripts/build-traceability.mjs
 *
 * Generates docs/TRACEABILITY.md from the two sources of truth:
 *   - PRD.md    → requirement ids, priority, and short description
 *   - TASKS.md  → which tasks cite which requirements (the `Req` field)
 *
 * It is deliberately dependency-free and deterministic: run it after editing
 * PRD.md or TASKS.md and commit the regenerated file (T-DOC-003 audits it).
 *
 * Usage: node scripts/build-traceability.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const prd = readFileSync(`${ROOT}/PRD.md`, 'utf8');
const tasks = readFileSync(`${ROOT}/TASKS.md`, 'utf8');

/* ---------- 1. requirements ---------- */
const REQ_ROW = /^\|\s*((?:FR|NFR)-[A-Z0-9]+-\d{3})\s*\|\s*(P\d)\s*\|\s*(.+?)\s*\|$/gm;
const requirements = [];
for (const m of prd.matchAll(REQ_ROW)) {
  requirements.push({ id: m[1], priority: m[2], text: m[3].replace(/\s+/g, ' ').trim() });
}

/* ---------- 2. tasks and the requirements they cite ---------- */
const taskBlocks = tasks.split(/\n(?=- \*\*T-[A-Z0-9]+-\d{3})/).filter((b) => b.startsWith('- **T-'));
const taskIndex = new Map(); // requirement id -> task ids
const taskMeta = new Map(); // task id -> { title, adrs: [], modules: [] }
for (const block of taskBlocks) {
  const head = block.match(/^- \*\*(T-[A-Z0-9]+-\d{3}) — (.*?)\*\*/);
  if (!head) continue;
  const id = head[1];
  const title = head[2].replace(/\.$/, '');
  const reqs = new Set(block.match(/\b(?:FR|NFR)-[A-Z0-9]+-\d{3}\b/g) ?? []);
  const adrs = [...new Set((block.match(/\bADR-\d{3}\b/g) ?? []).filter((a) => a !== 'ADR-000'))].sort();
  const modules = [
    ...new Set((block.match(/`(src\/[^`]+|tests\/[^`]+)`/g) ?? []).map((s) => s.replace(/`/g, ''))),
  ];
  taskMeta.set(id, { title, adrs, modules });
  for (const r of reqs) {
    if (!taskIndex.has(r)) taskIndex.set(r, []);
    taskIndex.get(r).push(id);
  }
}

/* ---------- 3. family-level design / skeleton / test mapping ---------- */
const FAMILY = {
  'FR-HH': [
    'docs/design/PAGES.md §11 (onboarding) + §10 (settings)',
    'src/features/household, src/domain/household',
    'tests/integration/household/*.test.ts',
  ],
  'FR-MEM': [
    'docs/security/AUTHZ-MATRIX.md §1',
    'src/features/members, src/domain/members',
    'tests/integration/members/*.test.ts',
  ],
  'FR-AUTH': ['SECURITY.md §4', 'src/server/auth', 'tests/integration/auth/*.test.ts'],
  'FR-ROOM': [
    'docs/product/ROOMS.md',
    'src/domain/rooms, src/features/rooms',
    'tests/unit/domain/rooms/status.test.ts + tests/e2e/QA-03*',
  ],
  'FR-CHORE': [
    'docs/product/CHORES.md + RECURRENCE.md',
    'src/domain/chores, src/features/chores',
    'tests/unit/domain/chores/*.test.ts + tests/e2e/QA-04/05*',
  ],
  'FR-TRASH': [
    'docs/product/TRASH.md',
    'src/domain/trash, src/features/trash',
    'tests/unit/domain/trash/*.test.ts + tests/e2e/QA-06*',
  ],
  'FR-RES': [
    'docs/product/RESOURCES.md',
    'src/domain/resources, src/features/resources',
    'tests/unit/domain/resources/*.test.ts + tests/e2e/QA-07*',
  ],
  'FR-SHOP': [
    'docs/product/RESOURCES.md §Shopping list',
    'src/domain/resources, src/features/resources',
    'tests/integration/resources/shopping.test.ts',
  ],
  'FR-MNT': [
    'docs/product/MAINTENANCE.md',
    'src/domain/maintenance, src/features/maintenance',
    'tests/unit/domain/maintenance/*.test.ts + tests/e2e/QA-10*',
  ],
  'FR-ISSUE': [
    'docs/product/ISSUES.md',
    'src/domain/issues, src/features/issues',
    'tests/integration/issues/*.test.ts + tests/e2e/QA-09*',
  ],
  'FR-ALERT': [
    'docs/product/ALERTS.md',
    'src/domain/alerts, src/features/alerts',
    'tests/unit/domain/alerts/*.test.ts + tests/e2e/QA-11/12*',
  ],
  'FR-NOTIF': [
    'docs/product/NOTIFICATIONS.md',
    'src/features/notifications/policy.ts, src/server/notifications',
    'tests/unit/features/notifications/policy.test.ts',
  ],
  'FR-DASH': [
    'docs/product/DASHBOARD.md',
    'src/features/dashboard, src/domain/dashboard',
    'tests/integration/dashboard/snapshot.test.ts + tests/e2e/QA-13*',
  ],
  'FR-ACT': [
    'docs/product/ACTIVITY.md',
    'src/domain/activity, src/features/activity',
    'tests/integration/activity/*.test.ts + tests/e2e/QA-08*',
  ],
  'FR-SET': ['docs/design/PAGES.md §10', 'src/app/settings/**, src/features/*', 'tests/e2e/settings.spec.ts'],
  'FR-PWA': [
    'docs/design/PAGES.md §12 + ADR-014',
    'src/app/manifest.ts, src/sw.ts',
    'tests/e2e/offline.spec.ts (QA-14*)',
  ],
  'NFR-PERF': ['PERFORMANCE.md', 'app-wide', 'tests/e2e/perf/*.spec.ts'],
  'NFR-SEC': [
    'SECURITY.md + THREAT_MODEL.md',
    'app-wide, src/server/auth',
    'tests/integration/security/*.test.ts (T-SEC-*)',
  ],
  'NFR-PRIV': ['PRIVACY.md', 'app-wide, src/server/telemetry', 'tests/unit/telemetry/redaction.test.ts'],
  'NFR-OBS': [
    'OBSERVABILITY.md',
    'src/server/telemetry, src/server/scheduler',
    'tests/integration/observability/*.test.ts',
  ],
  'NFR-REL': ['DEPLOYMENT.md + docs/operations/BACKUP-RESTORE.md', 'ops scripts', 'manual drills (T-OPS-*)'],
  'NFR-MAINT': ['CONTRIBUTING.md + AGENTS.md §7', 'docs + scripts', 'scripts/verify-docs.mjs (T-PLAT-008)'],
  'NFR-A11Y': [
    'ACCESSIBILITY.md + docs/design/DESIGN-SYSTEM.md',
    'src/shared/ui, features/*/components',
    'tests/e2e/a11y/*.spec.ts + component a11y assertions',
  ],
};

const familyOf = (id) => id.replace(/-\d{3}$/, '').replace(/^(FR|NFR)-/, (m) => m); // FR-HH / NFR-SEC
const famKey = (id) => {
  const m = id.match(/^(?:FR|NFR)-[A-Z0-9]+/);
  return m ? m[0] : id;
};

const short = (s, n = 88) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');
const capList = (arr, n = 5) =>
  arr.length <= n ? arr.join(', ') : `${arr.slice(0, n).join(', ')} +${arr.length - n} more`;

/* ---------- 4. build the matrix ---------- */
const p0p1 = requirements.filter((r) => r.priority === 'P0' || r.priority === 'P1');
const rows = [];
const uncovered = [];
for (const r of p0p1) {
  const fam = FAMILY[famKey(r.id)] ?? ['—', '—', '—'];
  const covering = (taskIndex.get(r.id) ?? []).slice().sort();
  if (covering.length === 0) uncovered.push(r.id);
  const adrs = [...new Set(covering.flatMap((t) => taskMeta.get(t)?.adrs ?? []))].sort();
  const modules = [...new Set(covering.flatMap((t) => taskMeta.get(t)?.modules ?? []))];
  rows.push(
    `| \`${r.id}\` ${r.priority} | ${short(r.text)} | ${fam[0]} | ${adrs.length ? adrs.join(', ') : '—'} | ${modules.length ? capList(modules, 3) : fam[1]} | ${covering.length ? capList(covering, 4) : '**NONE**'} | ${fam[1]} | ${fam[2]} |`,
  );
}

const p2 = requirements.filter((r) => r.priority === 'P2');
const p2Covered = p2.filter((r) => (taskIndex.get(r.id) ?? []).length > 0);
const tasksWithoutReq = [...taskMeta.entries()].filter(([id]) => {
  const block = taskBlocks.find((b) => b.startsWith(`- **${id} —`));
  return block ? !/\b(?:FR|NFR)-[A-Z0-9]+-\d{3}\b/.test(block) : true;
});

const DOMAIN_MODULES = [
  'household',
  'members',
  'rooms',
  'chores',
  'trash',
  'resources',
  'maintenance',
  'issues',
  'alerts',
  'activity',
];
const taskText = [...taskMeta.values()].map((m) => m.modules.join(' ')).join(' ');
const unownedModules = DOMAIN_MODULES.filter((mod) => !taskText.includes(`domain/${mod}`));

const out = `# Traceability Matrix

> **Generated file — do not hand-edit.** Run \`node scripts/build-traceability.mjs\` after changing \`PRD.md\` or \`TASKS.md\`.
> Last generated: ${new Date().toISOString().slice(0, 10)} · Generator: \`scripts/build-traceability.mjs\`
>
> Format: \`Requirement | Design | ADR | Module | Task | Skeleton | Planned Test\`.
> \`ADR\` and \`Module\` are derived from the tasks that cite the requirement; \`Skeleton\` and \`Planned Test\` are family-level paths (the concrete file names are fixed by T-XXX tasks at implementation time).

## Coverage summary

| Metric | Value |
| --- | --- |
| Requirements in PRD.md | ${requirements.length} |
| P0/P1 requirements (release-blocking) | ${p0p1.length} |
| P0/P1 requirements mapped to ≥1 task | ${p0p1.length - uncovered.length} (${(((p0p1.length - uncovered.length) / p0p1.length) * 100).toFixed(1)}%) |
| P0/P1 requirements unmapped | ${uncovered.length}${uncovered.length ? ` — ${uncovered.join(', ')}` : ''} |
| P2 requirements present | ${p2.length} |
| P2 requirements with a planned task | ${p2Covered.length} (the rest are explicitly out of v1) |
| Tasks in TASKS.md | ${taskMeta.size} |
| Tasks citing no FR/NFR id (allowed for platform, QA, and documentation chores) | ${tasksWithoutReq.length}${tasksWithoutReq.length ? ` — ${tasksWithoutReq.map(([id]) => id).join(', ')}` : ''} |
| Domain modules with no owning task (must be 0) | ${unownedModules.length}${unownedModules.length ? ` — ${unownedModules.join(', ')}` : ''} |

## The matrix (P0/P1)

| Requirement | What it requires (abridged) | Design | ADR | Module | Task | Skeleton | Planned Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## P2 requirements

| Requirement | Priority | Requirement (abridged) | Status |
| --- | --- | --- | --- |
${p2.map((r) => `| \`${r.id}\` | P2 | ${short(r.text)} | ${(taskIndex.get(r.id) ?? []).length ? `planned: ${capList(taskIndex.get(r.id), 3)}` : 'deferred past v1 (no task — deliberate)'} |`).join('\n')}

## How to read this file

1. **Requirement → task** proves nothing is specified and then forgotten. A requirement with no task is a defect in planning, not a subtlety.
2. **Task → requirement** (the \`Req\` field in TASKS.md) proves no work exists that nobody asked for. Platform, documentation, and QA tasks legitimately cite no product requirement; anything else must.
3. **Skeleton** paths listed as family-level directories are fixed into concrete files by the task that creates them; this column exists so an implementer knows which module to open before reading the whole spec.
4. **Planned Test** names the layer and scenario family, not the final file: TESTING.md §4 fixes the naming rule (\`T-XXX-NNN <requirement>: behaviour\`).
5. Requirement priorities come from PRD.md §6; this file never assigns its own priority.
6. The generator fails loudly (it prints the word NONE in the Task column) rather than silently omitting an unmapped requirement; a NONE in this file is a planning defect.
`;

mkdirSync(dirname(`${ROOT}/docs/TRACEABILITY.md`), { recursive: true });
writeFileSync(`${ROOT}/docs/TRACEABILITY.md`, out);
console.log(
  `docs/TRACEABILITY.md written · P0/P1 ${p0p1.length - uncovered.length}/${p0p1.length} mapped · tasks ${taskMeta.size} · tasks without requirement ${tasksWithoutReq.length}`,
);
