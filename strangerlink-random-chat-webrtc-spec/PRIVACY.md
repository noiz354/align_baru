# StrangerLink — Privacy

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-014](docs/adr/ADR-014-anonymity-model.md), [RETENTION.md](RETENTION.md), [DATA_MODEL.md](DATA_MODEL.md)

---

## 0. Position

StrangerLink collects the **minimum data necessary to run a stranger-chat service safely**.
There are no accounts, no profiles, no names, no emails, no phone numbers, and no durable
record of any conversation.

Privacy here is not a compliance exercise bolted onto a data-hungry product. It is a
**product property**: the reason someone will use this instead of a social network is that
nothing about them persists.

---

## 1. No public profile requirement

| Commitment | Detail |
| --- | --- |
| No account | There is no sign-up, no login, no email, no phone, no OAuth |
| No profile | No username, avatar, bio, or display name |
| No directory | No user search, no discovery, no "people near you" |
| No social graph | No friends, followers, or contacts |
| No cross-session identity | A participant identity is created fresh and dies with the browser session |
| No popularity metrics | No scores, counts, or rankings shown to anyone |

**Requirement:** NFR-PRIV-001, NFR-PRIV-002, NG-1, NG-4.

---

## 2. Pseudonymous session identities

| Property | Detail |
| --- | --- |
| Form | A server-generated `uuidv7` participant identity |
| Creation | On queue entry, with no credential supplied by the user |
| Lifetime | The browser session |
| Linkability | Not linkable to any account, device, or person |
| Risk signal | A coarse, one-way-hashed IP-derived signal may be attached; it is **not** a device fingerprint and can only trigger rate limits and cooldowns |

**Requirement:** NFR-PRIV-002, ADR-012.

---

## 3. IP address handling

### 3.1 What we do with IP addresses

| Use | Detail |
| --- | --- |
| Connection security | Origin and rate limiting at the WebSocket handshake |
| Abuse prevention | A **coarse, one-way hash** retained for 7 days (rolling) for rate limiting and cooldowns only |
| TURN | coturn necessarily sees client addresses; coturn runs in a dedicated segment with restricted logging |
| Anything else | **Nothing** |

### 3.2 What we never do with IP addresses

| Never | Detail |
| --- | --- |
| Expose to a peer | The signaling plane never attaches, logs, or relays a peer's address (ADR-014 MR-2) |
| Ban on | IP bans are rejected for collateral damage (ADR-012) |
| Store raw | Only a coarse hash is retained, for 7 days |
| Use for analytics | Not a metric, not a label |
| Sell or share | No third-party sharing of any kind |

### 3.3 The critical decision: should peer IP addresses be directly exposed by P2P?

**This is the most consequential privacy decision in the product.** During a direct
peer-to-peer WebRTC session, ICE candidate exchange means each browser learns the other's
**host candidates** (local interface addresses) and **server-reflexive candidates**
(public IP:port mappings).

Evaluated options:

| Option | Privacy | Cost | Reachability | Decision |
| --- | --- | --- | --- | --- |
| **Direct P2P** | Weakest — public IP exposed to the stranger | Lowest | Fails behind symmetric NAT / strict firewalls | **Rejected as the sole option** |
| **TURN-only** | Strongest — no address-revealing candidates exchanged | Highest — all media relayed | Universal | **PLANNED**, not the default |
| **Hybrid** (P2P with TURN fallback) | Residual exposure, documented and disclosed | Moderate | Good | **SELECTED** |

**Decision and rationale:** [ADR-014](docs/adr/ADR-014-anonymity-model.md). We adopt the
hybrid, disclose the residual exposure in plain language, keep TURN always available, and
record explicit conditions for moving to TURN-only.

**The disclosure we publish:**

> During an audio or video call, the other person may be able to determine your
> approximate location from your internet connection. If that matters to you, use text
> chat.

**Requirement:** NFR-PRIV-003, ADR-005, ADR-014.

---

