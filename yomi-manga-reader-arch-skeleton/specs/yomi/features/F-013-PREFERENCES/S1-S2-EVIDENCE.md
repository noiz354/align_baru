# F-013-S1+S2 — ACCEPTANCE: the orphaned table gets an owner

## A1 — What shipped

`ReaderPreferenceRepository` over the existing table (no migration — the table,
its PK, its CHECKs and its defaults already say what the code says), a
`PreferenceService` owning validation and defaults, `GET`/`PUT
/api/preferences` on the members' seam, and the reader consuming
`autoNextChapter`: on the last page, Next becomes a next-chapter link when the
preference is on (and a next chapter exists), and stays disabled at the end
when it is off.

- [x] GET returns stored values or the documented defaults on first read — and
  the read never writes (asserted against the table, not just the answers)
- [x] PUT validates every field with the field named, mirroring the 2 CHECKs
  plus the contract's zoom range; partial (named replace, unnamed stay)
- [x] the route is self-scoped only: the caller's own row, no id in the path,
  no user in the body, never admin-gated — safe while the guard is deferred
- [x] the reader consumes `autoNextChapter`, visibly: the last-page control
  changes with the preference
- [x] `reader-behavior.md` no longer describes zoom, auto-advance, modes or
  settings as live: three settings marked STORED-not-applied, auto-advance
  corrected to what exists, the settings UI marked absent

## A2 — Three scoping decisions

**No `/settings` page.** The acceptance's Files line names `app/settings/`,
but F-014 owns the settings UI and the auth deferral owns F-014. A settings
page without a guard would render for anonymous users and write through an API
that 401s them — not unsafe, but half a feature. The API contract is what a
future form will write through, which is why validation already names fields.
Recorded, not silently dropped.

**`autoNextChapter`, not zoom or mode.** Zoom needs a zoom UI, mode needs
multi-mode rendering, direction needs layout work — each a project. Auto-next
needs the last-page control to branch on a boolean the client already fetches
neighbours alongside. It is the only preference consumable without building its
feature, and consumption without its feature is exactly what the acceptance
forbids pretending.

**Anonymous and failed reads fall back to defaults, not to disabled.** A
preferences outage must not trap a reader on the last page of a chapter, and
the documented default IS true. Failing closed would punish the reader for the
server's problem.

## A3 — Mutations

| Injected | Result |
|---|---|
| the zoom range check removed | 2 tests fail |
| the boolean type guard removed | 1 test fails |
| `get` inserts a row (read that writes) | 1 test fails — after adding the missing test (see below) |
| the route takes `userId` from the body | 1 test fails |

The read-that-writes initially passed: comparing two reads proves the answers
agree, not that nothing was written. The test now selects from the table
directly. An invariant asserted only through its own output is not asserted.

## A4 — Gates

- [x] 774 → **788 passed (788)** (14 new: 7 route, 7 repository+service)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## A5 — What is NOT claimed

- The `/settings` page (F-014, deferred). The API it will write through exists
  and is tested.
- Zoom, mode or direction consumed anywhere. Stored, validated, served —
  explicitly not applied, and the docs say so per setting.
- Browser verification of the auto-next link: the control renders from fetched
  state through the same path the neighbour links use, but no browser run
  confirmed the last-page swap (the harness limitation recorded in F-012
  applies — and this time it is written down BEFORE shipping, not discovered
  after).

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-013-S1+S2 |
| Files | `features/reader-preferences/` (port+service+index), `server/db/repositories/preference.repository.ts`, `app/api/preferences/route.ts`, reader consumption, `reader-behavior.md` corrected, 2 tests |
| Tests | +14 |
| Mutations | 4 of 4 caught (one after adding the missing test the first round exposed) |
| Commands | 4 mutations · full regression gates · `next build` |
| Notes | The table is no longer orphaned: stored, served, validated, and — for auto-next — visibly consumed. Everything else it stores is honestly marked as such. |
