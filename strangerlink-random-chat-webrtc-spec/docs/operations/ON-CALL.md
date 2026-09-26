# StrangerLink — On-Call Guide

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [RUNBOOK.md](../../RUNBOOK.md), [OPERATIONS.md](../../OPERATIONS.md), [OBSERVABILITY.md](../../OBSERVABILITY.md)

---

## 0. Position

This is the document an on-call engineer reads first. It assumes no prior context.

**Nothing here has been drilled.** Drills are scheduled for VS-15.

---

## 1. What this system is

A stranger-chat web product. Two people are matched, they talk by text and optionally
audio/video, and either can leave at any time.

Four services:

| Service | What it does | If it breaks |
| --- | --- | --- |
| **web** | Rendering, API, admin surface | No new sessions or reports via web |
| **realtime** | WebSocket, queue, matching, signaling | No new matches |
| **turn** | coturn media relay | Video/audio fails on restrictive networks |
| **db** | PostgreSQL safety records | **Ban checks fail closed → no new matches** |

---

## 2. The five things you must never do

| Never | Why |
| --- | --- |
| **Never bypass fail-closed ban checks** to restore matching | An outage is recoverable; a banned user reaching a stranger is not |
| **Never disable or "temporarily" gate reporting** | There is no kill switch for reporting, by design |
| **Never mass-ban in response to a report spike** | A spike is a signal to investigate. The appeal overturn rate will show the damage |
| **Never contact law enforcement directly** | Escalation goes through legal counsel |
| **Never add logging of message content** to debug something | It does not exist durably, and adding it is a privacy incident |

---

## 3. Paging alerts

| Alert | Severity | First action |
| --- | --- | --- |
| P0 escalation unacknowledged | SEV-1 | RB-06 — page secondary and Trust & Safety leadership |
| Report rate spike | SEV-1 | RB-07 — pull the category distribution before acting |
| Retention job failure | SEV-1 | RB-09 — re-run the job; notify the privacy owner |
| Sessions per participant > 1 | SEV-1 | RB-02 — **stop new matches**; page Trust & Safety |
| Ban store unreachable | SEV-1 | RB-04 — confirm fail-closed; do **not** bypass |
| Signaling protocol violation spike | SEV-1 | RB-10 — confirm connections are being closed |

---

## 4. Ticketed alerts

| Alert | First action |
| --- | --- |
| TURN bandwidth or allocation spike | RB-08 |
| WebRTC setup failure rate | RB-05 |
| Match latency p95 breach | RB-01 |
| WebSocket error rate spike | RB-03 |
| Queue size above capacity | RB-01 |
| Database pool saturation | RB-08 |
| Ban appeal overturn rate > 5% | RB-13 — proportionality review |

---

## 5. Triage flow

```
Alert fires
    │
    ├── Is it a safety alert? ──yes──► Page. Follow the runbook. Involve Trust & Safety.
    │
    ├── Is the ban store unreachable? ──yes──► RB-04. Fail closed is correct. Do not bypass.
    │
    ├── Is the realtime service affected? ──yes──► RB-03 / RB-12
    │
    ├── Is media affected? ──yes──► RB-05. Consider disabling video, then audio. Text continues.
    │
    └── Otherwise ──► RB-01 / RB-08 / RB-11
```

---

## 6. Kill switches

| Switch | Effect | Who can operate |
| --- | --- | --- |
| `media.video.enabled` | Disables video mode at queue join | Trust & Safety |
| `media.audio.enabled` | Disables audio mode at queue join | Trust & Safety |
| `interestMatching.enabled` | Falls back to pure random matching | Trust & Safety |
| `signaling.newSessions.enabled` | Stops new matches; existing sessions continue | Trust & Safety |
| `reports.enabled` | **DOES NOT EXIST** | Nobody |

Every kill switch operation is logged with actor, switch, and reason (NFR-OPS-002).

---

## 7. Dashboards

| Dashboard | Use it for |
| --- | --- |
| **Overview** | First look: queue size, match rate, error rate, alerts |
| **Realtime** | Connections, signaling rates, validation failures |
| **Media** | Setup success/failure, ICE restarts, TURN usage |
| **Safety** | Report rate, category distribution, bans, appeals, P0 latency |
| **Platform** | Latency, error rate, pool saturation, retention runs |
| **Cost** | TURN relayed bytes |

**No dashboard shows chat content.** If you find one that does, it is a defect — report it.

---

## 8. Common situations

### "Users say they can't match anyone"

1. Check `queue.size` — is anyone waiting?
2. Check `matchmaking.match.failed` by `reason_class`.
3. Check whether the ban store is healthy — fail-closed looks exactly like this.
4. Check whether `signaling.newSessions.enabled` is false.
5. Check match latency p95.

### "Users say video doesn't work"

1. Check `turn.share_of_sessions` and `turn.allocation_failed`.
2. Check coturn health.
3. Check `webrtc.setup.failed` by `reason_class`.
4. If media is broadly broken, disable video, then audio. **Text chat is unaffected.**

### "A user says they were disconnected unfairly"

1. Route to the appeal queue.
2. The appeal is reviewed by a moderator other than the issuer.
3. Never explain the moderation reasoning to the user (NFR-SAFE-002).

### "Reports are failing"

**This is a safety incident, not an availability incident.** Escalate immediately. Report
submission has no error budget.

### "Someone reported a minor"

1. RB-14. **Restrict the reported identity immediately**, before investigation.
2. Engage Trust & Safety leadership.
3. Legal counsel if the content may be illegal.
4. Do not contact law enforcement yourself.

---

## 9. Escalation contacts

| Situation | Contact |
| --- | --- |
| Any P0 safety matter | Trust & Safety leadership |
| Illegal content | Trust & Safety leadership → legal counsel |
| Invariant violation | Trust & Safety + Architecture |
| Realtime service | Realtime engineering |
| coturn | Realtime engineering + SRE |
| Database | SRE |
| Privacy incident | Privacy owner + SRE |
| Deploy rollback | Product engineering |

---

## 10. Handover

At the end of a shift, hand over in writing:

- Open incidents and their state.
- Pending safety cases and their acknowledgement status.
- Any kill switch operated, and why.
- Any anomaly noticed but not alerted.
- Anything you chose not to act on, and why.

**A safety case that was noticed but not escalated must be handed over explicitly.**

---

## 11. Before your first shift

- [ ] Read [RUNBOOK.md](../../RUNBOOK.md) end to end.
- [ ] Read [SAFETY.md](../../SAFETY.md) §1 (the limitations) and §8 (escalation).
- [ ] Know where the kill switches are and who can operate them.
- [ ] Know that ban checks fail closed and that this looks like an outage.
- [ ] Know that reporting has no kill switch.
- [ ] Know that you do not contact law enforcement directly.
