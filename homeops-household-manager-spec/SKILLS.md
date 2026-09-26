# SKILLS.md — Agent Skill Inventory (verified)

> Verified: **2026-09-26** · Verification method: filesystem + tool inspection (commands below)
> **Result: ZERO relevant Agent Skills are available in this environment.** This file records the verification, the capabilities that *are* available, and the skill contracts this repository expects — explicitly marked as not present, so no agent plans work around a skill that does not exist.

## 1. Verification performed

```bash
# 1. Skill directories / agent config dirs
find / -maxdepth 8 -type d \( -iname "*skill*" -o -iname ".claude" -o -iname ".codex" -o -iname ".agent*" \) \
  -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null

# 2. Skill manifests
find / -maxdepth 8 -type f \( -iname "SKILL.md" -o -iname "skills.json" -o -iname "*.skill" \
  -o -iname "AGENTS.md" -o -iname "CLAUDE.md" \) -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null

# 3. Environment hints
env | grep -iE "skill|agent|mcp|tool"

# 4. Tool surface
# (inspected the tools exposed to the agent runtime in this session)
```

### Raw results

| Check | Result |
| --- | --- |
| Skill directories | One hit: `/usr/local/lib/python3.13/site-packages/typer/.agents/skills/typer` — an artifact shipped *inside the Typer Python package* to describe Typer CLI conventions. It is **not** registered with any agent runtime, is not loadable as a skill, and is irrelevant to a TypeScript/Next.js/PostgreSQL project. |
| Skill manifests (`SKILL.md`) | Only the Typer file above. No project- or runtime-level skill manifest exists. |
| Environment variables | No `SKILL*`, `AGENT*`, `MCP*` or tool-routing variables present. |
| Tool surface | The agent runtime exposes file read/write/edit, sandboxed bash, web search/fetch, image and speech generation, and background process control. **No skill-loading tool is exposed.** |

## 2. Conclusion

> **Do not assume any skill exists.** An agent working on HomeOps must rely on: (a) this repository's documents, (b) its own general capability, and (c) the tool surface listed above. Any plan that says "use the X skill" is invalid until §5's re-inspection shows it available.

There is **no** available skill for: architecture, ADR writing, product design, UX, Next.js, React, TypeScript, PostgreSQL, security, privacy, accessibility, testing, Playwright, PWA, OpenTelemetry, Docker, code review, or visual QA.

## 3. Capabilities that ARE available (the actual "skill set")

These are the real, verified capabilities an agent has in this environment. Treat them as the substrate for all future work.

| Capability | Source | Purpose | Applies to tasks | When to use | Expected result | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| Repository file read/write/edit | Arena.ai Agent Mode workspace tools | Author and modify code and docs | All tasks | Always | Deterministic file changes in `/home/user` | No git remote operations; snapshots exclude `node_modules`, `dist`, caches |
| Sandboxed shell (bash) | Arena.ai Agent Mode workspace tools | Run typecheck, tests, scripts, inspect tree | All tasks; required for T-PLAT-*, T-OPS-* | Before claiming any task done | Command output as evidence | Ephemeral installs; no network daemons; long-running processes need the process tool |
| Background processes + port preview | Arena.ai Agent Mode workspace tools | Run dev server / preview the app | VS-0 onward, UI slices | When a running server is needed | Live preview in the user's browser | Must bind `0.0.0.0`; iframe sandbox has no network access for external assets |
| Web search + page fetch | Arena.ai Agent Mode tools | Verify 2026 library versions, official docs, release notes | Stack decisions, upgrades, security advisories | Before pinning any dependency; for `docs/research/*` updates | Cited, current facts | Not a substitute for reading the repo; snippets can be secondary sources |
| Typed document authoring (Markdown) | This repository's conventions | Produce PRD/ADR/design docs | All documentation tasks | Every slice | Docs consistent with TRACEABILITY.md | Requires the traceability gate to stay honest |
| Image generation/search | Arena.ai Agent Mode tools | Placeholder icons/manifest art during VS-13 | T-PWA-002 only | If asset work is scheduled | Generated asset files | Not a design system; AI imagery must not be treated as final brand assets |
| Speech generation | Arena.ai Agent Mode tools | Not used by this product | — | Never for HomeOps | n/a | Out of scope |

