# StrangerLink — Final Architecture Review

- **Status:** Complete
- **Date:** 2026-09-26
- **Reviewers:** Architecture, Trust & Safety, SRE, Security
- **Scope:** Documentation-only fix. No code changes.

---

## 0. Verdict

**The architecture is fit to proceed to implementation, with the qualifications recorded
below.**

The design is deliberately conservative: four services, one datastore, one transport, no
broker, no media server, no microservices. The safety subsystem is a first-class set of
bounded contexts with its own ADRs, requirements, and traceability rows. Every P0 and P1
safety requirement traces end to end.

The most significant residual risks are: (a) IP exposure during direct P2P media, which is
disclosed but not eliminated; (b) ban evasion, which is accepted and disclosed; and (c) the
honest limitation that real-time content screening does not exist.

---

## 1. The questions

### Q1. Is unrestricted anonymity creating unnecessary risk?

**Answer: No — anonymity is bounded by design, and the boundaries are explicit.**

Anonymity is provided for the user's benefit: no account, no profile, no persistent handle.
It is not provided as a shield. Every anonymity property has a corresponding enforcement
property:

| Anonymity property | Corresponding enforcement |
| --- | --- |
| No account | Ban on the pseudonymous session identity, checked at five entry points |
| No persistent identity | Recent-peer avoidance; block enforcement; progressive restriction |
| No peer discovery | No search, no directory, no profiles — a stalker cannot find a target |
| No durable chat history | Reports still work; moderators see session metadata, not content |

The places where anonymity *does* create residual risk are named and disclosed rather than
hidden: ban evasion (Q6) and IP exposure (Q8).

**Action taken in this review:** [SAFETY.md](../../SAFETY.md) §0 now states the position
explicitly — "Anonymity is provided for the user's benefit... It is not provided as a shield
for abuse."

---

### Q2. Is age gating adequate?

**Answer: Adequate for a self-attestation model; explicitly not age verification. This is a
disclosed limitation, not a gap.**

The gate requires two unchecked-by-default checkboxes, a genuinely disabled Continue, and
enforcement on every chat route including direct URL navigation. It records no date of
birth and no identity document.

**Honest assessment:** self-attestation does not prove age. It raises the cost of
participation and creates a defensible record. Stronger assurance requires collecting
identity documents, which contradicts NFR-PRIV-001 and NG-4.

**Documented in:** [docs/safety/AGE-GATING.md](../safety/AGE-GATING.md) §2, §3;
[SAFETY.md](../../SAFETY.md) §2. The limitation appears in the eight published limitations.

**Recommendation:** keep age assurance as a PLANNED option and revisit only if a launch
region requires it. Do not adopt document verification without a privacy impact
assessment.

---

### Q3. Is reporting always reachable?

**Answer: Yes, and this is enforced structurally rather than by convention.**

- The Report control is visible in every active session state, including `CONNECTING`.
- It is never in a menu, never in a footer, never removed.
- Opening does not end the session; submitting does.
- It works against a terminal session (FR-REPORT-002) — the single most important
  property, since an abuser's most effective move is to disconnect.
- A banned or restricted user can still report.
- **There is no configuration key that can disable reporting.** The configuration schema
  rejects `reports.enabled`, and a test asserts this (ADR-016 MR-5).
- Report submission has **no error budget** in the SLOs.

**Documented in:** [docs/safety/REPORTING.md](../safety/REPORTING.md) §4, §0;
[SAFETY.md](../../SAFETY.md) §5; [OBSERVABILITY.md](../../OBSERVABILITY.md) §7.

---

### Q4. Can users leave immediately?

**Answer: Yes, from every state, in one action, with no confirmation trap.**

- A single always-visible control returns the user to a clean exit from landing, age gate,
  mode selection, waiting, matched, connecting, and active.
- No confirmation modal intercepts a deliberate exit.
- No streak, reward, or gamification penalises leaving.
- Skip, Report, and Block all end the session immediately.
- After a bounded number of consecutive requeues without a session, the user is offered an
  exit — there is no infinite requeue loop.

**Documented in:** [DESIGN.md](../../DESIGN.md) §1 (the forbidden dark-pattern list), §17;
[PRD.md](../../PRD.md) §7.4; NFR-SAFE-004.

---

