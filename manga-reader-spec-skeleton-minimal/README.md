# Licensed Manga Reader — architecture phase

Specification and architecture baseline for a reader serving only legally owned, licensed, or otherwise authorized works. **No product feature is implemented.** See [PRD](PRD.md), [architecture](ARCHITECTURE.md), [tasks](TASKS.md), and [agent rules](AGENTS.md).

## Phase boundary
This repository contains requirements, decisions, contracts, and non-functional skeletons only. No auth, persistence, handler, storage, image pipeline, navigation, UI, migration, or integration is operational. Future implementation is authorized solely through TASKS.md, in roadmap order, after review of requirements and ADRs.

## Stack direction
Node.js 24 LTS; strict TypeScript; stable Next.js App Router + compatible stable React; PostgreSQL; Drizzle ORM (selected subject to pinned compatibility review); S3-compatible private object storage; Sharp (planned); Zod; OpenTelemetry stable traces/metrics; Vitest, Playwright; Docker and GitHub Actions. Exact major/minor versions are deliberately deferred to implementation kickoff lockfile and revalidation (see research).

## Start here
1. Read AGENTS.md and final review.
2. Read PRD and relevant ADR/task.
3. Treat contracts/docs as authoritative; do not infer behavior beyond them.
4. Do not turn TODO skeletons into features outside an authorized task.
