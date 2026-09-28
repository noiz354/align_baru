# FEATURE REALITY MATRIX

Derived from code, not from `TASKS.md` feature names. Feature names come from the implemented module
tree and the shipped routes.

Legend: `YES` works end to end · `PARTIAL` works for the happy path only · `NO` absent ·
`FAKE` returns success without doing the work · `HARDCODED` constants in place of data ·
`IN_MEMORY` state lost on restart · `BROKEN` exists but errors.

"User usable?" is the only column that decides anything.

## siomayops-streetfood-stall-ops-spec

| Feature | Backend | UI | Persistence | Auth | Validation | Failure handling | Test | User usable? |
|---|---|---|---|---|---|---|---|---|
| Start shift + opening float | YES | YES | IN_MEMORY | **FAKE** | YES (zod) | YES | YES | **NO** — no real identity |
| Record cash sale, change calc | YES | YES | IN_MEMORY | **FAKE** | YES | YES | YES | **NO** |
| Sale idempotency (`clientSaleId`) | **PARTIAL** | n/a | IN_MEMORY | FAKE | YES | silent skip when no `Idempotency-Key` | YES | NO |
| Price resolution LOCATION>AREA>ORG | YES | YES | IN_MEMORY | FAKE | YES | YES (AMBIGUOUS, NOT_SELLABLE) | YES | NO |
| Digital payment, webhook verify | YES | n/a | IN_MEMORY | FAKE | YES | YES — HMAC + `timingSafeEqual`, fail-closed | YES (7 cases) | NO |
| QRIS settlement | **NO** (by design) | n/a | — | — | — | raises, cannot reach PAID | YES | n/a — correct refusal |
| Stock movements & derived positions | YES | YES | IN_MEMORY | FAKE | YES | YES (variance requires reason) | YES | NO |
| Expense review state machine | YES | YES | IN_MEMORY | FAKE | YES | YES (reason required) | YES | NO |
| Close shift + cash reconciliation | YES | YES | IN_MEMORY | FAKE | YES | YES (immutable, idempotent) | YES | NO |
| HQ dashboard, 10 cards | YES | YES | IN_MEMORY | FAKE | n/a | n/a | YES | NO |
| Loyalty redeem | YES | YES | IN_MEMORY | FAKE | YES | YES (single-use, concurrent-safe) | YES | NO |
| Incidents | YES | YES | IN_MEMORY | FAKE | YES | YES | YES | NO — **writable unauthenticated** |
| Offline outbox | YES | YES | IN_MEMORY | FAKE | n/a | n/a | YES | NO |
| Transactions / DB | **NO** | — | IN_MEMORY | — | — | — | — | NO |
| Operator authentication | **NO** | **NO** | — | **FAKE** | — | — | none | **NO** |

## homeops-household-manager-spec

| Feature | Backend | UI | Persistence | Auth | Validation | Failure handling | Test | User usable? |
|---|---|---|---|---|---|---|---|---|
| Sign in / sign up / reset / invite | YES | YES | REAL_DATABASE | — | YES | 401 | skeleton | PARTIAL |
| Household + members | PARTIAL | YES | REAL_DATABASE | **BROKEN** | — | — | skeleton | **NO** |
| Room list / detail | YES | YES | **BROKEN on deploy path** | **BROKEN** | minimal | `500` | none | **NO** |
| Chore list / Today | YES | YES | **BROKEN on deploy path** | **BROKEN** | minimal | `500` | none | **NO** |
| Complete chore + next occurrence | YES | YES | **BROKEN on deploy path** | **BROKEN** | minimal | `500` | none | **NO** |
| Recurrence DAILY/WEEKLY/MONTHLY | YES | n/a | BROKEN | BROKEN | no | no | none | NO |
| Issues / maintenance / trash / resources / alerts | page shells | YES | n/a | BROKEN | no | no | none | NO |
| Authorization enforcement | **NO** (`throws Not implemented: T-AUTH-005`, 0 callers) | — | — | — | — | — | none | **NO** |
| Row-level security | **NO** (0 of 17 tables) | — | — | — | — | — | none | **NO** |
| Household isolation | **NO** (`?householdId=` decides) | HARDCODED id in pages | — | — | — | — | none | **NO** |
| Design tokens / contrast | **NO** (inline `style={{}}`) | PARTIAL | — | — | — | — | none | NO |