## 4. Logs

### 4.1 What is logged

| Logged | Detail |
| --- | --- |
| Request metadata | Route, status, duration, trace id |
| Realtime events | Connection lifecycle, message counts, validation failures |
| Safety events | Gate passage, escalations, terminations, rate-limit triggers |
| Errors | Class, stack (server-side only), trace id |

### 4.2 What is never logged

| Never logged | Why |
| --- | --- |
| Chat message content | Does not exist durably; must never reach a log |
| Report notes | Redacted in application logs; visible only in the moderation surface |
| IP addresses | Only coarse hashes, in a separate access-controlled store |
| TURN credentials | Secret |
| Session tokens | Secret |
| SDP bodies | Privacy |
| Peer addresses | Privacy |

**Requirement:** NFR-SEC-007, NFR-PRIV-004, ADR-015.

---

## 5. WebRTC privacy considerations

| Consideration | Position |
| --- | --- |
| Media encryption | DTLS-SRTP; no plaintext RTP |
| Media recording | **Never.** No `MediaRecorder`, no stream capture, no upload path |
| Media storage | None. Media is never written anywhere |
| Server visibility of media | None — media does not traverse our servers except as an opaque TURN relay |
| Candidate leakage | Documented in §3.3 and ADR-014 |
| Device enumeration | Labels come from the browser; we do not fingerprint devices |
| Track cleanup | All tracks stopped on session end, in every exit path |

**Requirement:** FR-MEDIA-008, NFR-PRIV-003.

---

## 6. TURN use and privacy

| Consideration | Position |
| --- | --- |
| coturn sees | Client addresses and relayed media (it must, to relay) |
| coturn does not see | Signaling content, chat messages, reports |
| Placement | Dedicated network segment, no access to application infrastructure |
| Logging | Restricted, access-controlled, separate stream; verbose logging disabled in production |
| Credentials | Time-limited, per-session, never stored, never logged |
| Relay destinations | Private/loopback/link-local/metadata ranges blocked |
| Retention of coturn logs | Shortest workable period; see [RETENTION.md](RETENTION.md) |

**Requirement:** NFR-SEC-006, ADR-006.

---

## 7. Retention summary

Full schedule: [RETENTION.md](RETENTION.md).

| Data | Retention |
| --- | --- |
| Chat content | **Not stored** |
| Media | **Not stored** |
| Session metadata | 30 days |
| Reports | 12 months |
| Moderation actions and audit | 24 months |
| Bans | 24 months; indefinite bans reviewed |
| IP-derived risk signals | 7 days rolling |
| Telemetry | 13 months |
| coturn logs | Shortest workable |

**Requirement:** NFR-PRIV-005, ADR-013.

---

## 8. Report retention

| Aspect | Detail |
| --- | --- |
| Retention | 12 months |
| Contains | Session id, reporter and peer session identities, category, timestamp, optional note |
| Does not contain | Name, email, phone, location, device fingerprint |
| Access | Moderators with the appropriate role, audited |
| Deletion | On the retention schedule, or on a substantiated deletion request within legal limits |

---

## 9. Chat retention

**Zero.** Chat messages are held in memory for the duration of the session and are then
dropped. They are never written to a database, an object store, a log, or a cache.

This is a deliberate product decision with a real cost: moderators usually cannot
reconstruct a conversation. It is accepted, and it is disclosed to users in the consent
flow ("conversations are not recorded or stored").

---

## 10. Media retention

**Zero.** No recording path exists. Media is never captured, stored, or uploaded. This is
enforced by a repository-level rule and a lint check.

---

## 11. Analytics

| Principle | Detail |
| --- | --- |
| Aggregate only | Metrics are counts, rates, and durations |
| No content | Never message bodies, report notes, or media |
| No identity linkage in metrics | Metric labels are low-cardinality enumerations only |
| No third-party SDKs in the chat surface | Prevents auto-capture of screen content |
| Trace attributes | Allowlisted; identifiers permitted on spans, never as metric labels |
| Retention | 13 months, access-controlled separately |

