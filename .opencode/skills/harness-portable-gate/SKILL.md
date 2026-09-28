---
name: harness-portable-gate
description: Use when designing or repairing a test/build gate that must run in a constrained environment — no Docker, no daemon, tight memory, an offline or partial CDN. Covers what to make conditional, what to keep unconditional, and how to report a capability that cannot run.
---

# Designing a gate that survives a constrained machine

A gate that assumes a service is a gate that will be skipped, and a gate that is
silently skipped is worse than no gate. Design for the machine you actually have.

## The three questions, in order

Before choosing what a gate runs, answer these. Skipping to "which commands" is how
gates get built against a fantasy environment.

1. **What does this need that might be absent?** A daemon, a container, a browser
   download, a specific runtime version, a port.
2. **What is the honest fallback?** An in-process substitute, a graceful skip, or
   nothing.
3. **If it is skipped, will the output say so?** If not, the gate is a lie.

## Substitute before you skip

Skipping is the last resort, not the first. Reaching for a real substitute is usually
cheap and turns a dead gate into a live one:

| Absent | Substitute | Note |
|---|---|---|
| Postgres | `@electric-sql/pglite` (in-process WASM) | real SQL semantics, no daemon, no Docker |
| Postgres | `describe.skipIf(!isAvailable())` | honest, but the gate is now unrun — say so in the summary |
| S3 | a filesystem adapter behind the same port | keeps the port contract under test |
| System browser | a registry-packaged headless browser | note the RAM cost; it is often the largest single item |
| Node 24 | run on 22 and record the warning | only after you have seen it boot |

`majelishub` runs its integration suite on pglite. `manga-reader` has no database
dependency at all. `yomi` skips its DB suite when `DATABASE_URL` is unset and says
"catalog unavailable" instead of crashing. Each of those is a deliberate choice, and
each is better than a suite that fails when a daemon is missing.

## Report the condition, not a boolean

A preflight that prints `ok: true` teaches a reader nothing they did not already
assume. Print the state and the reason:

```
ABSENT  service / s3   nothing on 9000 (connection refused) — yomi S3 adapter must be skipped
WARN    yomi / engines running node 22, package asks >=24 — audit shows it boots with a warning
```

Three rules make this trustworthy:

1. **Derive the requirement from the project.** Read `engines` from the project's own
   `package.json`. A hardcoded "Node 24 required" becomes a lie when the project
   changes, and nothing will tell you but a failing run.
2. **Distinguish FAIL from WARN from ABSENT.** A warning that does not fail the build
   is a judgement call; write down the evidence that justifies it. `Node 22 boots`
   is evidence. `should be fine` is not.
3. **Test the reporter.** Introduce a deliberate fault and confirm it is reported. A
   checker that has never been seen to fail is not known to work — it is untested.

## Ordering under a tight budget

Cheap and decisive first, because each later stage costs more and covers less:

1. **Static** — types, lint, boundaries, token checks. Seconds. Catches the most.
2. **Unit** — no external state. Catches logic.
3. **Boot smoke** — does the app start at all. This is where a duplicate dynamic-route
   folder shows up, and it costs one process launch rather than a browser suite.
4. **Integration** — persistence paths, with the substitute from the table above.
5. **E2E** — only when the preflight says a browser exists. Record the browser's
   footprint in the summary, because a 200 MB download is a real cost decision.

A gate that runs 1–3 honestly is worth more than one that claims 1–5 and quietly
did 1.

## The trap

Booting is not working. A route that returns 200 is not evidence its controls are
hittable, and an app that starts is not evidence a feature does. Report the layer you
actually exercised, and name the layer you skipped.
