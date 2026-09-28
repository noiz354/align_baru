# HARNESS.md — the one place that says what can actually run

Eight independent projects live in this repository. Each has its own stack, its own
test layers, and its own idea of what "verified" means. This file is the single place
that records the *execution* contract: what the machines and sandboxes these projects
run on can and cannot do.

It exists because the previous record was a hand-written audit
(`MVP_AUDIT/RUNTIME_COMMANDS.md`, sandbox `ikkuvfskb35qmack9i6ru`, 2026-09-28). That
document was accurate for one machine on one day, and it could not say which of its
claims still held. Prose about the environment rots. Measured output does not.

**So: the table in §4 is historical. §2 is a script. When they disagree, the script is
right and this document is out of date — fix the document.**

---

## 1. Three rules

1. **SKIPPED is not PASSED.** A capability that cannot run in the current environment
   is reported as unavailable *with its reason*. It is never folded into a green
   summary. `21 skipped` is not `21 passed`, and a gate that silently degrades is
   worse than a gate that is red, because the red one gets looked at.
2. **Derive, do not hardcode.** A checker that hardcodes "Node 24 is required" becomes
   a lie the day a project's `engines` changes. Read the requirement from the project.
3. **A warning is not a failure, but it is never hidden.** The sandbox runs Node 22
   against projects that ask for `>=24`, and they boot. That is recorded as a warning
   *with the evidence attached*, not as a pass and not as a hard error.

---

## 2. Run the preflight

```bash
node scripts/check-harness-preflight.mjs            # table, exit 1 on FAIL
node scripts/check-harness-preflight.mjs --json     # machine-readable
node scripts/check-harness-preflight.mjs --project yomi-manga-reader-arch-skeleton
```

It probes rather than assumes: Node and CPU count, free memory, `HOME`, container
runtime, Playwright browser cache, npm-registry and Playwright-CDN reachability, TCP
listeners for Postgres/Redis/S3, and then per project the lockfile, the `engines`
range read from that project's own `package.json`, the test scripts, the presence of
an in-process Postgres (`@electric-sql/pglite`), and the tracked size.

Every row carries the reason for its status. Nothing is a bare boolean.

### Where the skills live

Project skills are discovered at **`.opencode/skills/<name>/SKILL.md`** — plural.

This was verified, not assumed: a skill written to `.opencode/skill/` (singular) was
invisible to `get_available_skills`, and moving it to `skills/` made it appear
immediately, labelled `(project)`. The `install_skill` tool suggests the singular
path; that suggestion is wrong. `.claude/skills/` is also scanned if a tool needs
cross-compatibility.

---

## 3. Hard constraints observed in the sandbox

From `MVP_AUDIT/RUNTIME_COMMANDS.md`. All of these are **claims to re-verify**, not
permanent facts — §2 exists because they expire.

| Constraint | Recorded observation | Consequence for gates |
|---|---|---|
| Playwright CDN | `cdn.playwright.dev` → ECONNRESET | `npx playwright install` fails; browser must come from the npm registry |
| apt | `apt-get update` → connection failed | no system packages; no `apt` for browser deps |
| npm registry | reachable | npm-sourced installs and `@sparticuz/chromium` are the viable path |
| Browser fallback | `@sparticuz/chromium` + `puppeteer-core`, extracts to `/tmp/chromium` (~200 MB) | needs `LD_LIBRARY_PATH=/tmp/al2023/lib`, `FONTCONFIG_PATH=/tmp/fonts`, `HOME=/tmp` |
| Node | sandbox ran v22.22.3 while three projects declare `>=24 <25` | boots with an npm warning; the preflight reports it as WARN |
| Install command | `npm install --legacy-peer-deps` needed for all six Node projects | `npm ci` is not interchangeable; peer-dep conflicts are real |
| Docker / KVM | not assumed available | any gate that needs a container daemon cannot be a gate |
| Ports | apps must bind `0.0.0.0` | the harness reaches the app, not localhost |

**On the 200 MB browser:** that is a large fraction of a tight sandbox's budget. Treat
full Playwright E2E as conditional on the preflight reporting a usable browser. The
default gate is unit + boot smoke; E2E is added when §2 says the browser is present.

---

## 4. Per-project gate matrix