### Q5. Is block behaviour clear?

**Answer: Yes, and its limits are disclosed rather than implied.**

- One action to open, exactly one confirmation, no explanation required.
- `session` scope by default; `platform` scope available as a deliberate stronger choice.
- Blocks are re-checked at **candidate selection**, not only at queue join, so a block
  created during an in-flight requeue still takes effect (R5).
- Block state survives reload within the browser session.
- The peer is never told they were blocked.

**The limit is disclosed:** blocking works through StrangerLink only. It cannot stop the
person returning under a new identity. This is stated in the confirmation context and in
the safety centre.

**Documented in:** [docs/safety/BLOCKING.md](../safety/BLOCKING.md) §4.

---

### Q6. Can banned users trivially re-enter?

**Answer: Yes, and we say so. This is the largest accepted limitation in the architecture.**

A determined user can clear storage, change network, and return as a new pseudonymous
identity. The architecture deliberately does **not** close this gap with invasive means.

What we do instead:

| Layer | Effect |
| --- | --- |
| Identity bans | Checked at queue join, candidate selection, session creation, WebSocket connect, and TURN credential mint |
| Risk-signal rate limits and cooldowns | Raise the cost of rapid re-entry |
| Allocation quotas | Bound TURN abuse on return |
| Behavioural review flags | Immediate-skip cadence, repeat-report patterns |
| Recent-peer avoidance | Bounds a returned abuser's ability to find a specific victim |

What we deliberately refuse to do:

| Refused | Why |
| --- | --- |
| IP bans | Collateral damage on CGNAT and shared connections |
| Device fingerprinting | Invasive; a privacy cost disproportionate to the benefit; evadable anyway |
| Cross-session identity linkage | Would create the persistent identity the product promises not to have |

**The rule that makes this safe:** a shared-IP signal can only ever trigger a rate limit or
a cooldown, never a standalone ban (ADR-012 MR-2). An innocent user behind a carrier-grade
NAT must never be banned because of their neighbour.

**Documented in:** [ADR-012](../adr/ADR-012-ban-enforcement.md),
[ABUSE_PREVENTION.md](../../ABUSE_PREVENTION.md) §5, §8, and the eight published
limitations.

---

### Q7. Does the system minimise personal data?

**Answer: Yes. The data inventory contains zero unnecessary fields.**

| Collected | Not collected |
| --- | --- |
| Pseudonymous session identity | Name |
| Session metadata (mode, duration, timestamps, end reason) | Email |
| Report category and optional note | Phone number |
| Interests and language (matching only) | Location |
| Coarse hashed IP-derived risk signal (7 days) | Device fingerprint |
| Age attestation (boolean + version) | Date of birth |
| Aggregate telemetry | Chat content |
| | Media |
| | Any account identifier |

There are no accounts, so most of the usual personal data simply does not exist. A
scheduled schema test asserts that no message-content column exists, and every new column
must be justified against the data inventory in review.

**Documented in:** [PRIVACY.md](../../PRIVACY.md) §16, [DATA_MODEL.md](../../DATA_MODEL.md) §9.

---

### Q8. Are IP exposure implications documented?

**Answer: Yes, thoroughly, in four places, with a published user-facing disclosure.**

The decision — hybrid P2P with TURN fallback — is recorded in
[ADR-014](../adr/ADR-014-anonymity-model.md), which evaluates direct P2P, TURN-only, and
hybrid explicitly and states why TURN-only is PLANNED rather than the default.

The consequences are documented in:

1. **[PRIVACY.md](../../PRIVACY.md) §3.3** — the three options evaluated, the decision, and
   the disclosure text.
2. **[ADR-005](../adr/ADR-005-webrtc-topology.md)** — the topology decision and its privacy
   rationale.
3. **[THREAT_MODEL.md](../../THREAT_MODEL.md) T-12** — the threat entry with impact,
   likelihood, mitigation, and verification.
4. **[DESIGN.md](../../DESIGN.md) §5** — the disclosure is a *requirement* on the
   pre-session safety notice for media modes, not an afterthought.

**The published disclosure:**

> During an audio or video call, the other person may be able to determine your approximate
> location from your internet connection. If that matters to you, use text chat.

**Conditions for moving to TURN-only are explicit** (ADR-014 §Revisit Conditions): a launch
region with documented IP-exposure harm, or video usage growing to the point that relay is
affordable.

