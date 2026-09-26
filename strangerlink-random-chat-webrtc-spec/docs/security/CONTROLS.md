# StrangerLink — Security Control Checklist

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [SECURITY.md](../../SECURITY.md), [THREAT_MODEL.md](../../THREAT_MODEL.md), [docs/security/CONTROLS.md](CONTROLS.md)

---

## 0. How to use this

This is the operational form of [SECURITY.md](../../SECURITY.md). Every control has an
owner, a verification method, and a slice. A control without a verification method is not a
control.

---

## 1. Application controls

| ID | Control | Threat | Verification | Slice |
| --- | --- | --- | --- | --- |
| AC-1 | Text-only message rendering; no `dangerouslySetInnerHTML` (lint rule) | T-14 | Lint gate + XSS payload suite | VS-4 |
| AC-2 | Strict CSP without `unsafe-inline` / `unsafe-eval` | T-14 | Header assertion in E2E | VS-0 |
| AC-3 | Zod validation at every untrusted boundary | T-14, T-16, T-17 | Schema tests | VS-0 |
| AC-4 | CSRF tokens on mutating requests | T-15 | Integration test | VS-1 |
| AC-5 | `SameSite=Lax` or stricter cookies | T-15 | Cookie assertion | VS-1 |
| AC-6 | Origin verification on mutating requests | T-15, T-07 | Integration test | VS-1 |
| AC-7 | Custom-header requirement on API mutations | T-15 | Integration test | VS-1 |
| AC-8 | Parameterised queries only; SQL confined to `src/server/db/` | T-16 | Driver-import test + injection suite | VS-1 |
| AC-9 | Least-privilege database role; no DDL, no `AuditEvent` writes | T-16 | Role review | VS-7 |
| AC-10 | Server-side authorization on every request; never middleware alone | T-17, T-19 | Authorization matrix test | VS-1 |
| AC-11 | Unguessable `uuidv7` identifiers; never sequential | T-10, T-17 | Unit test | VS-1 |
| AC-12 | Internal-path-only redirects | T-18 | Integration test | VS-0 |
| AC-13 | Inert links; `rel="noopener noreferrer"`; no auto-fetch | T-28 | E2E test | VS-4 |
| AC-14 | Punycode rendered as Unicode | T-28 | Unit test | VS-4 |
| AC-15 | No third-party analytics SDK in the chat surface | T-32 | Network-request inspection in E2E | VS-0 |
| AC-16 | `server-only` guard on `src/server/**` | T-20 | Build failure on violation | VS-0 |
| AC-17 | No secrets in client bundles, logs, images, or errors | T-20 | Secret scan + bundle inspection | VS-0 |

---

## 2. Realtime controls

| ID | Control | Threat | Verification | Slice |
| --- | --- | --- | --- | --- |
| RC-1 | `wss://` only; plaintext refused everywhere | T-07 | Config test | VS-2 |
| RC-2 | Authentication at the HTTP upgrade handshake | T-02, T-07 | Realtime test | VS-2 |
| RC-3 | Origin allowlist at handshake | T-07 | Realtime test | VS-2 |
| RC-4 | `maxPayload` cap (64 KiB) | T-07, T-08 | Realtime test | VS-2 |
| RC-5 | Per-connection frame rate limit | T-07 | Realtime test | VS-2 |
| RC-6 | Per-identity action rate limits | T-24 | Integration test | VS-2 |
| RC-7 | Heartbeat with `terminate()` for zombies | T-33 | Realtime test | VS-2 |
| RC-8 | Per-instance connection cap with alerting | T-33 | Load test | VS-15 |
| RC-9 | Graceful drain exceeding the termination grace period | T-33 | Deploy test | VS-15 |
| RC-10 | `fromParticipantId` must equal the authenticated identity | T-01 | Realtime test | VS-8 |
| RC-11 | Recipient derived server-side; `toParticipantId` forbidden | T-03 | Realtime test | VS-8 |
| RC-12 | `messageId` idempotency per session | T-11 | Realtime test | VS-8 |
| RC-13 | `sequence` monotonicity per direction | T-11 | Realtime test | VS-8 |
| RC-14 | Session ids bound to the authenticated socket | T-02 | Realtime test | VS-8 |
| RC-15 | Stale session ids rejected | T-02, EC-08 | Realtime test | VS-8 |
| RC-16 | Socket supersession on a second connection | T-02, R12 | E2E test | VS-5 |
| RC-17 | Protocol violations close the connection and raise a safety event | T-01, T-10 | Realtime test + alert | VS-8 |

---

## 3. Media and TURN controls

