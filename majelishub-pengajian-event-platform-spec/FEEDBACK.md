# FEEDBACK

Post-event feedback that improves operations — and never becomes a popularity mechanism.

Requirements: FR-FEEDBACK-001…008 · Policy: ADR-0016 · Ethics: ADR-0024 · Privacy: `PRIVACY.md`

---

## 1. Purpose (and the line we do not cross)

| Questions feedback answers | Questions feedback must not answer |
|---|---|
| Was registration easy? | Is this speaker better than another speaker? |
| Was the venue adequate (space, cleanliness, women's area, accessibility)? | Is the speaker's religious knowledge adequate? |
| Could people hear clearly? | Is the speaker popular? |
| Was the topic level appropriate for the audience? | Should the mosque book this speaker again? (that is a human decision, made from conversations and observations) |
| Was the event well organized (time, flow, announcements)? | — |

The product therefore has **no speaker-quality dimension**, no star ratings shown anywhere public,
and no aggregates that compare speakers (ADR-0024).

## 2. Dimensions

| Key | Label (ID) | Scale | Notes |
|---|---|---|---|
| `registration` | Kemudahan pendaftaran | 1–5 or skip | Only shown if the participant registered |
| `venue` | Tempat dan fasilitas | 1–5 or skip | Space, wudu, women's area, parking, accessibility |
| `audio` | Kejelasan suara | 1–5 or skip | Heart of the operational value: the PA/sound is the most common failure |
| `topicRelevance` | Kesesuaian topik | 1–5 or skip | Framed as "sesuai dengan yang diharapkan?" — about expectations, not quality of scholarship |
| `organization` | Penyelenggaraan acara | 1–5 or skip | Timing, announcements, flow |
| `overall` | Pengalaman keseluruhan | 1–5 | The only required rating |
| `comment` | Catatan (opsional) | free text ≤ 2000 | Explicitly scoped: "tentang penyelenggaraan dan fasilitas" |

Scale labels: 1 = Sangat kurang · 5 = Sangat baik. A "skip" is allowed per dimension (and counts as
no data, not as a 3).

**Validation rejects** any unknown rating key, so a client cannot inject a `speaker` dimension.

## 3. Collection window and audience

- Window: from the event's completion until **+14 days** (configurable 3–30).
- Audience: only people with a plausible presence:
  - participants with an attendance record (`VALID`/walk-in/manual), and
  - registered participants (so `NO_SHOW` people can report on-registration friction), distinguished
    in reporting as "peserta terdaftar yang tidak hadir" so their venue/audio ratings do not distort
    perception of the session.
- Request count: **exactly one** request per person per event (`FR-NOTIF-007`), via the notification
  outbox. No reminders beyond one, no pressure, no reward for responding.
- `NO_REGISTRATION` events: no feedback request is sent (we cannot identify attendees, and pushing a
  public feedback form invites abuse).

## 4. Anonymity (ADR-0016 in practice)

The submission form states truthfully, in one line, before submission:

> *"Umpan balik ini anonim. Penyelenggara tidak dapat mengetahui siapa yang mengirim."*
> or *"Umpan balik ini akan dikirim dengan nama Anda, agar penyelenggara dapat menindaklanjuti."*

Enforcement (not just a promise):

| Rule | Mechanism |
|---|---|
| Anonymous submissions store no link to the participant | `is_anonymous = true ⇒ registration_id IS NULL AND contact_hash IS NULL` (DB check) |
| Anonymous submissions are rate-limited without identification | Per-event key derived from the capability token, stored as a hash, deleted with the token |
| Audit events for anonymous submissions carry no actor | Documented exception in `SECURITY.md` §Audit |
| Small-sample protection for speaker-facing aggregates | Aggregates with n < 5 show "belum cukup data" |
| The organizer cannot de-anonymise by combining fields | The submission stores no timestamps precise enough to correlate with attendance times (day granularity only for anonymous submissions) |

## 5. Visibility rules

| Viewer | Sees | Does not see |
|---|---|---|
| Organizer (scoped to the event) | All ratings (aggregate + distribution), all comments with anonymity respected, identified comments with the sender's name | — |
| Speaker | Aggregate ratings for events they spoke at (n ≥ 5) and only comments the submitter opted to share (`shareWithSpeaker`) | Individual ratings, anonymous free text not shared, any comparison with other speakers |
| Platform admin | Aggregates for operational health; free text only through a moderation/report path | Bulk reading of comments (no "browse all feedback" surface) |
| Public | **Nothing** | Everything |

Organizer dashboard view (conceptual):

```
Umpan balik · Kajian Ba'da Subuh 11 Okt 2026
Terkirim 42 · dari 310 hadir (14%)
Keseluruhan  4.3 (n=42)
Kejelasan suara  3.1 (n=40)  ← 9 peserta memberi nilai ≤2 · komentar terkait: 5
Tempat & fasilitas 4.0 (n=38)
Penyelenggaraan  4.4 (n=41)
Catatan (12) — sebagian besar tentang mikrofon di sisi kanan ruangan
Tindak lanjut: [tandai ditangani] [teruskan ke pengurus masjid]
```

Notes: comments are grouped by dimension for triage; a "tindak lanjut" (follow-up) flag lets an
organizer record that a specific issue was acted on — that state is what makes feedback useful
rather than decorative.

## 6. Abuse and moderation

- A comment can be **reported** by the organizer or the speaker (e.g. insulting a person, or
  unrelated religious polemic).
- Reported comments are hidden from aggregate views pending a moderation decision; the row and the
  audit trail are retained (`FR-FEEDBACK-006`).
- Repeated abusive submissions from the same capability are rate-limited; there is no public
  shaming and no participant score.
- The product does **not** attempt automated sentiment analysis to filter abuse in MVP (a false
  positive would suppress legitimate criticism).

## 7. Aggregation and retention

- Raw feedback (including free text) is retained **12 months** after the event, then replaced by
  aggregates (`RETENTION.md` §Feedback): per-event dimension averages and comment **themes** are not
  derivable from free text after deletion, which is the intended privacy outcome.
- Aggregates (per event) are retained with the event for reporting history.
- Deleting a participant's data (data-subject request) affects identified feedback; anonymous
  feedback is by construction not attributable and therefore not part of the request's scope — this
  is explained honestly in the privacy notice.
- No export of raw comments except through an authorized, audited organizer export with a reason.

## 8. What we deliberately do NOT build

| Feature | Why not |
|---|---|
| Public star ratings for speakers/kajian | ADR-0024 — implies measurable religious quality and creates public judgement of persons |
| Leaderboards ("kajian paling disukai") | Same, plus engagement optimisation |
| Sentiment dashboards | False precision on free text; encourages over-reading a small volunteer dataset |
| Survey builders / arbitrary question types | Scope creep; the six fixed dimensions exist to be comparable and operational |
| Incentives (points, prizes) for feedback | Manipulates data quality and is inappropriate in a worship context |
| Per-speaker comparative reports | Would be a de-facto ranking |

## 9. Acceptance criteria

1. An anonymous submission cannot be linked to a registration (schema + test).
2. The form contains no dimension about the speaker as a person; unknown rating keys are rejected by
   validation (test).
3. The speaker view shows aggregates only with n ≥ 5, and only comments the submitter shared (test).
4. No public page renders any feedback value (test).
5. Exactly one feedback request is queued per participant per event, even after retries (idempotency
   test on `dedupe_key`).
6. Raw comments are deleted 12 months after the event while aggregates survive (retention test).
