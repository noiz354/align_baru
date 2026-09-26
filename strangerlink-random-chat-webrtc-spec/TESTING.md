# StrangerLink — Testing Strategy

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [QA.md](QA.md), [docs/testing/MATRIX.md](docs/testing/MATRIX.md), [ROADMAP.md](ROADMAP.md)

> **Only `describe.todo` skeletons exist.** No test is implemented. This document defines
> what will be tested, by which layer, and why.

---

## 0. Testing principles

| Principle | Detail |
| --- | --- |
| Safety tests are first-class | A missing safety test blocks a slice |
| Test the invariant, not the implementation | Especially for concurrency |
| Real transports where it matters | WebSocket and WebRTC tests use real browsers and real sockets |
| Deterministic media | Playwright's fake device flags make camera/mic scenarios testable without hardware |
| No content in test fixtures | Fixtures use synthetic content; no real conversations |
| Every race has a test | R1–R12 and C1–C6 in the state machine and chat specs |

---

## 1. Test layers

### 1.1 Unit tests (Vitest)

**Scope:** pure domain logic, invariants, validation, state transitions, reducers.

| Area | Examples |
| --- | --- |
| Domain invariants | One active session per participant; exactly two distinct participants |
| State machine | Every valid transition; every invalid transition is rejected |
| Validation schemas | Every Zod schema accepts valid input and rejects malformed input |
| Rate limit logic | Window arithmetic, progressive cooldown ladder |
| Report dedup | (session, category) collapsing |
| Ban expiry | Expiry boundaries |
| Trace attribute allowlist | Rejects content and address keys |
| Logging helper allowlist | Rejects disallowed keys |

**Location:** `tests/unit/`

### 1.2 Integration tests (Vitest)

**Scope:** module boundaries with real dependencies where feasible.

| Area | Examples |
| --- | --- |
| Repository ports | Against a real PostgreSQL instance in Docker |
| API boundaries | Authorization matrix; every endpoint rejects an unauthorized caller |
| Retention job | Expired rows are deleted; a failed run is detectable |
| Ban enforcement | Every enforcement point consults the ban port |
| Schema guard | No message-content column exists; no module outside `src/server/db` imports a driver |

**Location:** `tests/integration/`

### 1.3 Realtime protocol tests (Vitest, real `ws`)

**Scope:** the signaling protocol against a real WebSocket server in-process.

| Area | Examples |
| --- | --- |
| Envelope validation | Malformed frames rejected |
| Impersonation | `fromParticipantId` mismatch rejected, connection closed, safety event raised |
| Cross-session injection | A message to a non-participant is not delivered |
| Replay | Duplicate `messageId` dropped |
| Reordering | Out-of-order `sequence` handled |
| Reconnect | Stale session id rejected; valid reconnect resumes |
| Supersession | A second socket supersedes the first |
| Rate limits | Frame and action limits enforced |
| Payload caps | Oversized frames rejected |

**Location:** `tests/realtime/`

### 1.4 WebSocket tests

Subset of §1.3, plus:

| Area | Examples |
| --- | --- |
| Handshake auth | Unauthenticated upgrade refused |
| Origin allowlist | Disallowed origin refused |
| Heartbeat | Zombie sockets terminated |
| Connection cap | Excess connections refused |
| Graceful drain | In-flight frames complete before shutdown |

### 1.5 WebRTC browser tests (Playwright + Vitest browser mode)

**Scope:** media behaviour in real browsers.

| Area | Examples |
| --- | --- |
| Permission granted | Media becomes active |
| **Camera denied** | Specific recoverable state; text chat continues |
| **Microphone denied** | Same |
| Device switching | `replaceTrack` with a second device |
| Camera disappears mid-session | Media state → failed; session continues |
| Connection establishment | Offer/answer completes |
| **ICE restart** | On network change |
| **TURN fallback** | Forced relay path |
| ICE timeout | Specific failure state |
| Track cleanup | All tracks stopped on session end, in every exit path |
| No recording | No `MediaRecorder` call in any code path (static analysis) |

Playwright flags used: `--use-fake-device-for-media-stream`,
`--use-fake-ui-for-media-stream`, and permission overrides for denied scenarios.

**Location:** `tests/realtime/` (protocol) and `tests/e2e/` (browser journeys)

### 1.6 End-to-end tests (Playwright)

**Scope:** full user journeys across two browser contexts.

| Journey | Assertions |
| --- | --- |
| Landing → age gate → mode → queue → matched | Consent gates block direct navigation |
| Full text chat between two peers | Messages delivered and ordered |
| Skip → requeue | New session created; old session terminal |
| Report from an active session | Report accepted; session ends; peer not informed |
| **Report after peer disconnect** | Report still accepted (FR-REPORT-002) |
| Block → requeue | Blocked peer not rematched |
| Direct URL to `/chat/<id>` | Redirected to entry |
| Two tabs, one identity | Older tab superseded |
| Every disconnect state | Correct copy shown |
| Rate limit / cooldown | Honest message shown |
| Accessibility | axe scan on every page; keyboard-only walkthrough |