Every cell below was read from that project's own `package.json`, `pyproject.toml`, or
test helper at **`5cad6a7`** (the merge of `arena/01a0e54f-align-baru`, PR #8). Commands
are the literal `scripts` values. Re-derive with the preflight rather than trusting
this table — it is already wrong once, because the arena branch changed it.

| Project | Stack | Unit | Integration | E2E | Runs without a database? |
|---|---|---|---|---|---|
| `homeops-household-manager-spec` | Next.js | `npm test` = `vitest run --project unit` | `npm run test:integration` | `npm run test:e2e` | Yes — `@electric-sql/pglite`; DB suites also `skipIf(!isDatabaseAvailable())` |
| `majelishub-pengajian-event-platform-spec` | Next.js | `npm test` = `vitest run` | `npm run test:integration` | `npm run test:e2e` | Yes — `@electric-sql/pglite`, in-process |
| `manga-reader-spec-skeleton-minimal` | Next.js | `npm test` = `node --test` over `tests/unit` + `tests/integration` | folded into `npm test` | `npm run test:e2e` | Yes — no `drizzle`/`postgres` dependency at all |
| `parking-attendant-ops-app-spec` | Python stdlib | `python3 -m unittest discover -s tests -p "test_*.py"` | SQLite, in-process | none | Yes — zero dependencies |
| `rsi-agent-recursive-self-improvement-prototype` | Python stdlib | `python3 -m unittest discover -s tests -v` | none | none | Yes — zero dependencies; writes to `runs/` |
| `siomayops-streetfood-stall-ops-spec` | Next.js | `npm test` = `vitest run` | `npm run test:integration` = `vitest run --dir tests/integration` | `npm run test:e2e` | Yes — `src/server/db/memory-store.ts` |
| `strangerlink-random-chat-webrtc-spec` | Next.js | `npm test` / `npm run test:unit` | `npm run test:integration` | **none — no Playwright dependency** | Yes |
| `yomi-manga-reader-arch-skeleton` | Next.js | `npm run test:unit` = `vitest run tests/unit` | `npm run test:integration` = `vitest run tests/integration` | `npm run test:e2e` | Yes — `@electric-sql/pglite` plus a filesystem storage adapter; DB suites `skip` via `describeDb` when `DATABASE_URL` is unset |

Install for all six Node projects: `npm install --legacy-peer-deps` (§3).

Notes that cost someone a cycle, recorded so they cost one again:

- **strangerlink is the only project with no browser gate.** Do not plan one into a
  checklist. Its realtime transport is a separate process (`npm run test:realtime`).
- **`homeops`'s `npm test` is unit-only.** The integration project is a separate
  command; treating `npm test` as the whole gate under-reports.
- **`STORAGE_DIR` is undocumented in `yomi`.** The filesystem storage adapter reads it
  straight from `process.env` (`src/server/storage/filesystem.ts:28`) while
  `src/shared/validation/env.ts` — the boot-time validator — never registers it. So an
  operator can set it, and nothing will document, validate, or report it. Register it in
  `env.ts` or drop the override.
- **majelishub used to need a manual filesystem fix to boot.** Two route folders
  (`[slug]` and `[eventId]`) under the same dynamic path made Next.js refuse to start.
  It is fixed in the tree; if it reappears, it is that class of error.
- **strangerlink's `dev` script and its working invocation disagree.** The manifest
  script is not the one that produced a working page. Check `MVP_AUDIT` before
  concluding the app is broken.
- **`yomi` is the size outlier** — roughly 30× the tracked bytes of the smallest
  project, and its `node_modules` dominates further. Install it last, and expect it to
  be the memory ceiling.

---

## 5. What is not a gate

- A route returning 200 is not evidence its controls are hittable. A boot smoke check
  is evidence the app started; it is not evidence a feature works.
- A unit test that passes without touching the production query path is not coverage
  of that query. See the `test-the-shipping-code` skill.
  - A comment saying a dependency is absent is not evidence of absence.
    `scripts/check-claims.mjs` verifies that class of claim against the tree.
  - An inventory that marks a file `✅ landed` — or lists a port in a
    `PLANNED_*` array — is a claim about the filesystem, not a note. The same
    script verifies both directions, and runs in CI as the `claim-truth` job.

---

## 6. Related

- `scripts/check-harness-preflight.mjs` — probes this environment (§2).
- `scripts/check-claims.mjs` — verifies falsifiable environment claims (§5).
- `.opencode/skills/` — the project skill pack; `harness-portable-gate` covers this
  file's subject in depth.
- `MVP_AUDIT/RUNTIME_COMMANDS.md` — the original hand-written audit. Historical.
