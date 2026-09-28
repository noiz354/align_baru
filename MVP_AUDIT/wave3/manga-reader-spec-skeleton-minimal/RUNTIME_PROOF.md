# Minimal Reader Wave3 RUNTIME_PROOF

## Authenticated progress and restore

- Runtime data used the existing file-backed `data/db.json`; both test users used real login cookies and server-derived identity.
- Seeded chapter `ch-001` has 12 pages; the saved page `4` is within range.
- Reader A (`usr-reader-a`) saved `pageNumber: 4` (`prog-1790575240729`). Reader B (`usr-reader-b`) independently saved `pageNumber: 1` (`prog-1790575241164`). Their keys are `usr-reader-a:ch-001` and `usr-reader-b:ch-001`.
- A logged out and back in; progress restored to page 4. After an application restart, A still restored page 4 and B still restored page 1.
- A request that supplied another `userId` did not change A's saved progress; the server used the authenticated session identity.

## Negative paths

- Unauthenticated progress read/write → `401`.
- Page 13 for the 12-page seeded chapter → `422`; no clamping or invalid saved position.
- B's session plus a spoofed A `userId` did not permit reading or changing A's progress.

## Checks

- `npm run typecheck` → pass.
- `npm test` → **15 tests passed**.

No runtime database or session data is included in this evidence. Earlier illustrative mockup images were removed; no actual browser screenshots were captured for this run.