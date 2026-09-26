# PRODUCT SPECIFICATION — CONTENT INTEGRITY

Requirements: NFR-ETH-001…004, FR-TRANSCRIPT-008/010/014, FR-CONTENT-004/005 · ADRs: ADR-0012,
ADR-0014, ADR-0023, ADR-0024

---

## 1. Why this is a separate specification

MajelisHub publishes **religious speech** — Qur'anic recitation, hadith, scholarly attributions, Arabic
phrases and Indonesian explanation. A machine transcript of that material is *wrong* in ways that
matter: a dropped particle, a misheard verse reference, an Arabic word mangled by an acoustic model, an
attribution attached to the wrong scholar. For ordinary media a bad transcript is an annoyance; here it
can be a fabricated quotation attributed to a person or to revelation.

Therefore integrity is not a feature; it is a constraint on every part of the pipeline.

## 2. The five rules

1. **Machine text is never authoritative.** It is a draft, labelled as such, and unreachable by the
   public until a named human approves it (ADR-0012).
2. **No silent correction of religious content.** No automation may "fix", normalise, complete or
   reword Qur'anic verses, hadith, Arabic phrases or attributed claims (NFR-ETH-002).
3. **Uncertainty is displayed, not smoothed away.** Where the machine or the reviewer is unsure, the
   published page says so.
4. **Provenance is always visible.** Every published media item states who reviewed it, when, which
   revision, and from which source (recorded audio) it came.
5. **People control their own words.** A speaker can withdraw an item; withdrawal is honoured visibly
   and never quietly reversed (`CONTENT.md` §10).

## 3. What the published page must show

```
┌───────────────────────────────────────────────────────────────┐
│  Kajian Ba'da Subuh · Ahad, 11 Okt 2026 · Masjid Al-Hikmah    │
│  Ustadz Abdurrahman (dikonfirmasi)                            │
│                                                               │
│  [ Putar audio (2 j 14 m) ]                                   │
│                                                               │
│  Transkrip — hasil tinjauan manusia                           │
│  Ditinjau oleh: Nama Reviewer (panitia) · 13 Okt 2026          │
│  Revisi #4 dari rekaman sesi 11 Okt 2026                       │
│  ⚠ Bagian bertanda "?" belum dapat dipastikan (3 tempat)       │
│                                                               │
│  00:12:04  … penjelasan tentang إخلاص …                       │
│  00:12:31  [﹖ tidak jelas] kalimat berikut tidak dapat         │
│            dipastikan, dengarkan 00:12:31–00:12:44             │
│                                                               │
│  Catatan: teks Arab yang muncul adalah sebagaimana diucapkan;  │
│  tidak ada koreksi otomatis yang diterapkan.                   │
└───────────────────────────────────────────────────────────────┘
```

Elements that are **mandatory** on any published transcript: reviewer identity, review date, revision
number, source recording reference, uncertainty markers preserved, and the no-automatic-correction
statement.

## 4. Uncertainty model (product-facing)

| Marker | Meaning | Display |
|---|---|---|
| Certain | The reviewer is confident | Normal text |
| Uncertain | Plausible but not verified (names, numbers, rare words) | Underline/dotted marker + tooltip "belum dipastikan" |
| Unintelligible | Cannot be transcribed | Inline marker with the audio range, never invented text |
| Recitation | Qur'anic verse or hadith text | Typographically distinct (Arabic-safe type), never altered by automation, citation shown when provided |
| Attribution | Claimed to come from someone other than the speaker | Visually flagged; reviewer must confirm the attribution or mark it uncertain |

Rules: markers survive publication and unpublishing; markers are part of revisions (a revision either
keeps or changes them explicitly); no aggregate "confidence score" is shown to the public (it would be
false precision and it invites ranking of speakers).

## 5. Reviewer duties (human, non-delegable)

1. Listen to enough audio to verify the text — not a skim.
2. Never "tidy" a quotation to match memory; when memory and audio disagree, the audio wins and the
   uncertainty is marked.
3. Verify citations before publishing them as citations.
4. Verify attributions; if a claim's attribution cannot be verified, mark it uncertain or remove the
   attribution while keeping the speech.
5. Record a reason for any blocking flag that is overridden.
6. Refuse to approve under pressure: the workflow has no "publish now, review later" option.

## 6. Corrections after publication

| Situation | Process |
|---|---|
| Typo/minor error in non-religious text | Reviewer creates a new revision, approves it; the public page shows the revision number and date (no silent edits) |
| Misquoted verse or hadith | Withdraw the item or publish a corrected revision; a notice appears on the item explaining that a correction was made |
| Misattribution to a speaker | Withdraw, notify the speaker's profile owner where possible, then republish only with review |
| Speaker or mosque requests removal | Withdrawal path (`CONTENT.md` §10) — no argument, no silent retention in a public place |
| Archive integrity challenged | The revision history and the original recording remain available to authorized roles, so a dispute can be reconstructed |

## 7. What we will not build (integrity anti-features)

1. **No AI summarisation presented as the speaker's words.** Summaries may exist only as clearly labelled
   machine-generated aids *inside* the organizer/reviewer tools, never on the public page.
2. **No automatic translation of religious text.**
3. **No "improve this transcript" one-click rewrite.**
4. **No auto-generated verse references** offered as if verified.
5. **No numeric quality score of a transcript or a speaker.**
6. **No publishing of partial transcripts** (the first 20 minutes while the rest is under review) —
   partial publication creates misquotation risk.
7. **No silent editorial changes** after publication: every change is a new revision with a visible note.

## 8. Acceptance questions (used in review of any change touching published content)

1. Can a machine-produced sentence reach a public page without a named human approving it? (Must be no.)
2. Can any automation modify a stored segment containing recitation or a citation? (Must be no.)
3. Does the public page state who reviewed the text, when and which revision?
4. Are uncertainty markers preserved through every state transition?
5. If a speaker withdraws, is the removal visible and complete from public surfaces?
6. Does any new feature introduce a ranking, score, count-as-status, or comparison of people?
7. Is the honest failure state ("transkrip belum tersedia", "rekaman gagal") implemented, not just the
   happy path?