---

### Q9. Is TURN strategy justified?

**Answer: Yes.**

Self-hosted coturn with time-limited REST credentials was chosen over managed TURN (control
over credential lifetime and relay-destination policy), over free/public TURN (no
availability or credential control — rejected outright), and over no TURN (would make
FR-MEDIA-002 false for exactly the users who most need it).

The strategy includes: a dedicated network segment, relay-destination restrictions blocking
private/loopback/link-local/metadata ranges, per-identity and per-server allocation quotas,
bandwidth accounting with alerting, TLS 1.2+ only, hardened protocol flags, and a minimum
version of 4.5.0.8 to avoid a known IPv6 socket leak.

**Documented in:** [ADR-006](../adr/ADR-006-turn-strategy.md),
[WEBRTC.md](../../WEBRTC.md) §3.7, [ABUSE_PREVENTION.md](../../ABUSE_PREVENTION.md) §9.9.

**Qualification:** coturn is an operational burden. Managed TURN is recorded as OPTIONAL and
the revisit condition is explicit.

---

### Q10. Are queue races understood?

**Answer: Yes. Twelve are named, each with a designated resolution.**

R1–R12 in [STATE_MACHINE.md](../../STATE_MACHINE.md) §6, plus C1–C6 in
[CHAT.md](../../CHAT.md) §13. Each has a resolution, a task, and a planned test in
[docs/TRACEABILITY.md](../TRACEABILITY.md) §5.

The two that matter most:

- **R1 (two workers, same participant)** — resolved by a single-flight claim; the loser
  gets a definitive negative, never a retry loop.
- **R2 (cancel at the instant of matching)** — resolved by an atomic claim re-check; the
  match is aborted and both participants return to `WAITING`.

**Qualification:** the claim primitive does not exist yet. Until VS-3 lands, these are
specifications, not guarantees. This is the single highest-risk implementation task.

---

### Q11. Can one participant enter multiple sessions?

**Answer: Not by design, and the invariant is enforced in three places.**

INV-1 — a participant has at most one session in a non-terminal status — is enforced by:

1. A single-flight claim primitive in the realtime service (the primary control).
2. A partial unique index in PostgreSQL (the second layer).
3. A metric, `session.per_participant`, that **pages** if it ever exceeds 1 (RUNBOOK RB-02).

Two-tab use and reconnect supersession are handled explicitly (R8, R12): the older socket
receives `SESSION_SUPERSEDED` and is returned to a clean state rather than silently broken.

**Qualification:** enforcement is specified but not implemented. RB-02 treats a violation as
SEV-1 regardless of observed user impact, which is the correct posture.

---

### Q12. Can reports survive disconnect?

**Answer: Yes. This is a first-class requirement with its own test.**

FR-REPORT-002 and INV-8: a report may reference a terminal session. Report acceptance is
independent of session status.

Three reinforcing properties:

- Session metadata is retained 30 days specifically so that a late report has something to
  reference (RETENTION Tier 2).
- The bounded post-session reporting window is documented in ADR-011.
- `safety.report_after_disconnect` is a tracked metric; **if it is ever zero, that is
  investigated as a possible failure of FR-REPORT-002.**

**Documented in:** [docs/safety/REPORTING.md](../safety/REPORTING.md) §4, §9;
[ADR-011](../adr/ADR-011-reporting-model.md) MR-1.

---

### Q13. Are abuse controls proportional?

**Answer: Yes, and proportionality is measured rather than assumed.**

- Enforcement is progressive: warn → disconnect → temporary restriction → ban
  (FR-SAFE-005).
- A first minor violation gets a warning, not a ban.
- A shared-IP signal can only trigger a rate limit or cooldown, never a ban.
- No single signal is sufficient for a ban; correlation plus human review is required.
- Reports are never auto-actioned into a ban.
- CAPTCHA is used only where a documented abuse pattern justifies it — never on first
  visit.

**The measurement:** the **ban appeal overturn rate** is a tracked guardrail metric with a
target below 5%. A rate above that triggers a proportionality review. This is the single
most important operational signal that we are not over-enforcing.

