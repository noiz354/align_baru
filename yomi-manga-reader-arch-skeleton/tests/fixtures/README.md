# Test fixtures (skeleton)

**Authority:** TEST_STRATEGY.md §6. This directory holds the deterministic
fixtures the test suites reference. No binary files are committed in the
architecture phase — they are generated/added by the first test tasks.

| Fixture | Used by (canonical test IDs) | Task | Notes |
| --- | --- | --- | --- |
| `images/sample-pages/` (~50 normalized pages) | E2E-ADMIN-001, INT-UP-001 | T-UPLOAD-010 | generated at test setup from the reference page set |
| `images/exif-gps.jpg` | INT-UP-001 (normalization leg) | T-UPLOAD-004 | EXIF with GPS + ICC profile — must come out stripped |
| `images/oversize-9999px.png` | INT-UP-001 (dimension guard leg) | T-UPLOAD-004 | 9999×9999 — must trip the pre-decode guard |
| `images/script-as-jpg.jpg` | INT-UP-001 (spoofed-MIME leg) | T-UPLOAD-004 | bytes that are not an image, extension .jpg |
| `zip/valid-30.zip` | INT-UP-001, E2E-ADMIN-001 | T-UPLOAD-010 | 30 pages, in-order names (the plan's reference upload) |
| `zip/zip-slip.zip` | INT-UP-001 (T-08 leg) | T-UPLOAD-002 | `../../etc/passwd` entry — must be rejected |
| `zip/decompression-bomb.zip` | INT-UP-001 (T-09 leg) | T-UPLOAD-002 | 500 MB expanded — must be rejected |
| `pg/seed-small.sql` | INT-SEARCH-001, schema assertions (T-FOUND-006) | T-FOUND-006 | minimal manga/chapter seed (descriptive; written with the migration task) |
| `users/admin.json` / `users/reader.json` | E2E suites (auth/admin legs) | T-PROD-002 | env-driven test identities (no secrets in fixtures) |

Rules:
- Fixtures are deterministic (no timestamps/random content inside).
- Binary generation happens in test setup, not in the repo (size cap).
- No real user data, ever.
- Attack fixtures map to THREAT_MODEL rows T-08/T-09/T-10 — each leg
  must end with a typed error code and zero side effects (INT-UP-001).