**Requirement:** NFR-OBS-002, ADR-015.

---

## 12. Cookie policy

| Cookie | Purpose | Lifetime | Necessary? |
| --- | --- | --- | --- |
| Session/identity cookie | Participant identity for the browser session | Session | Yes — the product cannot function without it |
| CSRF token | Request forgery protection | Session | Yes |
| Consent record | Age/consent attestation version | Session (client-side) | Yes — required by FR-ENTRY-009 |

**No advertising cookies. No third-party cookies. No cross-site tracking. No analytics
cookies.** If a non-necessary cookie is ever introduced, it requires consent and a privacy
notice update.

---

## 13. Local storage

| Stored | Where | Lifetime |
| --- | --- |
| Age attestation + consent version | `sessionStorage` | Browser session |
| Participant identity | `sessionStorage` | Browser session |
| Block list | `sessionStorage` | Browser session |

`localStorage` is used only for non-sensitive preferences (e.g. reduced-motion
acknowledgement). Nothing in local storage identifies a person.

**Degradation:** if storage is unavailable (private mode, blocked), the product degrades to
in-memory state and does not crash (EC-23).

---

## 14. Deletion

| Request type | Handling |
| --- | --- |
| Delete my chat | Nothing to delete — it was never stored |
| Delete my session identity | It dies with the browser session automatically |
| Delete my reports | Honoured within legal limits; the decision and its basis are recorded |
| Delete my ban record | May be legally required to persist; honoured to the extent the law allows |
| Delete everything about me | Processed item by item; anything legally required to persist is identified to the requester |

Because there are no accounts, a deletion request must reference a session identity the
requester can substantiate. This is a genuine limitation and is disclosed.

---

## 15. Data subject rights

| Right | How it is met |
| --- | --- |
| Access | A requester can obtain the safety records tied to a substantiated session identity |
| Rectification | Report notes can be corrected; audit records cannot be altered (by design) |
| Erasure | See §14 |
| Restriction | A restriction can be applied pending review |
| Portability | Safety records are exportable in a machine-readable format |
| Objection | Enforcement decisions can be appealed |

---

## 16. Data inventory

| Data | Collected | Purpose | Retention |
| --- | --- | --- | --- |
| Participant identity | Yes (generated) | Session scoping | Browser session |
| Session metadata | Yes | Safety, investigation | 30 days |
| Chat content | **No** | — | — |
| Media | **No** | — | — |
| Report category | Yes | Safety | 12 months |
| Report note | Optional | Safety | 12 months |
| Interests | Optional | Matching | Queue entry lifetime |
| Language | Optional | Matching | Queue entry lifetime |
| Region constraint | Derived | Matching | Queue entry lifetime |
| IP address (raw) | Transient | Connection security | Not retained |
| IP-derived hash | Yes | Rate limiting | 7 days |
| Device fingerprint | **No** | — | — |
| Name / email / phone | **No** | — | — |
| Age attestation | Yes (boolean + version) | Safety | Safety event, 12 months |
| Telemetry | Aggregate | Operations | 13 months |

---

## 17. Privacy requirements traceability

| Requirement | Section |
| --- | --- |
| NFR-PRIV-001 | §1 |
| NFR-PRIV-002 | §2 |
| NFR-PRIV-003 | §3.3, §5, §6 |
| NFR-PRIV-004 | §3.1, §4, §11, §16 |
| NFR-PRIV-005 | §7, §9, §10 |
| NFR-PRIV-006 | §14, §15 |

---

## 18. Review cadence

| Review | Frequency | Owner |
| --- | --- | --- |
| Data inventory | Quarterly | Privacy + Engineering |
| Retention schedule | Quarterly | Privacy + Legal |
| IP exposure policy | Quarterly | Privacy + Trust & Safety |
| Cookie policy | On change | Privacy |
| Privacy notice | On change | Privacy + Legal |
