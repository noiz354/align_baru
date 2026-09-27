# Licensed Manga Reader — partial implementation

Specification and architecture baseline for a reader serving only legally owned, licensed, or otherwise authorized works. A sample-data reader, page math, route handlers and in-memory catalog were added after the architecture phase; **the full product specification is not implemented**. See [PRD](PRD.md), [architecture](ARCHITECTURE.md), [tasks](TASKS.md), and [agent rules](AGENTS.md).

## Phase boundary and current gaps
The reader can render a sample chapter, but the sample/in-memory persistence is not production storage, authorization is not enforced on admin routes, and upload/image processing, durable progress and the complete E2E suite remain unfinished. The task register has not yet been reconciled task-by-task with this implementation. Do not mistake a passing 15-test subset for full product coverage. Future implementation follows TASKS.md in roadmap order after review of requirements and ADRs.

## Stack direction
Node.js 24 LTS; strict TypeScript; stable Next.js App Router + compatible stable React; PostgreSQL; Drizzle ORM (selected subject to pinned compatibility review); S3-compatible private object storage; Sharp (planned); Zod; OpenTelemetry stable traces/metrics; Vitest, Playwright; Docker and GitHub Actions. Exact major/minor versions are deliberately deferred to implementation kickoff lockfile and revalidation (see research).

## Start here
1. Read AGENTS.md and final review.
2. Read PRD and relevant ADR/task.
3. Treat contracts/docs as authoritative; do not infer behavior beyond them.
4. Do not turn TODO skeletons into features outside an authorized task.
