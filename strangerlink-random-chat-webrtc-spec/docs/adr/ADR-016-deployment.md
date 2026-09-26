# ADR-016 — Deployment

- **Status:** Proposed
- **Date:** 2026-09-26
- **Deciders:** Architecture + SRE
- **Related:** [ADR-002](ADR-002-database.md), [ADR-003](ADR-003-realtime-transport.md), [ADR-006](ADR-006-turn-strategy.md), [ADR-015](ADR-015-observability.md)

## Context

Deployment decisions made now constrain operations forever. The relevant facts:

- The product has three quite different runtime profiles: a request/response web tier, a
  long-lived WebSocket tier, and a bandwidth-heavy TURN relay. These should not share a
  scaling policy, a failure domain, or a security posture.
- The team is small. The operational surface must be minimised, not maximised.
- Trust & Safety needs the ability to **disable features quickly** without a deploy —
  specifically media modes and interest matching.
- Secrets are safety-relevant here: a leaked TURN secret is a bandwidth bill; a leaked
  admin credential is a moderation bypass.

## Problem

How is StrangerLink deployed, packaged, scaled, and operated?

## Decision Drivers

1. **Failure isolation.** A WebSocket flood must not take down the web tier.
2. **Operability.** One engineer on-call.
3. **Security segmentation.** TURN must not share a network with application servers.
4. **Deploy safety.** Rolling deploys must not drop live sessions.
5. **Kill switches.** Safety-relevant features must be disableable without a deploy.
6. **Cost.** Predictable, with TURN bandwidth as the variable component.
7. **Auditability.** Configuration changes must be attributable (NFR-OPS-002).

## Options Considered

### Option A — Single container running web + realtime together

**Strengths:** Simplest possible deployment.

**Weaknesses:** No failure isolation. A socket flood exhausts the web tier. Cannot scale
the two independently. **Rejected.**

### Option B — Separate services: web, realtime, TURN, database

**Strengths:** Independent scaling and failure domains; matches the three runtime
profiles; lets TURN sit in its own network segment.

**Weaknesses:** More moving parts; needs a deployment mechanism and a service discovery
story.

### Option C — Serverless / edge for everything

**Strengths:** Minimal ops.

**Weaknesses:** Long-lived WebSockets and high-bandwidth UDP relay are a poor fit for
serverless pricing and execution models. **Rejected** for the realtime and TURN tiers.

### Option D — Kubernetes from day one

**Strengths:** Powerful, standard.

**Weaknesses:** Significant operational overhead for a small team and a small number of
services. **Deferred** — revisit when service count or scaling requirements justify it.

## Decision

**Adopt Option B: separate deployable services, on a managed container platform, with
Kubernetes deferred.**

### Services

| Service | Runtime | Scaling | Network |
| --- | --- | --- | --- |
| **web** | Node 24 container, Next.js 16 | Horizontal, request-driven | Public, behind TLS termination |
| **realtime** | Node 24 container, `ws` | Horizontal with sticky sessions; **gated on the Redis decision** | Private, reachable only via the web tier or an authenticated gateway |
| **turn** | coturn container | Sized by bandwidth | **Dedicated segment**, no access to web/realtime/db |
| **db** | Managed PostgreSQL 18 | Vertical + read replica if needed | Private |

### Packaging

- Multi-stage Docker builds; slim base images; non-root user; read-only root filesystem
  where possible.
- One image per service, tagged by commit SHA.
- Dependency and base-image scanning in CI; critical CVEs block release.

### Deploy safety

- Rolling deploys with a **graceful drain period** on the realtime service so in-flight
  signaling completes. The drain timeout must exceed the platform's termination grace
  period.
- Database migrations are **backward compatible** (expand/contract). A deploy must not
  require a destructive migration in the same release as the code that stops using the
  column.
- Health checks: liveness (process), readiness (dependencies reachable).
- Rollback is a redeploy of the previous image tag; migrations must support running
  one version back.

### Kill switches (configuration, not code)

| Switch | Effect |
| --- | --- |
| `media.audio.enabled` | Disables audio mode at queue join |
| `media.video.enabled` | Disables video mode at queue join |
| `interestMatching.enabled` | Falls back to pure random matching |
| `signaling.newSessions.enabled` | Stops new matches; existing sessions continue |
| `reports.enabled` | **Cannot be disabled.** Reporting must always work |

`reports.enabled` is deliberately not a switch. A configuration option that can disable
safety reporting is a safety defect.

### Secrets

- All secrets in a managed secret store; never in images, environment files in the repo,
  or CI logs.
- Rotation schedule documented in [OPERATIONS.md](../OPERATIONS.md).
- The TURN static auth secret rotates on a schedule (ADR-006).

### Environments

| Environment | Purpose |
| --- | --- |
| local | Docker Compose; coturn with a test realm; no real media required |
| preview | Per-PR; no TURN; synthetic matches only |
| staging | Full topology, production-like, anonymised data only |
| production | Full topology |

### CI/CD

GitHub Actions: typecheck → lint → unit → integration → build → Playwright → image build
→ scan → deploy. Deploy to staging is automatic; production requires approval and a
green staging verification.

## Consequences

**Positive**

- Failure isolation between web, realtime, and TURN.
- TURN sits in a network segment that cannot reach application data.
- Graceful drain means rolling deploys do not strand users.
- Kill switches give Trust & Safety a fast response without a deploy.
- CI blocks on security scanning, so a critical CVE cannot ship silently.

**Negative**

- Four deployables instead of one.
- Cross-service tracing and correlation are required (ADR-015).
- Kubernetes is deferred, so the platform's own scaling primitives must be understood.
- coturn's TLS on 443 needs careful coexistence with the web tier.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Rolling deploy drops live sessions | High | Medium |
| TURN segment misconfigured → relay reaches internal services | Critical | Low |
| Secret leaks through CI logs or an image layer | Critical | Medium |
| Destructive migration deployed with incompatible code | High | Medium |
| Kill switch used to disable reporting | Critical | Low |
| Realtime scaling requires Redis we do not have | Medium | Medium |

## Mitigations

- **MR-1:** Drain period on realtime exceeds the platform termination grace period;
  verified by a deploy test in staging.
- **MR-2:** coturn network policy is defined as code, reviewed, and smoke-tested in
  staging (relay to a private range must fail).
- **MR-3:** Secret scanning in CI; secrets injected at runtime only; images scanned for
  embedded secrets.
- **MR-4:** Expand/contract migration policy enforced by review; a migration checklist in
  [CONTRIBUTING.md](../CONTRIBUTING.md).
- **MR-5:** `reports.enabled` does not exist as a configuration key; a test asserts the
  configuration schema rejects it.
- **MR-6:** The realtime service is deployed as a single instance until the Redis gate in
  ADR-003 is satisfied. This is an explicit, documented limit.

## Revisit Conditions

- Realtime concurrency exceeds a single instance → adopt Redis and multi-instance
  realtime in the same change.
- Service count or scaling complexity makes a managed platform awkward → evaluate
  Kubernetes with a written operational-cost comparison.
- TURN bandwidth cost or availability becomes a problem → evaluate managed TURN.
- A region requires data residency → region-pinned deployments, which changes the
  matchmaking region model.

## References

- [DEPLOYMENT.md](../DEPLOYMENT.md)
- [OPERATIONS.md](../OPERATIONS.md)
- [RUNBOOK.md](../RUNBOOK.md)
- [ADR-003](ADR-003-realtime-transport.md)
- [ADR-006](ADR-006-turn-strategy.md)
- [ADR-015](ADR-015-observability.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
