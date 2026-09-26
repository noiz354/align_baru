# SKILLS.md — Agent Skills & Capabilities

Date: 2026-09-26 · Scope: which capabilities coding agents actually have in this environment, mapped to the work in TASKS.md. **No skill names are fabricated here** — only capabilities that were verified present are listed.

## 1. What Was Inspected

Checked before writing this file (2026-09-26):

- `/home/user` workspace root (empty at phase start — no project-level skill definitions)
- `/home/user/.claude`, `/home/user/.skills`, `/home/user/.arena` — not present
- `/opt` and environment variables — no skill registry exposed to the sandbox
- Agent tool manifest (the tool list actually available to the agent in this environment)

**Finding:** there is **no external "Agent Skills" registry** in this environment (no skill packages, no marketplace, no CLAUDE-skills-style directory). The only real capabilities are the **built-in tools** of the agent runtime, listed below. Anything in the "desired capability areas" that has no built-in tool is covered by (a) the model's general competence and (b) this repository's documentation (which is the de-facto skill: PRD/ADRs/docs encode the domain expertise), plus (c) live research via web search for version-sensitive facts.

## 2. Available Capabilities (built-in tools, verified present)

### Skill: bash
- **Source:** agent runtime tool (sandboxed shell at /home/user; Node 20 toolchain present; npm available)
- **Purpose:** run builds, tests, typecheck, lint, Docker/compose, git, file ops, scripts
- **Applicable tasks:** all CI-style verification tasks (T-FOUND-001/011, T-PERF-*, T-PROD-*, TEST_STRATEGY execution)
- **When to load:** for any command execution; prefer targeted single commands over exploratory loops
- **Expected output:** command stdout/stderr, exit codes; files modified in the workspace
- **Limitations:** no terminal/PTY; long-running watchers must use the process tools; commands time out (max ~30 min); only /home/user persists

### Skill: read_file / write_file / edit_file
- **Source:** agent runtime tools
- **Purpose:** inspect and modify repository files (code, docs, config)
- **Applicable tasks:** every task; edit_file for surgical changes (fuzzy match), write_file for new files
- **When to load:** after discovery (AGENTS.md §2) narrows the target files
- **Expected output:** file contents / modified files
- **Limitations:** edit_file is first-match fuzzy — verify with a read after editing; no multi-file transactions (sequence edits carefully)

### Skill: web_search / fetch_page
- **Source:** agent runtime tools (web access)
- **Purpose:** current-version research, vendor docs, changelogs, release-status checks
- **Applicable tasks:** any task touching a version-sensitive dependency (research registry maintenance, ADR "Revisit When" checks, e.g., Drizzle 1.0 GA, Prisma 8 GA, Node 26 LTS, TypeScript 7.1)
- **When to load:** when a task's correctness depends on *current* ecosystem state, not on what the repo docs pinned
- **Expected output:** cited, dated findings (record in the research doc when they change a decision)
- **Limitations:** search results are third-party; corroborate version claims against official sources (npm/registry/vendor) before pinning; no guaranteed freshness within the session

### Skill: image_search / generate_image
- **Source:** agent runtime tools
- **Purpose:** fetch/generate bitmap images
- **Applicable tasks:** none in this product (manga content is user-uploaded; test pages are synthetic — TEST_STRATEGY.md §6). Available for diagrams/mockups only.
- **When to load:** never for product content (NO-2: content is pre-authorized by the owner)
- **Expected output:** image files in the workspace
- **Limitations:** AI imagery is inappropriate as manga content or realistic test fixtures for decode-pipeline work (use synthetic programmatic images)

### Skill: generate_speech / add_voice
- **Source:** agent runtime tools
- **Purpose:** TTS
- **Applicable tasks:** none (no audio in this product)
- **When to load:** never
- **Expected output:** audio files
- **Limitations:** n/a for this project

### Skill: present_file
- **Source:** agent runtime tool
- **Purpose:** surface a workspace file to the user (viewer)
- **Applicable tasks:** reporting deliverables (slice evidence, reports) to the human operator
- **When to load:** when a human should see a produced artifact
- **Expected output:** file opened in the user's viewer
- **Limitations:** preview renders sandboxed (no network) — self-contained artifacts only

### Skill: start_process / get_process_output / stop_process
- **Source:** agent runtime tools
- **Purpose:** run long-lived processes (dev servers, compose up, test servers) and read their output
- **Applicable tasks:** dev servers for browser verification (AGENTS.md §3.6), E2E environments, load smoke (T-PROD-007)
- **When to load:** when a process must outlive a single command
- **Expected output:** process logs, listening ports, liveness
- **Limitations:** processes don't survive sandbox restarts; manage lifecycle explicitly (stop_process)

