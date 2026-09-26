# INCIDENT RESPONSE

Requirements: NFR-SEC-012, NFR-PRIV-009, FR-AUDIT-005 · Legal frame: UU PDP 27/2022 (72-hour breach
notification duty) · Related: `SECURITY.md`, `PRIVACY.md`, `RUNBOOK.md` RB-14

---

## 1. Principles

1. **Contain first, explain second.** Stop the bleeding (revoke, disable, isolate) before composing any
   message.
2. **Never destroy evidence.** No wiping logs, no "cleaning up" a compromised account before capturing
   state; a compromised host is snapshotted, not rebuilt in a hurry.
3. **Assume personal data may be involved** until disproven — the notification clock (72 hours from
   awareness) is legal, not advisory.
4. **Speak plainly and early to the affected people.** A mosque community will forgive an incident
   handled honestly; it will not forgive silence.
5. **Write everything down as it happens.** Timestamps, decisions, who decided, what was verified.

## 2. Severity ladder

| Level | Definition | Examples | Response |
|---|---|---|---|
| S1 Critical | Personal data exposed, altered, or lost; or the entrance/attendance integrity is compromised at scale | Token database leak; attendance rows deleted; public exposure of contacts or transcripts; admin account compromise | Immediate containment, war-room, notification assessment (72 h), written report |
| S2 High | Security control bypassed without confirmed data impact; sustained availability loss during an event | Privilege escalation blocked but demonstrated; scanning flood; storage outage during recording | Containment same day, impact assessment, fixes with tests |
| S3 Medium | Attempts or misconfigurations with limited exposure | Rate limits ineffective; signed URL over-shared; logging of a token field | Fix within days, verify, record |
| S4 Low | Cosmetic or theoretical findings | Missing header on a minor route | Backlog with an owner |

## 3. Playbook (in order)

1. **Detect & declare** (0–15 min): anyone may declare. Create the incident record (time, reporter,
   observed facts, severity guess). No blame in the record.
2. **Contain** (15–60 min): the specific actions available —
   revoke sessions/tokens; disable an account; disable a feature flag (publishing, notifications,
   transcription, recording, registration); rotate storage/DB/email credentials; remove a malicious
   material; block an offending network path at the proxy. Prefer the **most surgical** action.
3. **Preserve** (parallel): snapshot the database (or the affected tables), export the audit slice for
   the window, save relevant logs/metrics, record the storage object list. Note *what was not* captured.
4. **Assess impact** (within hours): whose data, which categories, how many records, which organizations,
   was it exposed (confidentiality), altered (integrity), or destroyed (availability)? Use the audit
   trail and `PRIVACY.md` data inventory to enumerate categories. Explicitly determine: does personal
   data fall under UU PDP? Is a controller/processor split involved (hosted STT, email provider)?
5. **Notify decision** (before the 72-hour mark): if personal data is involved →
   affected individuals + the authority per the legal advice in force; if the deployment is a mosque's
   own instance, the responsible organization decides with the platform administrator's support. Draft
   wording: what happened, what data, when, what we did, what the person should do, who to contact. No
   speculation, no minimisation.
6. **Eradicate & recover**: fix the cause (code with a regression test, configuration, credential
   rotation), verify the fix independently, then re-enable features one at a time with monitoring.
7. **Review** (within 7 days): blameless post-mortem → threat-model update (`THREAT_MODEL.md` row),
   new/updated tests, task updates in `TASKS.md`, runbook corrections, and (if a control proved
   inadequate) a superseding ADR.

## 4. Communication templates (structural, not final wording)

| Audience | Content | Never include |
|---|---|---|
| Internal (ops) | Facts, actions taken, next step, owner, next update time | Speculation, blame |
| Mosque administration | What happened in plain Indonesian, what it means for their community, what we did, what to tell participants | Technical detail that does not help them |
| Affected participants | What data, what happened, what to watch for, what we changed, how to contact us | Volume speculation, reassurance without substance |
| Public (only if unavoidable) | Confirmed facts, steps taken, prevention | Any detail about individuals |

## 5. Legal and regulatory hooks (UU PDP 27/2022)

| Obligation | How the product supports it |
|---|---|
| 72-hour breach notification | Audit trail + data inventory + this playbook make scope assessment fast; the incident record timestamps awareness |
| Right to information about processing | `PRIVACY.md` notice, in-product statements at collection points |
| Data subject rights | DSR procedure in `OPERATIONS.md` §5 with documented SLAs |
| Processor accountability | Processor table in `PRIVACY.md` §5; a new processor requires an ADR |
| Security obligations ("appropriate technical measures") | Encryption in transit/at rest, access control, RLS, audit trail, retention limits, least privilege — each with a task ID |
| Record-keeping | Retention evidence records, deletion records (counts only), audit retention 7 years |

Legal review is required before sending any external notification; this document defines the process,
not the legal conclusion for a specific deployment.

## 6. Post-incident artefacts (required)

1. Incident record (timeline, decisions, evidence list).
2. Impact statement (data categories, counts, orgs, verification method).
3. Notification copies (internal, affected, authority) with send timestamps.
4. Remediation list with owners and dates, each mapped to a task ID.
5. Test added that would have caught it (or an explicit statement of why a test is not feasible, plus a
   detection improvement instead).
6. Threat-model and runbook updates.

## 7. Common failure modes in incident handling (avoid these)

- Rebuilding the compromised host before snapshotting.
- Rotating credentials without checking whether the old ones were used elsewhere.
- Declaring "no personal data involved" without checking the data inventory.
- Waiting for a perfect explanation before telling affected people anything.
- Fixing the symptom (deleting a malicious item) without fixing the path that allowed it.
- Forgetting the second-order effects: notification intents already queued, exports already generated,
  signed URLs still valid until expiry (documented residual risk).