## majelishub-pengajian-event-platform-spec

| Feature | Backend | UI | Persistence | Auth | Validation | Failure handling | Test | User usable? |
|---|---|---|---|---|---|---|---|---|
| Identity (Better Auth) | YES | shells | REAL_DATABASE | YES | lib | 401 | YES (8 pass on real PG) | PARTIAL |
| Organizations + memberships | YES | n/a | REAL_DATABASE | YES | — | 404 | YES | **NO** — header identity elsewhere |
| Mosque CRUD | YES | PARTIAL (unscoped) | REAL_DATABASE | **BROKEN** on public page | none | `catch → []` | none | NO |
| Event list (public) | YES | **BROKEN** | REAL_DATABASE | **none** | none | `catch → []` | none | **NO** |
| Event detail (public) | YES | **BROKEN** (slug not tenant-unique) | REAL_DATABASE | none | none | `catch → []` | none | NO |
| Event create (organizer) | YES | demo form | REAL_DATABASE | **BROKEN** (header) | manual | 400/403 | none | **NO** |
| Permission matrix (9×53) | YES | n/a | — | YES | — | 403 / 404 | YES | n/a — the strongest asset |
| Row-level security | **YES** | — | REAL_DATABASE | — | — | fail-closed | YES (5 pass on real PG) | YES |
| Audit chain (hash-linked) | YES | shell | REAL_DATABASE | — | — | rollback on failure | YES on PG, 1 fail | PARTIAL |
| Attendance registration | YES | shells | REAL_DATABASE | public by design | YES | 404/422/409 | **none** | NO |
| QR/token check-in | YES | shells | REAL_DATABASE | YES | YES | 401/403/404/409 | **none** | NO |
| Check-in summary (attendee list) | YES | shell | REAL_DATABASE | YES | uuid | 401/404 | none | NO |
| Audio / transcription / notifications | **NO** (`Not implemented` shells) | shells | — | — | — | throws | 281 todos | NO |
| Observability allow-list + token ban | YES | — | — | — | — | drop at runtime | YES | YES |

## strangerlink-random-chat-webrtc-spec

| Feature | Backend | UI | Persistence | Auth | Validation | Failure handling | Test | User usable? |
|---|---|---|---|---|---|---|---|---|
| Age gate + consent | YES | YES | IN_MEMORY | n/a | YES | redirect | YES | **YES** |
| Queue join/cancel/expire | YES | YES | IN_MEMORY | pseudonymous | YES | honest cooldown | YES (8) | **YES** |
| Matchmaking (ban, cooldown, preferences, recent-peer) | YES | via queue | IN_MEMORY | pseudonymous | YES | typed reasonClass | YES (13) | **YES** |
| Text chat | YES | YES | IN_MEMORY buffer | pseudonymous | YES | session end | YES (8) | **YES** |
| Signaling over WebSocket | YES | YES | process singleton | handshake check | YES | — | YES (8) | YES, single process only |
| WebRTC peer connection | PARTIAL (native synthetic audio) | PARTIAL | — | — | — | — | YES (6) | **PARTIAL** — no real mic, no TURN |
| Report + escalation | YES | — | **IN_MEMORY** | participant check | YES | rate limit 5/h | YES (13) | PARTIAL — history lost on restart |
| Ban enforcement | YES | — | **IN_MEMORY** | — | — | fail-closed | YES (4) | PARTIAL — restart clears bans |
| Admin moderation authorization | YES | **NO UI** | IN_MEMORY | MFA flag | — | — | YES | **NO** — no admin surface |
| TURN credentials | PARTIAL (env secret stub) | n/a | — | banned refused | — | fail-closed in prod | — | NO |
| Lint gate | **NO** (`eslint` not installed, exit 127) | — | — | — | — | — | — | — |

