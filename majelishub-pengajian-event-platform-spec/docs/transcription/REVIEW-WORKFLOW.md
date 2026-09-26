# TRANSCRIPT REVIEW WORKFLOW

Requirements: FR-TRANSCRIPT-006…014 · ADRs: ADR-0012 (mandatory human review), ADR-0023 (append-only
revisions) · Related: `TRANSCRIPTION.md`, `docs/transcription/CODE-SWITCHING.md`, `docs/product/CONTENT-INTEGRITY.md`

---

## 1. The workflow in one picture

```
draft ready ──▶ assigned ──▶ reviewer works ──▶ flags resolved ──▶ approve ──▶ publish ──▶ provenance shown
   (rev #1)      (queue)      (rev #2…n)         (blocking=0)        (binds rev)   (public)
                                     │
                                     └─▶ needs help ──▶ reassign / ask the organizer ──▶ (no publishing)
```

Nothing in this diagram may be skipped, automated or run in parallel with publication. The only actor
who can approve is a human with the `transcript.approve` permission, and the only revision that can be
published is the one that was approved.

## 2. Roles and separation of duties

| Role | Can do | Cannot do |
|---|---|---|
| Transcript Reviewer | Edit segments, mark certainty, flag citations, save revisions | Approve their own work when they are also the requester, publish directly |
| Organizer | Request transcription, assign/reassign reviewers, decide publication | Edit text silently (any edit is a revision with their name), approve as a proxy |
| Mosque Administrator | See status, request withdrawal | Approve |
| Platform Administrator | Recover, intervene in incidents, unpublish | Bypass the gate, edit text without a revision |
| Speaker | Request withdrawal/correction | Approve (they are not the platform's reviewer) |

Enforcement: `requirePermission` plus explicit SoD rules (a reviewer cannot approve a revision they are
recorded as the author of, unless a second approver is recorded; the requester cannot self-approve).

## 3. Review session (the actual work)

1. Reviewer opens the item: audio player + text side by side, timestamp-linked.
2. Work order is deliberate: **listen → verify names and numbers → verify Arabic/recitation → verify
   attributions → mark uncertainty → resolve blocking flags**.
3. Editing rules: text edits create a new revision (autosave creates intermediate revisions; a revision
   is never overwritten); markers are part of the revision; hints are suggestions requiring an explicit
   acceptance.
4. Blocking flags (must be resolved or explicitly acknowledged with a reason):
   - `POSSIBLE_RECITATION` segments unverified
   - `LOW_CONFIDENCE` segments not listened to (the UI records that playback covered the range)
   - Attributions (who said this) unverified
   - Gaps unresolved in a way that makes a sentence misleading
5. Non-blocking flags are advisory and recorded as acknowledged.

## 4. Approval

| Step | Effect |
|---|---|
| Approve (rev N) | `approved_by`, `approved_at`, `approved_revision_id = N` are written in one transaction |
| Publication | Sets `published_at`; database CHECK enforces the pairing with the approval; the public projection serves revision N |
| Unpublish | Requires a reason; removes from search and public navigation; audit entry; audio signing for the public path is refused |
| Edit after approval | Creates a **new** revision; the public output still serves N until a new approval is recorded (the page shows the published revision number, so there is no confusion) |
| Second approval without changes | Not allowed: an approval binds a revision, and re-approving the same revision is a no-op (idempotent) |

## 5. Quality gates for publication (all must hold)

1. A named approver, a revision number, and an approval timestamp exist.
2. No blocking flag is unresolved or unacknowledged.
3. The event's policy permits transcript publication (`PUBLISH_AUDIO_AND_TRANSCRIPT`).
4. The transcript is not `partial` in a way the reviewer accepted without a note — if partial, the note
   must be published too.
5. Uncertainty markers are intact (they cannot have been stripped by approval).
6. The item has provenance: source audio session id, provider id + model version, machine-draft
   reference, and the review trail.

## 6. Communication with the speaker and the mosque

- The speaker is informed when a transcript of their talk is published, and how to request a correction
  or withdrawal. Silence is not consent to a misquotation.
- Corrections requested by a speaker bypass ordinary queue priority (a misattribution is an integrity
  incident, not a backlog item).
- The requester's wording ("please fix") is not an instruction to fabricate; the audio remains the
  authority.

## 7. Queue management and SLA

| Signal | Purpose | Action |
|---|---|---|
| `transcript_review_age_s` | How long a draft has waited | Alert at 7 days; organizer sees "perlu ditinjau 3 hari" |
| Flag counts | Where the work is | Reviewer filters by `POSSIBLE_RECITATION`, `LOW_CONFIDENCE`, `ADJACENT_TO_GAP` |
| Playback coverage | Evidence the reviewer listened | Shown as a completion aid; never used to punish anyone |
| Reassignments | Balance | Organizer can reassign with a reason (audited) |

SLA is organizational: the product cannot review faster than a human, and it must never "meet" the SLA
by publishing unreviewed text.

## 8. Rejection and rework

| Situation | Behaviour |
|---|---|
| Reviewer concludes the machine draft is unusable (audio too poor) | Mark `REJECTED_QUALITY` with a reason; audio stays published if the policy allows; the event page states "transkrip tidak dapat dibuat dari rekaman ini" |
| Provider produced a partial result | Review the covered range or re-request; the published page must state the covered range |
| Reviewer disagrees with a hint | Hints are always overridable; the override is recorded |
| Reviewer finds a misattribution in already-published text | Withdraw first, then correct, then republish with a visible correction note |

## 9. What the reviewer must never be asked to do

1. Approve without listening.
2. Publish before flags are resolved because of an event deadline.
3. "Smooth" a quotation to match an expected phrasing.
4. Add citations that were not spoken.
5. Approve on behalf of another person.
6. Work in a way that makes them personally identifiable to the public beyond the reviewer name the
   product intentionally displays (no contact details, no schedule history).
