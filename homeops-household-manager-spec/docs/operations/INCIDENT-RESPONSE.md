# Incident Response

> Companion to RUNBOOK.md (the literal steps) and OPERATIONS.md (routine). This file is the **decision framework**: how to classify, how to behave, what to tell the household, and how to learn.
> Scale honesty: this is a single-operator, single-household-per-instance product. "Incident response" means one tired person making good decisions in a defined order — not an incident command structure.

## 1. Severity classes

| Class | Definition | Examples | First response | Target |
| --- | --- | --- | --- | --- |
| **S1 — Critical** | Data loss, exposure, or total outage | Cross-household exposure; DB corruption; site down; credentials leaked; unable to sign in at all | Stop the bleeding first (take the app down if exposure is ongoing) | Acknowledge to the household within 2 h; fix or contain within 24 h |
| **S2 — Major** | A core capability is broken for everyone | Scheduler stalled > 1 h; notifications dead; dashboard failing; restore needed | Fix in place, keep the app up if safe | Same day |
| **S3 — Minor** | Degraded or intermittent | One job slow; one member's push failing; a page erroring under a rare path | Fix in the normal change flow | Within the week |
| **S4 — Cosmetic** | Annoyance | Copy error; misalignment; confusing wording | Batch into the next slice | Next release |

Guiding rule: **the class depends on impact on people and data, not on how technical the cause is.** A one-line environment typo that breaks push for everyone is S2, not S4.

## 2. First 15 minutes (any class)

1. **Stop and look before touching.** Note the time, what was reported, what you observed.
2. Check `/api/health` and `?deep=1`; check the last deploy (a deploy is the most common cause).
3. Decide: is data at risk right now? If yes — stop writes, then think (a stopped app is recoverable; corrupted data is expensive).
4. If there may be a security dimension (unexpected sessions, role changes, suspicious attachment requests), treat it as S1 until proven otherwise.
5. Pick the matching RUNBOOK procedure. If none matches, write the steps down as you improvise — that draft becomes the new procedure.

## 3. Roles (and their absence)

| Role | Who | Notes |
| --- | --- | --- |
| Responder | The operator | Does the technical work |
| Communicator | The operator, wearing a second hat | The household must not be left guessing |
| Decision maker | The operator | Rollback, take-down, restore, delete |
| Scribe | The operator (during/after) | A timeline written during the incident is worth ten reconstructions afterwards |

There is no escalation path, so **the runbook is the senior engineer**. If a step is missing or wrong, the incident is not over until the runbook is fixed.

## 4. Communication with the household

| Class | When | What to say |
| --- | --- | --- |
| S1 | Within 2 h of detection | What is affected, whether data is safe, what they should do meanwhile (if anything), when the next update is |
| S2 | Same day | What is broken, impact in household terms ("reminders won't arrive today"), workaround, next update |
| S3/S4 | In release notes | Concise, no drama |

Principles: speak in household terms ("the bins reminder didn't go out"), never in stack traces; never guess at data safety — say "still checking" if you don't know; give the next update time and keep it; do not use the product's own notification channels during an outage to announce the outage (it may be down); do not put household data in the announcement.

## 5. Decision tree (the four hard calls)

**Take the app down?** Yes when exposure is ongoing, when data integrity is in doubt, or when you cannot tell. No when the fault is cosmetic or when degraded service is genuinely useful (read-only beats nothing).

**Roll back or roll forward?** Roll back the code if the deploy is the suspect and the migration was additive. Roll forward if a destructive migration already ran, if the bug is understood and small, or if the previous image cannot read the new schema. Never "unexecute" a migration in place.

**Restore or repair?** Restore when data is corrupt or deleted and you know the last good point. Repair (targeted SQL, a script, a fix-forward backfill) when the damage is narrow and a full restore would lose more than it recovers. Prefer the narrower option, and always take a fresh backup before attempting a repair.

**Delete or preserve?** Never delete during an incident. Delete only as part of a documented procedure (household deletion), after a backup, and in writing.

## 6. Security incidents (S1 by default)

1. Contain: revoke sessions, remove suspicious push subscriptions, rotate the affected credential.
2. Verify whether the database credentials, the session secret, or a member's account was the vector — the response differs (rotate at the source, not just the symptom).
3. Preserve evidence: do not wipe logs; export the relevant window (ids and codes, no content).
4. Assess scope honestly: because the product logs no content and exposes no admin UI over household data, the worst plausible scope is bounded by what a session could read in the window — say exactly that, and nothing more.
5. For the household: state what happened, what they should do (usually just re-sign-in and check their data), and whether they need to act (e.g. change a reused password).
6. Post-incident: rotate anything rotated during the incident again if there was any doubt about the path; add the missing control to SECURITY.md.

## 7. Post-incident (within 72 h)

```markdown
## Incident — <date> — <class>
- Summary (one sentence, household terms)
- Timeline (detection, actions, resolution, verification) with times
- Impact: who was affected, what was lost (if anything), how long
- Root cause: the mechanism, not the blame
- What worked / what didn't in the runbook
- Corrective actions: each with an owner and a date (docs, code, monitoring, or process)
- What we will tell the household (if not already sent)
```

Rules: every S1/S2 post-incident ends with at least one **documentation** change (docs get better after every real incident, or the next one is identical); corrective actions are added to TASKS.md as ordinary tasks rather than being remembered by willpower; the postmortem is blameless in tone and precise in fact.

## 8. Standing limitations to admit when asked

- There is no 24/7 response; a 03:00 outage waits until morning unless monitoring pages someone.
- Backups are nightly, so up to 24 h of activity can be lost (BACKUP-RESTORE.md §2).
- Restores are proven weekly but never against a total host loss in production; the yearly rehearsal (OPERATIONS.md §2) is the closest proxy.
- Push delivery depends on Google/Apple infrastructure outside our control; in-app alerts are the fallback that always works.
- A single postgres instance has no automatic failover: recovery is a restore, not a failover.

Admitting these before an incident is what makes the response calm; discovering them during one is how small problems become crises.