**Two-context testing** is essential: most of the interesting behaviour requires two real
browsers.

**Location:** `tests/e2e/`

### 1.7 Security tests

| Area | Tool | Examples |
| --- | --- | --- |
| XSS | Playwright payload suite | Every input rejects script payloads |
| CSRF | Integration | Mutating request without a token rejected |
| SQL injection | Integration payload suite | No injection succeeds |
| IDOR | Authorization matrix | Every endpoint rejects a non-owner |
| Open redirect | Integration | External redirect target rejected |
| Admin escalation | Integration | Non-admin and lower-privilege moderator rejected |
| Secret leakage | CI scan + bundle inspection | No secret in the client bundle |
| Dependency | CI | Critical CVE blocks release |
| TURN relay restriction | Staging smoke test | Relay to a private range fails |

### 1.8 Moderation flow tests

| Area | Examples |
| --- | --- |
| Report → case | Case created with correct severity |
| P0 routing | Bypasses the normal queue; on-call paged |
| Ban → enforcement | Banned identity refused at every entry point |
| Ban store down | **Fails closed** — no matches |
| Appeal | Reviewed by a different moderator; audited |
| Audit completeness | No action without an audit record |
| Report dedup | Duplicate collapsed |
| Report credibility | An identity reporting many peers is down-weighted |

### 1.9 Accessibility tests

| Area | Tool |
| --- | --- |
| axe scan on every page | Playwright + axe-core |
| Keyboard-only walkthrough of every journey | Scripted Playwright |
| Contrast on design tokens | Automated |
| Touch target sizes | axe rule |
| Focus management | Automated + manual |
| Live region announcements | Manual (NVDA, VoiceOver, TalkBack) |
| Reduced motion | Automated |

**CI gate: zero critical violations.**

### 1.10 Load tests

| Test | Goal | Phase |
| --- | --- | --- |
| WebSocket connection ramp | Validate per-connection resource budgets | VS-15 |
| Match throughput | Validate the match rate target | VS-15 |
| Message flood | Validate rate limits hold | VS-13 |
| Queue join/leave storm | Validate race handling under load | VS-3 |
| TURN saturation | Validate quotas and alerting | VS-11 |
| Report flood | Validate credibility weighting | VS-12 |
| Realtime restart under load | Validate graceful drain | VS-15 |

---

## 2. Test skeletons in this repository

All existing test files contain only `describe.todo` calls. Examples:

```typescript
describe.todo("does not match a participant who has left the queue");
describe.todo("prevents one participant from entering two active sessions");
describe.todo("does not immediately rematch blocked participants");
describe.todo("ends session when peer disconnects");
```

These are placeholders that assert the **intent** is known. They fail loudly if run, which
is the point: an unimplemented test should not silently pass.

---

## 3. CI pipeline

```
typecheck ──► lint ──► unit ──► integration ──► build ──► bundle budget
                                                       ──► Playwright (a11y + e2e)
                                                       ──► security scan
                                                       ──► dependency audit
```

| Gate | Blocks release? |
| --- | --- |
| Typecheck | Yes |
| Lint (incl. `dangerouslySetInnerHTML`, `server-only` import) | Yes |
| Unit | Yes |
| Integration | Yes |
| Bundle budget exceeded | Yes |
| Critical accessibility violation | Yes |
| Security test failure | Yes |
| Critical dependency CVE | Yes |
| Load test | No (informational until VS-15) |

---

## 4. Coverage targets

| Area | Target |
| --- | --- |
| `src/domain/**` | 90% line, 80% branch |
| `src/shared/contracts/**` | 95% line |
| `src/server/**` ports | 80% line |
| `src/features/**` | 70% line |
| `src/app/**` | Shells only; coverage not meaningful |

Coverage is a signal, not a target to game. A safety invariant with a test is worth more
than a high number.

---

## 5. Test data policy

| Rule | Detail |
| --- | --- |
| Synthetic content only | No real conversations, ever |
| No real IPs | Fixtures use RFC 5737 documentation ranges |
| No real identities | All participant ids are generated |
| No production data | Staging uses anonymised data only |
| Fixture review | Fixtures touching safety flows are reviewed by Trust & Safety |

---

## 6. Implementation status

Skeletons exist in `tests/unit/`, `tests/integration/`, `tests/realtime/`, and
`tests/e2e/`. No test is implemented. Tracked across VS-0 … VS-15 in
[TASKS.md](TASKS.md).