**Documented in:** [SAFETY.md](../../SAFETY.md) §7.2,
[ABUSE_PREVENTION.md](../../ABUSE_PREVENTION.md) §7,
[docs/product/METRICS.md](../product/METRICS.md) §1.

---

### Q14. Could moderation become a privacy violation?

**Answer: It could, and the architecture is specifically designed to prevent it.**

Moderation is the subsystem with the greatest potential to become surveillance. The
controls:

| Control | Effect |
| --- | --- |
| Chat content is not stored | There is nothing for a moderator to read |
| Media is never recorded | Same |
| Moderators see session metadata only | Mode, duration, timestamps, end reason, identities |
| IP access requires a documented investigation | With an audit record |
| No bulk export of personal data | Without an audited reason |
| Every action audited | Actor, action, reason, policy version |
| A schema test forbids content columns | Adding one requires a new ADR |
| Observability attribute allowlist | No content, no addresses, ever |

The structural point: **because chat content does not exist durably, moderation cannot
become surveillance by accretion.** The most likely path to a privacy violation — a
well-intentioned contributor adding chat logging "for moderation" — is blocked by a schema
test and an ADR gate.

**Documented in:** [MODERATION.md](../../MODERATION.md) §5, [THREAT_MODEL.md](../../THREAT_MODEL.md)
T-30, [ADR-010](../adr/ADR-010-moderation-model.md).

---

### Q15. Are retention periods justified?

**Answer: Yes. Every tier has a written justification and a named owner.**

Eight tiers, from "not stored" to "shortest workable":

| Tier | Data | Period | Justification |
| --- | --- | --- | --- |
| 0 | Chat, media, SDP, ICE | Not stored | Largest privacy risk; minimal safety benefit |
| 1 | Queue, registries | Process lifetime | Ephemeral by nature |
| 2 | Session metadata | 30 days | Covers the post-session reporting window plus triage |
| 3 | Reports, safety events | 12 months | Repeat-offender detection and appeals |
| 4 | Bans, moderation actions, audit | 24 months | Enforcement integrity and non-repudiation |
| 5 | Telemetry | 13 months | Operational trends; no identities |
| 6 | IP-derived risk signals | 7 days rolling | Only as long as rate limiting needs |
| 7 | coturn logs | ≤ 7 days | Shortest workable |

**Enforcement:** the retention job is scheduled, idempotent, logged, and **alerts on
failure**. A failed run is treated as a privacy incident, not a background error. A
scheduled test asserts expired rows are gone.

**The default direction is shortening.** Lengthening requires a written justification
reviewed by Trust & Safety and Legal.

**Documented in:** [RETENTION.md](../../RETENTION.md), [ADR-013](../adr/ADR-013-retention-policy.md).

---

### Q16. Are realtime components overengineered?

**Answer: No. They are arguably under-built, deliberately.**

| Component | Assessment |
| --- | --- |
| `ws` (not Socket.IO) | Correct — we own both ends and need precise protocol control |
| No SFU / MCU | Correct — two-party product |
| No message broker | Correct — events are conceptual, in-process, low-volume |
| No Redis | Correct — not needed until multi-instance realtime |
| No WebTransport | Correct — not viable across target browsers |
| In-memory queue | Correct — a durable queue table would be a durable record of who sought a stranger |
| Hand-rolled reconnect | A real cost, accepted for control over the failure model |

The one genuine over-engineering risk is the **separate realtime service**. It is justified
by failure isolation (a socket flood must not exhaust the web tier) and by independent
scaling, and it is the reason a single-instance constraint exists.

**Documented in:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §11,
[ADR-003](../adr/ADR-003-realtime-transport.md), [EVENTS.md](../../EVENTS.md) §6.

---

### Q17. Is Redis actually necessary?

**Answer: No. Not yet, and adopting it now would be unjustified.**

Redis becomes justified **only** if one of these becomes true:

1. The realtime service runs more than one instance and needs cross-instance routing.
2. Rate limiting must be shared across instances.
3. Queue state must survive a realtime-instance restart.

None is true at MVP scale. Adding Redis now would add an operational dependency, a failure
mode, and a consistency story for no benefit.

**This is recorded as a hard gate, not a preference:** running more than one realtime
instance requires cross-instance routing **and** the Redis decision in the same change
(ADR-003 MR-5, ADR-016 MR-6).

