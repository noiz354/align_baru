# Minimal Wave3 READINESS

**Wave2:** `MVP_PARTIAL` (df0e396) — durable reader progress existed but had no authenticated identity or per-user isolation.

**Wave3:** `MVP_PARTIAL` (no promotion)

**Proven in this narrow slice:**

- A saves page 4 and B independently saves page 1 in seeded chapter `ch-001` (12 pages); spoofing `userId` does not cross or overwrite records.
- Logout/login and application restart preserve both users' progress.
- Unauthenticated access returns 401; an out-of-range page returns 422.
- `npm run typecheck` passes; `npm test` reports 15 passing tests.

**Scope boundary:** no large admin/upload system was added. The wider product's catalog administration, upload, and publishing work remain outside this progress-persistence slice, so readiness remains `MVP_PARTIAL` rather than implying that work is complete.

**Evidence:** `MVP_AUDIT/wave3/manga-reader-spec-skeleton-minimal/{BASELINE,IMPLEMENTATION,RUNTIME_PROOF,FAILURE_CASES,READINESS.md}`. Runtime DB/session data and illustrative mockups are not included; no actual browser screenshot was captured.

**Implementation commit:** `0fd4b3b feat(minimal-reader): add authenticated user-owned progress`.