# StrangerLink — Deployment

- **Status:** Architecture phase — **plan only, nothing deployed**
- **Last updated:** 2026-09-26
- **Related:** [ADR-016](docs/adr/ADR-016-deployment.md), [OPERATIONS.md](OPERATIONS.md), [RUNBOOK.md](RUNBOOK.md)

---

## 0. Position

This document describes the **intended** deployment. No deployment exists. No CI pipeline
runs. No container has been built. Do not treat this as an operational artifact.

---

## 1. Services

| Service | Runtime | Scaling | Network |
| --- | --- | --- | --- |
| **web** | Node 24 container, Next.js 16 | Horizontal, request-driven | Public, behind TLS termination |
| **realtime** | Node 24 container, `ws` | **Single instance until the Redis gate is met** | Private; reachable only via the web tier or an authenticated gateway |
| **turn** | coturn | Bandwidth-driven | **Dedicated segment**; no access to web, realtime, or db |
| **db** | Managed PostgreSQL 18 | Vertical, then read replica | Private |

The realtime service is deliberately deployed as **one instance** until cross-instance
routing and shared rate limiting exist. Running two instances without those would break
the one-active-session invariant.

---

## 2. Environments

| Environment | Purpose | Notes |
| --- | --- | --- |
| **local** | Docker Compose; coturn with a test realm | No real media required |
| **preview** | Per-PR; no TURN | Synthetic matches only |
| **staging** | Full topology, production-like | Anonymised data only |
| **production** | Full topology | — |

---

## 3. Container images

| Property | Commitment |
| --- | --- |
| Build | Multi-stage; build stage discarded |
| Base | Slim, pinned by digest |
| User | Non-root |
| Filesystem | Read-only root where possible |
| Tagging | Commit SHA |
| Scanning | Dependency and base-image scanning; critical blocks release |
| Secrets | Injected at runtime; never baked in |

---

## 4. CI pipeline (GitHub Actions)

```
push / pull_request
  │
  ├── typecheck (tsc --noEmit, strict)
  ├── lint (incl. no-dangerouslySetInnerHTML, server-only boundary)
  ├── unit (Vitest)
  ├── integration (Vitest + PostgreSQL service container)
  ├── build (Next.js production build)
  ├── bundle budget check
  ├── Playwright (axe + E2E, multi-context)
  ├── security tests
  ├── dependency audit (critical blocks)
  └── secret scan

merge to main
  ├── build images
  ├── scan images
  └── deploy to staging

manual approval
  └── deploy to production
```

---

## 5. Deploy procedure

1. **Pre-deploy:** staging verification green; bundle budgets met; no critical
   vulnerabilities.
2. **Database migrations:** expand/contract only. A destructive migration never ships in
   the same release as the code that stops using the column.
3. **Web tier:** rolling deploy; health checks gate traffic.
4. **Realtime tier:** rolling deploy with a **graceful drain period** that exceeds the
   platform's termination grace period, so in-flight signaling completes.
5. **coturn:** rolling; verify the relay port range with a smoke test.
6. **Post-deploy:** smoke tests; SLO dashboard review; alert silence check.
7. **Rollback:** redeploy the previous image tag. Migrations must support running one
   version back.

---

## 6. Configuration and kill switches

| Switch | Effect | Notes |
| --- | --- | --- |
| `media.audio.enabled` | Disables audio mode at queue join | Trust & Safety can operate |
| `media.video.enabled` | Disables video mode at queue join | Trust & Safety can operate |
| `interestMatching.enabled` | Falls back to pure random matching | — |
| `signaling.newSessions.enabled` | Stops new matches; existing sessions continue | — |
| `reports.enabled` | **DOES NOT EXIST** | A configuration key that can disable reporting is a safety defect |

The configuration schema **rejects** `reports.enabled`, and a test asserts this
(ADR-016 MR-5).

---

## 7. coturn deployment checklist

| Item | Requirement |
| --- | --- |
| Version | ≥ 4.5.0.8 (earlier versions leak IPv6 UDP sockets) |
| Credentials | `use-auth-secret` + long-term credential mechanism + realm |
| Ports | UDP/TCP 3478, TURNS 5349, alternates 80/443, relay range matching the firewall |
| TLS | 1.2+ only; `no-sslv3`, `no-tlsv1`, `no-tlsv1_1` |
| Hardening | `no-multicast-peers`, `no-stun-backward-compatibility`, `response-origin-only-with-rfc5780`, `stale-nonce`, `no-tcp-relay` |
| Quotas | `user-quota`, `total-quota` |
| User | Non-root (`proc-user`, `proc-group`) |
| Network | Dedicated segment; relay to private/loopback/link-local/metadata blocked |
| Logging | Separate access-controlled stream; verbose disabled in production |
| Smoke test | Relay to a private range must fail |

---

## 8. Secrets

| Secret | Rotation | Notes |
| --- | --- | --- |
| TURN static auth secret | Scheduled | Rotating requires a coturn reload; documented in [OPERATIONS.md](OPERATIONS.md) |
| Database credentials | Scheduled | Least-privilege role |
| Identity token signing key | Scheduled | Rotation invalidates in-flight identities — planned, not disruptive to sessions |
| Admin credentials | Per policy | MFA enrolled |
| OTel exporter credentials | Scheduled | — |

No secret is ever present in an image, a CI log, a client bundle, or an error message.

---

## 9. Deployment safety checks

| Check | Gate |
| --- | --- |
| Staging verification | Required |
| Bundle budgets | Required |
| Critical vulnerabilities | Blocks |
| Migration compatibility | Required |
| Rollback path verified | Required |
| Kill switches tested | Required |
| Relay-destination smoke test | Required |
| Retention job health | Required |

---

## 10. What is not deployed

| Not deployed | Why |
| --- | --- |
| Redis | Not needed until multi-instance realtime |
| Kubernetes | Deferred; managed platform until service count justifies it |
| Message broker | No justification (EVENTS.md §6) |
| SFU / media server | Two-party product only |
| CDN for media | Media is P2P |
| Managed TURN | Self-hosted at launch |

---

## 11. Implementation status

**Nothing in this document has been executed.** Deployment is scheduled for VS-0
(environments and images) and VS-15 (production hardening). Tracked in
[TASKS.md](TASKS.md).