**Documented in:** [docs/research/STACK-2026.md](../research/STACK-2026.md) §3,
[ADR-002](../adr/ADR-002-database.md).

---

### Q18. Are microservices actually necessary?

**Answer: No. Four services is the right granularity for one team.**

| Service | Why separate |
| --- | --- |
| web | Request/response lifecycle |
| realtime | Long-lived connection lifecycle; different scaling and failure domain |
| turn | Bandwidth-heavy; different network placement and cost profile |
| db | Durable state |

These are separated by **runtime profile and security boundary**, not by domain. Splitting
further — a matchmaking service, a moderation service, a queue service — would add network
boundaries, distributed transactions, and operational load for no benefit at this scale.

**Documented in:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §3,
[ADR-016](../adr/ADR-016-deployment.md) Option D.

---

### Q19. Can one small team operate this?

**Answer: Yes, with the qualifications below.**

| Factor | Assessment |
| --- | --- |
| Service count | Four — manageable |
| Datastore | One managed PostgreSQL |
| Realtime scaling | Single instance until a gate is met — no distributed systems problems yet |
| Media | P2P; coturn is the only unusual operational component |
| Observability | OpenTelemetry with a vendor backend |
| Safety operations | The heaviest load; human triage is the bottleneck, not the system |

**Qualifications:**

1. **coturn is the hardest component to operate** — certificates, port ranges, kernel
   tuning, quotas. Managed TURN is the documented escape hatch.
2. **Trust & Safety is the real operational load.** Human triage does not scale
   automatically. Moderator wellbeing is an operational requirement, not a nicety.
3. **Kubernetes is deliberately deferred** until service count justifies it.
4. **Runbooks must be drilled.** An undrilled runbook is not a runbook; drills are
   scheduled for VS-15.

**Documented in:** [OPERATIONS.md](../../OPERATIONS.md), [DEPLOYMENT.md](../../DEPLOYMENT.md),
[ADR-016](../adr/ADR-016-deployment.md).

---

### Q20. Are skeleton files implementation-free?

**Answer: Yes. Verified by inspection and by the rules in the repository.**

**Allowed and present:** interfaces, types, DTOs, enums, state definitions, protocol
message contracts, repository ports, service ports, route shells, component shells,
`describe.todo` tests, and `NotImplemented` functions.

**Absent, verified:**

| Forbidden | Status |
| --- | --- |
| Working matchmaking | Absent — `findMatch()` throws |
| Real WebRTC negotiation | Absent — `PeerConnectionCoordinator` methods throw |
| Working signaling | Absent — contracts only, no transport |
| Real WebSocket server | Absent — transport port throws |
| Real database access | Absent — no driver imported anywhere |
| Moderation logic | Absent — port throws |
| Persistent bans | Absent — entity modelled, no persistence |
| Functional authentication | Absent — port throws |
| Real report submission | Absent — `submitReport()` throws |
| Real rate limiting | Absent — port throws |
| Device fingerprinting | Absent — deliberately not declared at all |
| Production deployment | Absent — plan only |

Every function that would require business logic, network logic, matchmaking logic,
moderation logic, or persistence throws `Not implemented: T-<ID>` and references its task.

---

### Q21. Is the implementation order correct?

**Answer: Yes. The slice order is deliberate and the reasoning is recorded.**

The sequence is: **identity → queue → match → text chat → disconnect/requeue → report and
block → safety enforcement → signaling → audio → video → TURN → moderation → abuse →
observability → hardening.**

| Ordering decision | Why it is right |
| --- | --- |
| Identity before queue | A queue without an identity has nothing to key limits on |
| Queue before match | A match without a queue is unmanaged concurrency |
| **Text chat before any media** | Text is the product and the most reliable path. Media multiplies the failure surface |
| **Report and block before safety enforcement** | The user's own tools must exist before platform enforcement builds on them |
| **Safety enforcement before media** | A product that can show video before it can be reported is a liability |
| Media after safety | Video is the highest-cost, highest-risk, least reliable component |
| Moderation after reports exist | There is nothing to moderate without reports |
| Retention last | A retention job before there is data to retain is untestable |

**The two orderings that matter most:**

1. **VS-6 (Report + Block) precedes VS-7 (Safety Controls).** The user's immediate
   self-protection must work before platform enforcement is layered on top.
