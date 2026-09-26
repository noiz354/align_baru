# SKILLS

Agent Skills available to whoever works in this repository — what exists, what it is for, when to load
it, and what it cannot do.

> **Inspection result (2026-09-26): no Agent Skills are installed or discoverable in this
> environment.** Nothing is therefore documented here as available. This file records the inspection
> method, the record format to use when skills *are* present, the capability gaps that skills would
> need to fill, and the fallback working mode that is currently in force. **No skill is invented on
> this page.**

---

## 1. How the inspection was performed (repeat this before trusting this file)

| Step | Command / location | What it proves |
|---|---|---|
| 1 | `ls -la ~/.claude ~/.config ~/skills /opt /usr/local/share/skills` | Whether skill directories exist at the conventional locations |
| 2 | `find / -maxdepth 5 -iname '*skill*' 2>/dev/null` | Any skill manifest (`SKILL.md`, `*.skill.json`, skill packs) |
| 3 | `env \| grep -iE 'skill\|agent\|mcp'` | Skill-related environment or MCP configuration |
| 4 | Inspect the agent runtime's own tool list (e.g. a "list skills" capability) | Skills registered inside the runtime rather than on disk |

Result on 2026-09-26: step 1 and 2 found only the POSIX `skill(1)` command (unrelated to Agent
Skills); step 3 returned nothing; step 4 exposed no skill-listing capability. **Conclusion: zero
available skills.**

## 2. Record format (mandatory for every entry, once skills exist)

Each available skill gets exactly these fields — none may be fabricated, none may be left vague:

| Field | Meaning |
|---|---|
| **Skill** | Its registered name, exactly as reported by the runtime |
| **Source** | Where it comes from (built-in, plugin pack, repository `.skills/`, MCP server, vendored) |
| **Purpose** | The specific job it does, in one sentence |
| **Applicable tasks** | Task IDs from `TASKS.md` (or task classes) where it helps |
| **When to load** | The trigger condition — the moment in the workflow it should be used |
| **Expected result** | What the agent should have in hand after using it, in verifiable terms |
| **Limitations** | What it must not be trusted for; known failure modes; data it must not receive |

## 3. Capability requirements this repository has (unfilled)

These are the jobs a skill would meaningfully help with. They are listed as **requirements**, not as
available skills. When a skill covering one is discovered, replace the entry with a full §2 record.

| Required capability | Job | Binding constraints |
|---|---|---|
| **Skeleton audit** | Verify that no file in `src/**` contains a fake implementation, that every stub throws `Not implemented: <task>` with an existing task ID, and that route shells render nothing | Must not modify code; must report file:line; must treat "returns a constant success" as a finding |
| **Traceability check** | Maintain and verify the requirement → document → task → test chain | Requirement IDs are read from `PRD.md` only; never invent an ID; report gaps rather than fixing them silently |
| **Doc-reference lint** | Verify every cited `docs/**` path exists and every cited task ID is defined in `TASKS.md` | Read-only; this is `T-DOCS-001` and must stay reproducible in CI without an agent |
| **Migration safety review** | Inspect a proposed migration for lock behaviour, backward compatibility, idempotency, and destructive steps | Must refuse to approve destructive changes in the same release as the code change; never apply a migration |
| **Privacy review** | Inspect a diff for new data collection, new logging, new third-party transmission, retention impact | Must be able to block; must not approve a new processor without an ADR |
| **Test-gap analysis** | Map a diff to `TESTING.md` §3 minimums and the C1…C12 cases | Must report "no test" as a finding, not a suggestion to skip |
| **Concurrency case finder** | Given a change to check-in/attendance/registration/upload/publication, identify which C-cases apply | Must name the case ID and the required assertion |
| **Screenshot/build tooling** | Render the UI shells and capture screenshots for design review | Must never render placeholder UI as if it were the product (phase rule) |

## 4. What skills may never do in this project

1. **Write product behaviour.** Skills assist analysis and verification; implementation follows
   `TASKS.md` and the phase boundary. No skill may add business logic.
2. **Touch production.** No skill may connect to a production database, storage bucket, mail provider
   or transcription provider, or hold production credentials.
3. **Handle real personal data.** Skills must operate on synthetic fixtures only
   (`docs/testing/TEST-DATA.md`).
4. **Bypass the review gate.** No automation may approve, publish, translate or "correct" transcript
   content, or mark attendance.
5. **Send messages.** No skill may dispatch a notification, email or message on behalf of the system.
6. **Decide security outcomes.** A skill may report a finding; only a human accepts residual risk.

## 5. Fallback working mode (currently in force)

Because no skills are available, agents operate exactly as `AGENTS.md` prescribes:

1. Read `AGENTS.md` §1–§2 and run the ten-step pre-change checklist manually.
2. Use `TASKS.md` Part A blocks as the work contract.
3. Use the repository's own tooling for verification (lint rules `T-ARCH-002/003`, docs gate
   `T-DOCS-001`, the test layers in `TESTING.md`).
4. Treat §3 above as a checklist to walk by hand for each change: skeleton audit, traceability,
   references, migration safety, privacy, test gaps, concurrency cases.

The absence of skills is **not** an excuse to reduce rigour: every check in §3 is specified well enough
to be executed manually, and each has an owning task (`T-ARCH-003`, `T-DOCS-002`, `T-SEC-*`,
`T-PRIV-*`, `T-TEST-*`).

## 6. Maintenance of this file

- Re-run §1 whenever the working environment changes, and update the inspection result with the date.
- Add a §2 record only for a skill that was actually discovered, with its exact name and source.
- Delete records for skills that disappear; never leave a stale entry implying availability.
- If a capability from §3 remains unfilled for two consecutive roadmap slices, convert it into a
  repository script or lint rule instead of hoping for a skill — verification belongs in CI.