## manga-reader-spec-skeleton-minimal

| Feature | Backend | UI | Persistence | Auth | Validation | Failure handling | Test | User usable? |
|---|---|---|---|---|---|---|---|---|
| Catalog list (published only) | YES | YES | LOCAL_FILE | none (public) | — | — | YES | **YES** |
| Chapter reader, 3 modes, RTL/LTR | YES | YES | LOCAL_FILE | none (public) | — | clamp | YES (13) | **YES** |
| Page window (bounded ≤12) | YES | YES | — | — | — | clamp | YES | YES |
| Sign in / session | YES | YES | **IN_MEMORY** | YES | minimal | 401 | none | PARTIAL — logout on restart |
| Reading progress (per user) | YES | YES | LOCAL_FILE | YES (correct) | page range | 401/404/422 | **never executed** | **PARTIAL** — one machine only |
| **Admin catalog** | **NO write API** | pages exist | — | **NONE** | — | — | none | **NO** — unauthenticated surface |
| Upload pipeline | **NO** | page shell | — | NONE | — | — | none | NO |
| E2E suite | **NO** | — | — | — | — | — | not run | NO |
| Lint gate | **NO** (no script) | — | — | — | — | — | — | — |

## parking-attendant-ops-app-spec

| Feature | Backend | UI | Persistence | Auth | Validation | Failure handling | Test | User usable? |
|---|---|---|---|---|---|---|---|---|
| Open/close shift, cash reconciliation | YES | **NO** | REAL_DATABASE (SQLite) | PIN for sensitive ops | YES | variance reason required | YES | **NO** — no UI |
| Vehicle check-in + slot assignment | YES | **NO** | REAL_DATABASE | — | plate normaliser | YES | YES | NO |
| Fee calculation (grace, hourly, cap, fine) | YES | **NO** | REAL_DATABASE | — | YES | tamper-resistant clock | YES | NO |
| Cash checkout + change | YES | **NO** | REAL_DATABASE | — | underpay rejected | YES | YES | NO |
| QRIS settlement | **NO** (by design) | — | — | — | — | **raises, cannot reach PAID** | YES | n/a — correct refusal |
| Lost-ticket flow | YES | **NO** | REAL_DATABASE | supervisor PIN | STNK/KTP | refuses non-CASH | YES | NO |
| Photo evidence + 30-day purge | YES | **NO** | REAL_DATABASE + file | — | — | frozen while incident open | YES | NO |
| Incident reporting | YES | **NO** | REAL_DATABASE | — | — | — | YES | NO |
| Transactional outbox | YES | **NO** | REAL_DATABASE | — | — | drained on reconnect | YES | NO |
| Audit ledger (hash-chained) | YES | **NO** | LOCAL_FILE (jsonl) | — | — | append-only | YES | NO |
| Edge OCR | **NO** (abstract port) | — | — | — | — | `NotImplementedError` | mock only | NO |
| Watchlist check | **NO** (returns `None`) | — | — | — | — | — | none | NO |
| Operator UI | **NO** (never committed) | — | — | — | — | — | — | — |

## rsi-agent-recursive-self-improvement-prototype

| Feature | Backend | UI | Persistence | Auth | Validation | Failure handling | Test | User usable? |
|---|---|---|---|---|---|---|---|---|
| BRS/DRS exploration → freeze → holdout eval | YES | CLI + text report | `runs/` (regenerable) | n/a | n/a | step-budget fails closed | YES (147) | **YES** (offline) |
| Bounded improvement loop, human-gated | YES | CLI | `runs/` + `audit.jsonl` | human approver for HIGH/CRIT | risk levels | escalate when no approver | YES | **YES** |
| Repository apply/rollback with exact tree hash | YES | CLI | `baseline-*.json` | protected paths CRITICAL | path policy | refuse + escalate | YES | YES (offline) |
| Live LLM provider | **NO** (mock only, by declaration) | — | — | — | — | fails closed without key | mocks | n/a — correctly out of scope |