## 4. Skill contracts this repository expects (NOT PRESENT — do not rely on)

Listed for completeness so that, if such skills are later installed, their intended use is already documented. **None of these exist today.**

| Desired skill area | Intended use | Tasks | Expected result | Status |
| --- | --- | --- | --- | --- |
| Architecture / ADR authoring | Draft or amend ADRs with the house template | T-DOC-001..004 | ADR with all required sections, indexed in ADR.md | **NOT PRESENT** |
| Product/UX design review | Critique a page against DESIGN.md principles | T-DOC-005, UI slices | Written findings against DP-1..DP-12 | **NOT PRESENT** |
| Next.js / React implementation | Implement routes, RSC, Server Actions | VS-0..VS-13 | Typed, layered changes per ARCHITECTURE.md §4 | **NOT PRESENT** |
| TypeScript strict-mode refactor | Harden types at a boundary | Any task | No `any`, explicit DTOs | **NOT PRESENT** |
| PostgreSQL / Drizzle work | Author schema, migrations, indexes | T-PLAT-003..005, all data slices | SQL matching DATA_MODEL.md, reviewed by hand | **NOT PRESENT** |
| Security review | Threat-model a change | T-SEC-* | THREAT_MODEL.md row + mitigation + test | **NOT PRESENT** |
| Privacy review | Check a change against PRIVACY.md | T-PRIV-* | Data-minimisation verdict, log audit | **NOT PRESENT** |
| Accessibility audit | Keyboard/SR/contrast pass | UI slices, T-A11Y-* | Findings against WCAG 2.2 AA items in ACCESSIBILITY.md | **NOT PRESENT** |
| Testing (Vitest/Playwright) authoring | Convert `describe.todo` skeletons into tests | All slices | Passing focused suite | **NOT PRESENT** |
| PWA / service worker | Implement manifest, SW, push | VS-13 | Installable app per ADR-014 | **NOT PRESENT** |
| OpenTelemetry instrumentation | Add spans/metrics | VS-15 | Signals per OBSERVABILITY.md | **NOT PRESENT** |
| Docker/CI | Build image, pipeline | T-PLAT-020 | Reproducible artifact, green pipeline | **NOT PRESENT** |
| Code review | Review a diff against AGENTS.md | Every PR | Checklist from AGENTS.md §5 passed | **NOT PRESENT** |
| Visual QA | Compare rendered UI to DESIGN.md | UI slices | Screenshot-based findings | **NOT PRESENT** |

## 5. Re-inspection protocol

Before any agent claims a skill is available:

1. Re-run the four verification commands in §1 and paste the output into the task notes.
2. Check the runtime tool list for a skill-loading tool. If none is exposed, the answer is "no skills".
3. If a skill is found, add a row to §3 (available) — **never** to §4 — with: name, source path, purpose, tasks it may serve, when to load it, expected result, and limitations. Update this file's verification date.
4. If a skill appears mid-project, it must not be used to bypass AGENTS.md §1 (forbidden actions) or any ADR.
5. Re-verify at the start of each vertical slice; environments change between sessions.

## 6. Consequences for planning

- TASKS.md contains no "use skill X" instructions; every task is self-contained with requirement, ADR, design doc, and test references.
- Because no design skill is available, `docs/design/DESIGN-SYSTEM.md` must be *implementable by a generalist*: it specifies tokens as CSS custom properties with concrete values, not as a visual mood.
- Because no accessibility skill is available, ACCESSIBILITY.md includes the concrete checklist a human or agent must walk through manually for each UI task.
- Because no security skill is available, SECURITY.md + THREAT_MODEL.md are written to be executable checklists rather than aspirational statements.