2. **VS-7 precedes VS-8 (WebRTC Signaling).** Enforcement exists before the feature with
   the largest abuse surface.

**The one ordering risk:** VS-3 (Text Match) depends on the single-flight claim primitive,
which does not exist yet. That primitive is the highest-risk implementation task in the
project and must be built and tested before matchmaking depends on it. This is recorded as
condition 2 in §4.

**Documented in:** [ROADMAP.md](../../ROADMAP.md) §0, §2; [TASKS.md](../../TASKS.md).

---

## 2. Findings and documentation fixes

This review produced documentation fixes only. No code was changed.

| # | Finding | Fix |
| --- | --- | --- |
| F-1 | The anonymity position was implied but not stated as a position | Added [SAFETY.md](../../SAFETY.md) §0 position statement |
| F-2 | The IP-exposure disclosure was documented but not tied to a UI requirement | Tied it to the pre-session safety notice in [DESIGN.md](../../DESIGN.md) §5 as a requirement, and traced it in [docs/TRACEABILITY.md](../TRACEABILITY.md) |
| F-3 | The "no reporting kill switch" rule existed in ADR-016 but was not enforced by a stated test | Made the configuration-schema rejection explicit with a test reference in ADR-016 MR-5 and [DEPLOYMENT.md](../../DEPLOYMENT.md) §6 |
| F-4 | Proportionality was asserted but not measured | Added the ban appeal overturn rate as a tracked guardrail with a 5% threshold and a review trigger |
| F-5 | `safety.report_after_disconnect` had no defined anomaly behaviour | Defined: a zero value is investigated as a possible failure of FR-REPORT-002 |
| F-6 | The realtime-instance constraint was scattered across ADRs | Consolidated into an explicit gate in ADR-003 MR-5 and ADR-016 MR-6 |
| F-7 | The single-instance realtime constraint was not visible in the deployment doc | Stated explicitly in [DEPLOYMENT.md](../../DEPLOYMENT.md) §1 |

---

## 3. Residual risks accepted

| Risk | Severity | Accepted because |
| --- | --- | --- |
| IP exposure during direct P2P | High | Disclosed; TURN available; TURN-only is a documented path |
| Ban evasion by a determined user | High | Disclosed; the alternatives are invasive and evadable |
| No real-time content screening | High | Disclosed; the alternative is reading all content, a greater harm |
| Reports are often unresolvable | Medium | Inherent to ephemerality; tracked as a metric |
| coturn operational burden | Medium | Managed TURN is the documented escape hatch |
| Two-tab eviction is a real UX cost | Low | Required by INV-1 |
| Self-attestation does not prove age | High | The alternative contradicts the privacy position |

**Every accepted risk is disclosed to users** in the eight limitations in
[SAFETY.md](../../SAFETY.md) §1. None is hidden.

---

## 4. Conditions for proceeding to implementation

| # | Condition |
| --- | --- |
| 1 | VS-0 establishes CI gates including the `server-only` boundary, the `dangerouslySetInnerHTML` lint rule, and bundle budgets before any feature code |
| 2 | The single-flight claim primitive is built and tested **before** matchmaking depends on it (VS-3) |
| 3 | The report path is tested against terminal sessions **before** VS-6 is considered done |
| 4 | The IP-exposure disclosure ships with the first media mode, not later |
| 5 | Ban enforcement fail-closed is chaos-tested before VS-7 is considered done |
| 6 | The retention job is built in VS-15, not earlier, and its failure path is drilled |
| 7 | Every runbook is drilled at least once before production |
| 8 | Trust & Safety signs off on the eight published limitations before launch |

---

## 5. Re-review triggers

This review must be repeated when:

- Any ADR is superseded.
- Media is added (VS-9 onward) — the privacy and moderation surface changes materially.
- Any retention tier is lengthened.
- Fingerprinting or automated content classification is proposed.
- The realtime service moves beyond one instance.
- A SEV-1 safety incident occurs.

---

## 6. Sign-off

| Role | Position |
| --- | --- |
| Architecture | Approved to proceed to VS-0 |
| Trust & Safety | Approved, subject to the eight published limitations and the VS-6 conditions |
| Security | Approved, subject to the VS-0 CI gates |
| SRE | Approved, subject to the VS-15 drills |
