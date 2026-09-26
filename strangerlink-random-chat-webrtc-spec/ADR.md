# Architecture Decision Records — Index

- **Status:** Active
- **Last updated:** 2026-09-26
- **Rule:** An ADR is required before implementing anything that changes a boundary, a
  data-flow, a security property, or a safety property. See [AGENTS.md](AGENTS.md).

## Status legend

| Status | Meaning |
| --- | --- |
| **Accepted** | Decided and in force. |
| **Proposed** | Direction agreed, details pending the vertical slice that needs it. |

---

## Index

| ADR | Title | Status | Primary requirements |
| --- | --- | --- | --- |
| [ADR-001](adr/ADR-001-web-framework.md) | Web Framework | Accepted | NFR-PERF-001, NFR-SEC-001 |
| [ADR-002](adr/ADR-002-database.md) | Database | Accepted | NFR-PRIV-004, NFR-SEC-001 |
| [ADR-003](adr/ADR-003-realtime-transport.md) | Realtime Transport | Accepted | NFR-SEC-002, FR-QUEUE-001 |
| [ADR-004](adr/ADR-004-signaling-model.md) | Signaling Model | Accepted | NFR-SEC-004, NFR-SEC-005 |
| [ADR-005](adr/ADR-005-webrtc-topology.md) | WebRTC Topology | Accepted | FR-MEDIA-009, NFR-PRIV-003 |
| [ADR-006](adr/ADR-006-turn-strategy.md) | TURN Strategy | Accepted | NFR-SEC-006, NFR-PRIV-003 |
| [ADR-007](adr/ADR-007-session-model.md) | Session Model | Accepted | FR-MATCH-002, NFR-SEC-003 |
| [ADR-008](adr/ADR-008-matchmaking.md) | Matchmaking | Accepted | FR-MATCH-001, FR-MATCH-012 |
| [ADR-009](adr/ADR-009-interest-matching.md) | Interest Matching | Accepted | FR-MATCH-007, FR-MATCH-008 |
| [ADR-010](adr/ADR-010-moderation-model.md) | Moderation Model | Accepted | FR-MOD-001, FR-MOD-006 |
| [ADR-011](adr/ADR-011-reporting-model.md) | Reporting Model | Accepted | FR-REPORT-001, FR-REPORT-002 |
| [ADR-012](adr/ADR-012-ban-enforcement.md) | Ban Enforcement | Accepted | FR-SAFE-004, FR-MOD-008 |
| [ADR-013](adr/ADR-013-retention-policy.md) | Retention Policy | Accepted | NFR-PRIV-005 |
| [ADR-014](adr/ADR-014-anonymity-model.md) | Anonymity Model & IP Exposure | Accepted | NFR-PRIV-002, NFR-PRIV-003 |
| [ADR-015](adr/ADR-015-observability.md) | Observability | Accepted | NFR-OBS-001, NFR-OBS-002 |
| [ADR-016](adr/ADR-016-deployment.md) | Deployment | Proposed | NFR-OPS-001, NFR-OPS-002 |

---

## How to read an ADR

Every ADR contains, in order:

1. **Context** — the situation that forces a decision.
2. **Problem** — the specific question to answer.
3. **Decision Drivers** — what matters most when choosing.
4. **Options Considered** — including options we rejected, and why.
5. **Decision** — the choice, stated unambiguously.
6. **Consequences** — what becomes easier, what becomes harder.
7. **Risks** — what could go wrong because of this decision.
8. **Mitigations** — what we do about each risk.
9. **Revisit Conditions** — the specific signals that would reopen this ADR.
10. **References** — sources.

---

## Dependency between ADRs

```
ADR-001 Web Framework ──┬──> ADR-003 Realtime Transport ──> ADR-004 Signaling Model
                        │                                          │
                        └──> ADR-007 Session Model                 │
                                                                │
ADR-002 Database ───────┬──> ADR-007 Session Model                │
                        ├──> ADR-010 Moderation Model             │
                        ├──> ADR-011 Reporting Model              │
                        ├──> ADR-012 Ban Enforcement              │
                        └──> ADR-013 Retention Policy             │
                                                                ▼
ADR-005 WebRTC Topology ──> ADR-006 TURN Strategy ──> ADR-014 Anonymity Model
                                                                │
ADR-008 Matchmaking ──> ADR-009 Interest Matching               │
                                                                │
ADR-014 Anonymity Model ──> ADR-012 Ban Enforcement             │
                                                                │
ADR-015 Observability ──> ADR-016 Deployment
```

Reading order for a new engineer: **001 → 007 → 014 → 008 → 004 → 005 → 006 → 010 → 011
→ 012 → 013 → 015**. ADR-002, 003, 009, 016 can be read at any point.

---

## Superseded / withdrawn ADRs

None yet.