### Skill: ask_user
- **Source:** agent runtime tool
- **Purpose:** clarify blocking ambiguity with the human operator
- **Applicable tasks:** genuine spec questions (AGENTS.md §6: prefer `spec-question` in the PR; use this tool only when work is blocked)
- **When to load:** when ambiguity materially changes the implementation and docs don't resolve it
- **Expected output:** a decision from the operator (record it — update the task/doc)
- **Limitations:** overuse stalls the pipeline; the docs are the first resort

## 3. Desired Capability Areas → Coverage Map

| Desired area | Covered by | Notes / gaps |
|---|---|---|
| Architecture | model competence + ARCHITECTURE.md + docs/architecture/ | No dedicated skill; the docs are the authoritative architecture record — treat them as read-only input unless an ADR process changes them |
| ADRs | model competence + ADR.md template + 9 exemplars in docs/adr/ | Follow the exemplar structure exactly (Context → Options → Decision → Consequences → Risks → Mitigations → Revisit When → References) |
| Product requirements | model competence + PRD.md (ID registry) + docs/product/ | New requirements get IDs by extension of the existing prefixes (FR-<MODULE>-NNN, NFR-<AREA>-NNN) |
| Next.js | model competence + ADR-001 + web_search (version-sensitive) | 16.x specifics (Turbopack, RSC boundaries) — verify against official docs when a task hits a framework edge case |
| React | model competence + ADR-001 | 19.x patterns per docs; reader is the hard part — reader-behavior.md is the spec |
| TypeScript | model competence + tsconfig (strict + hardening flags) | TS 6.0 pinned (ADR/research); 7.x only per "Revisit When" |
| PostgreSQL | model competence + DATA_MODEL.md + web_search (18.x specifics) | 18.x features (uuid v7, partial indexes) are stable knowledge; verify exotic GUCs before use |
| Database design | model competence + DATA_MODEL.md (authoritative) | Deviations require a doc update in the same PR |
| API design | model competence + API_CONTRACT.md (authoritative) | New operations require the contract table + error taxonomy update |
| Security / OWASP | model competence + SECURITY.md + THREAT_MODEL.md (18-row register) | Verification is task-defined (T-SEC-*, T-UPLOAD-015); no scanner skill — ZAP runs as a CI tool (T-SEC-007), not an agent skill |
| Accessibility | model competence + ACCESSIBILITY.md (contract) + axe in E2E | axe-core is a *test dependency*, not an agent skill; manual SR passes are human tasks |
| Performance | model competence + PERFORMANCE.md (budgets) + test harnesses (T-PERF-*) | Budgets are measurable — agents verify with harnesses, not intuition |
| Image optimization | model competence + ADR-005 (sharp pipeline contract) | sharp is a *planned dependency* (installed at T-UPLOAD-004), not an agent capability |
| Object storage | model competence + ADR-004 (S3 protocol port) | S3 SDK is a planned dependency; MinIO for dev via compose |
| Testing | model competence + TEST_STRATEGY.md (planned test IDs) + Vitest/Playwright (planned deps) | Tests are written to the planned IDs; no pre-existing test skill |
| Playwright | model competence + web_search (1.62.x specifics) | Trace viewer / MCP features exist upstream; use standard test API in v1 |
| Docker | model competence + DEPLOYMENT.md + compose files (created in VS-0/11) | Compose is a config format, not a skill |
| CI/CD | model competence + CONTRIBUTING.md §4 + .github/workflows (VS-0) | GitHub Actions YAML per conventions |
| OpenTelemetry | model competence + OBSERVABILITY.md + web_search (2.x API specifics) | Stable packages only (ADR-008) — never import experimental `sdk-node` |
| Code review | model competence + CONTRIBUTING.md §7 checklist + boundary lint | The review checklist is the codified "skill" |
| Visual QA | model competence + browser inspection (AGENTS.md §3.6) + screenshots | No visual-regression tooling in v1 (documented; screenshots are the artifact) |

## 4. Skill Discipline

1. **Load by task, not by habit:** a reader task doesn't load upload-security docs; the task's Inputs line names the documents (that line is the skill-loading list).
2. **Version-sensitive facts are re-verified:** when a task depends on "current" (new dependency, ADR revisit), use web_search against official sources and record the evidence (research doc or the PR).
3. **No fabricated capabilities:** if a capability is not listed in §2, it does not exist — plan the work using what exists (docs, tools, web research) or raise a spec/infra task.
4. **Documentation is the domain skill:** when in doubt about *what to build*, the answer is in PRD/ADRs/docs — reading them is faster and more correct than inventing from memory.