| ID | Control | Threat | Verification | Slice |
| --- | --- | --- | --- | --- |
| MC-1 | DTLS-SRTP; no plaintext RTP | — | Browser-enforced | VS-9 |
| MC-2 | No `MediaRecorder`, stream capture, or upload path (lint rule) | T-30 | Static analysis test | VS-9 |
| MC-3 | All tracks stopped on session end, in every exit path | — | Browser test | VS-9 |
| MC-4 | Media requires an explicit user gesture | — | Browser test | VS-9 |
| MC-5 | Time-limited (minutes) TURN credentials | T-05 | Unit test | VS-11 |
| MC-6 | Credential minting endpoint authenticated and rate limited | T-05, T-06 | Integration test | VS-11 |
| MC-7 | Banned identities refused credential minting | T-05 | Integration test | VS-11 |
| MC-8 | Per-identity and per-server allocation quotas | T-06 | Load test | VS-11 |
| MC-9 | Relay to private/loopback/link-local/metadata ranges blocked | T-05 | Staging smoke test | VS-11 |
| MC-10 | coturn in a dedicated network segment | T-05 | Infrastructure review | VS-11 |
| MC-11 | coturn ≥ 4.5.0.8; TLS 1.2+; hardened flags | T-05 | Config review | VS-11 |
| MC-12 | Per-identity bandwidth accounting with alerting | T-06 | Metric + alert | VS-11 |
| MC-13 | TURN credentials never stored, logged, or placed in a URL | T-20 | Log inspection test | VS-11 |

---

## 4. Safety controls

| ID | Control | Threat | Verification | Slice |
| --- | --- | --- | --- | --- |
| SC-1 | Age gate before any chat capability, including direct URL | — | E2E bypass test | VS-1 |
| SC-2 | Report reachable in every session state | T-13 | E2E test | VS-6 |
| SC-3 | Report accepted against a terminal session | T-13 | Unit test | VS-6 |
| SC-4 | No kill switch or maintenance mode for reporting | — | Config schema test | VS-6 |
| SC-5 | Block reachable and effective | T-27 | E2E + unit test | VS-6 |
| SC-6 | Blocks re-checked at candidate selection | T-27, R5 | Unit test | VS-6 |
| SC-7 | Ban enforcement at every entry point | T-26 | Integration test | VS-7 |
| SC-8 | Ban checks fail closed | T-34 | Chaos test | VS-7 |
| SC-9 | A shared-IP signal can only trigger a rate limit or cooldown | T-26 | Unit test | VS-13 |
| SC-10 | No device fingerprinting | T-30 | Static analysis / dependency review | VS-13 |
| SC-11 | Six distinct disconnect states | NFR-SAFE-001 | E2E test | VS-4 |
| SC-12 | Moderation copy from a fixed allowlist | NFR-SAFE-002 | Unit test | VS-7 |
| SC-13 | Every moderation action audited with a reason code | T-19 | Integration test | VS-7 |
| SC-14 | Admin authorization server-side; MFA; no self-escalation | T-19 | Integration test | VS-7 |
| SC-15 | P0 routing bypasses normal triage and pages | T-29 | Unit test + drill | VS-12 |

---

## 5. Privacy controls

| ID | Control | Threat | Verification | Slice |
| --- | --- | --- | --- | --- |
| PC-1 | No message-content column in the schema | T-30 | Schema guard test | VS-7 |
| PC-2 | No media captured or stored | T-30 | Static analysis test | VS-9 |
| PC-3 | The signaling plane never relays a peer's address | T-12 | Unit test | VS-8 |
| PC-4 | IP-exposure disclosure renders on the media-mode entry path | T-12 | E2E test | VS-10 |
| PC-5 | No name, email, phone, or account collected anywhere | — | Schema review | VS-1 |
| PC-6 | Tracing attribute allowlist with no content or address keys | T-21, T-32 | Unit test | VS-14 |
| PC-7 | Logging helper allowlist | T-21 | Unit test | VS-14 |
| PC-8 | Metric labels restricted to low-cardinality enumerations | T-32 | Cardinality lint | VS-14 |
| PC-9 | Retention job with failure alerting | T-31 | Integration test + drill | VS-15 |
| PC-10 | Data inventory reviewed against every new column | T-30 | Review checklist | ongoing |

---

## 6. Supply chain controls

| ID | Control | Threat | Verification | Slice |
| --- | --- | --- | --- | --- |
| SC-1 | Exact version pinning; committed lockfile | T-22 | CI check | VS-0 |
| SC-2 | `npm audit` / Dependabot; critical blocks release | T-22 | CI gate | VS-0 |
| SC-3 | Framework security releases patched within 72 hours | T-22 | Process + alert | ongoing |
| SC-4 | Base image scanning and scheduled rebuilds | T-22 | CI gate | VS-0 |
| SC-5 | Secret scanning in CI and in images | T-20 | CI gate | VS-0 |
| SC-6 | New dependency requires documented justification | T-22 | Review checklist | ongoing |

---

## 7. Control coverage summary

| Category | Controls | Verified by automated test | Verified by drill or review |
| --- | --- | --- | --- |
| Application | 17 | 15 | 2 |
| Realtime | 17 | 15 | 2 |
| Media and TURN | 13 | 8 | 5 |
| Safety | 15 | 12 | 3 |
| Privacy | 10 | 8 | 2 |
| Supply chain | 6 | 4 | 2 |
| **Total** | **78** | **62** | **16** |

Every control has a verification method. Controls verified only by drill or review are
marked as such and are drilled quarterly per [OPERATIONS.md](../../OPERATIONS.md).

---

## 8. Implementation status

No control is implemented. This checklist is the specification; implementation is tracked
across VS-0 … VS-15 in [TASKS.md](../../TASKS.md).
