# StrangerLink — Minors Protection

- **Status:** Architecture phase — **critical safety document**
- **Last updated:** 2026-09-26
- **Related:** [SAFETY.md](../../SAFETY.md), [docs/safety/AGE-GATING.md](AGE-GATING.md), [ADR-010](../adr/ADR-010-moderation-model.md)

---

## 0. Position

**Zero tolerance.** Any indication that a participant is a minor is a P0 event that
bypasses the normal enforcement ladder entirely.

A first minor-safety report does not produce a warning. It produces immediate termination,
immediate restriction, and immediate escalation.

---

## 1. Structural protections

The strongest protections against minors are structural, not procedural:

| Protection | Effect |
| --- | --- |
| **18+ age gate** | Required before any chat capability ([AGE-GATING.md](AGE-GATING.md)) |
| **No minor mode** | There is no filtered, restricted, or supervised mode for minors |
| **No parental consent path** | There is no mechanism for a minor to participate with consent |
| **No user discovery** | No search, no directory, no profiles — a minor cannot be found and targeted |
| **No attachments** | The primary vector for illegal content is structurally absent (NG-3) |
| **No media recording** | No evidence artifact is created or stored (FR-MEDIA-008) |
| **No private channels** | No way to move a conversation off the session |
| **Pairwise only** | No group chats, rooms, or broadcast (NG-9) |
| **Bounded sessions** | 30-minute cap; 10-minute idle cap |
| **Session identities only** | No persistent identity for a minor to accumulate |

---

## 2. Detection

| Signal | Source | Action |
| --- | --- | --- |
| **Report with category "minor safety"** | A participant reports | Immediate P0 |
| **Self-disclosure in chat** | A participant states their age | Detected only if reported; no automated classification exists |
| **Behavioural signals** | Language patterns, claimed school attendance | Weak; review flag only |
| **Moderator observation** | Session metadata anomalies | Review |

**We do not run automated age inference on chat content.** It would require reading all
content — a privacy cost we will not pay — and its false-positive rate on adult users would
be unacceptable.

---

## 3. Response protocol

| Step | Action | Actor |
| --- | --- | --- |
| 1 | Session terminated | Automatic on report |
| 2 | Reported identity restricted immediately | Automatic — **before investigation** |
| 3 | P0 moderation case created | Automatic |
| 4 | On-call paged | Automatic |
| 5 | Trust & Safety senior moderator engaged | On-call |
| 6 | Legal counsel engaged if the content may be illegal | Senior moderator |
| 7 | Law-enforcement escalation assessed | **Legal counsel only** |
| 8 | Every step audited | Automatic |

**The on-call engineer does not contact law enforcement directly.** Escalation goes through
legal counsel.

---

## 4. What we can and cannot do

| Can | Cannot |
| --- | --- |
| Terminate the session immediately | Prevent the minor from returning under a new identity |
| Restrict the identity | Verify the age of a new identity |
| Escalate to counsel | Reconstruct the conversation (it does not exist) |
| Record the event | Prove what was said |
| Apply a ban to the identity | Guarantee no minor ever uses the service |

**This limitation is disclosed** in the eight limitations in
[SAFETY.md](../../SAFETY.md) §1: "We cannot guarantee no minor will ever use the service."

---

## 5. What we will not build

| Not built | Why |
| --- | --- |
| A minor mode | Would require age verification and would create a supervised-minor chat surface |
| A parental consent flow | Creates a verified-minor population in a stranger-chat product |
| Automated age inference on content | Privacy cost; unacceptable false-positive rate |
| Age verification via documents | Profound privacy cost; contradicts NFR-PRIV-001 and NG-4 |
| Reporting a minor's identity to a third party | Legal review required; not an engineering decision |

---

## 6. Reporting category

"Minor safety" is a **distinct, visually distinguished P0 category** in the report flow.
It is not folded into "sexual content" or "other".

| Property | Detail |
| --- | --- |
| Position in the list | Distinguished as urgent |
| Severity | P0, always |
| Routing | Dedicated always-monitored queue |
| Response target | Immediate |
| Progressive enforcement | **Not applicable** — no warning step |

---

## 7. Crisis and support resources

Where a report involves self-harm or a minor in distress, the response surfaces appropriate
resources without clinical intervention. The resource list is:

- region-aware, where a region can be determined without requiring disclosure;
- reviewed by a qualified party before launch;
- maintained as content, not code.

See [SAFETY.md](../../SAFETY.md) §8.3.

---

## 8. Metrics

| Metric | Target |
| --- | --- |
| Minor-safety reports per 10,000 sessions | As low as possible; any non-zero investigated |
| Time from P0 creation to acknowledgement | p95 < 15 minutes |
| Time from report to identity restriction | < 1 minute |
| Escalation drill frequency | Quarterly |

---

## 9. Implementation status

No minor-safety detection or response logic exists. Tracked as **T-SAFE-052** in
[TASKS.md](../../TASKS.md). The protocol above is the specification.
