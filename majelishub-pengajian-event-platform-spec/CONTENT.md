# CONTENT

The published archive: what a kajian leaves behind, how it is presented, searched, moderated and
owned.

Requirements: FR-CONTENT-001…007 · Content integrity: `docs/product/CONTENT-INTEGRITY.md` ·
ADR-0012, ADR-0014, ADR-0024

---

## 1. What "content" means here

A published kajian is a **bundle**, not a page of text:

| Element | Source | Publication gate |
|---|---|---|
| Title, description, topics, language, audience notes | organizer | event published |
| Speaker, mosque, venue, date | event | event published |
| Audio (normalized asset) | recording | asset ready **+** policy allows **+** human publish action |
| Transcript | reviewed revision | approved revision **+** policy allows |
| Chapters/timestamps | organizer and/or reviewer | event published (chapters) |
| Reference materials (kitab, links, PDF links) | organizer/speaker | validated, never hosted by us |
| Feedback aggregate | participants | organizers only (never public) |
| Summary (optional, later) | human or clearly-labelled machine | human approval; machine summaries labelled generated |

**Ownership principle (`NFR-ETH-003`):** the speaker and the organizing mosque own their content.
The platform is a custodian. Publication authority rests with them; the platform's role is to
enforce policy, not to assert editorial authority.

## 2. Publication policy matrix

| Event policy | Audio | Transcript | Public page |
|---|---|---|---|
| `NONE` | none | none | event page only (title/date/speaker) |
| `INTERNAL` | organizers only | organizers only | event page, no media; UI states "rekaman tidak dipublikasikan" |
| `PUBLISH_AUDIO` | public after publish | not published (may exist internally) | player + chapters |
| `PUBLISH_AUDIO_AND_TRANSCRIPT` | public after publish | public after approval + publish | player + transcript + chapters |

Enforcement is at the **data access layer** (a single policy module), not in UI conditionals
(`docs/product/CONTENT-INTEGRITY.md` §Policy). A test asserts that each policy blocks the
forbidden surface, including direct asset URL requests.

## 3. Public content page (`/kajian/[slug]` → `/rekaman/[id]`, `/transkrip/[id]`)

Order of information (information-first, no hero imagery):

1. Title · topics · language
2. Speaker (linked profile, verification status) · mosque · venue
3. Date and time (venue timezone, weekday always)
4. Audio player with chapters, playback speed, and a "position memory" per device
5. Transcript panel with **provenance header**, timestamp navigation, certainty markers, search
   inside the transcript
6. Reference materials provided by the organizer/speaker (clearly labelled as third-party links)
7. Related sessions in the same program (a plain list by date — never "recommended for you")
8. Actions: share (plain link), download (per policy), report content

## 4. Transcript presentation rules (`CONTENT-INTEGRITY` enforced visually)

1. **Provenance header is mandatory** and non-dismissible on every transcript rendering:
   `Ditinjau oleh <nama>, <tanggal> · revisi #<n>` or `Draf mesin — belum ditinjau`.
2. Uncertainty markers travel with the text: a segment marked `UNCERTAIN`/`UNVERIFIED` shows a chip
   (`?` + text label) and the published page states how many flagged passages exist.
3. Arabic spans render with the Arabic font stack and correct `lang="ar"`; screen readers must not
   read Arabic as Indonesian (`NFR-A11Y-007`).
4. Timestamps are clickable and seek the audio; the current segment is highlighted during playback.
5. The transcript is not editable in the public view; the edit path is only in the review console.
6. A transcript can be **unpublished with a reason**; direct links then show an explanation page
   ("transkrip ini ditarik kembali oleh peninjau/penyelenggara") rather than a 404 — withdrawal must
   be visible, not silent.

## 5. Chapters

- Authored by the organizer during/after review, or by the reviewer while listening.
- Format: `{ startMs, label }`; labels are short, topical, and in the content's language
  ("Adab menuntut ilmu", "Tanya jawab").
- Used by the player, the transcript navigation, and search result deep links.
- No auto-generated chapter titles in MVP; if a future feature generates them, they are labelled
  as generated until a human accepts them (`CONTENT-INTEGRITY` §Generated content).

## 6. Search

- Scope: **only published** content the viewer is allowed to see.
- Index: titles, descriptions, topics, speaker names (with transliteration variants via trigram),
  mosque names/areas, chapter labels, and text of **published** transcript segments (ADR-0014).
- Ranking: textual relevance (`ts_rank_cd`) plus recency; **no engagement ranking** (ADR-0024).
- Results show: content type, title, speaker, mosque, date, and a text snippet with a timestamp
  deep link when the match is inside a transcript.
- Filters: mosque, area, speaker, topic, language, date range.
- Never searchable: drafts, unpublished transcripts, `INTERNAL` audio, feedback, participants.
- Performance budget: p95 ≤ 700 ms for the first page (`NFR-PERF-009`).

## 7. Materials and references

- Materials are **references**: a title, a kind (`KITAB`, `ARTICLE`, `PDF`, `SLIDE`, `LINK`), a URL
  where applicable, and who provided it.
- We do not host arbitrary third-party files (upload abuse surface, `SECURITY.md` §Uploads); a PDF
  reference is a link to the speaker's/organizer's own hosting.
- Every external link is rendered with a visible domain and an external-link affordance; no
  open-redirector or URL shortener of our own.
- Kitab references are a first-class concept ("Kitab: Riyadhus Shalihin, bab …") and may be used as
  a filter later (P2).

## 8. Moderation of published content

| Trigger | Path | Outcome options |
|---|---|---|
| User report | report form on any content page (reason + optional detail) | `NO_ACTION`, `UNPUBLISH`, `REQUEST_CHANGE`, `SUSPEND_SPEAKER`, `RESTORE` |
| Automated signal | none in MVP (we do not auto-moderate religious content) | — |
| Organizer/speaker request | direct unpublish by the owner (audio or transcript) | unpublish with reason |
| Platform verification issue | speaker identity claim disputed | profile suspension pending verification; content may remain with a notice |

Rules: every decision is a record with a reason, an actor and a timestamp; the content owner is
notified and can appeal; unpublishing de-indexes within the same transaction and purges cached
public surfaces; audio access is revoked at the URL-signing step (so an already-copied URL expires,
documented as a residual risk in `THREAT_MODEL.md`).

## 9. Optional/AI-assisted features (gated, never automatic)

| Feature | Status | Rules if built |
|---|---|---|
| AI summary of a reviewed transcript | OPTIONAL, gated | Must be labelled `Ringkasan otomatis — belum ditinjau` until a human accepts it; never replaces the transcript; never the primary content; must not paraphrase Qur'an/hadith as if quoting. |
| Key topics extraction | OPTIONAL | Same labelling; topics are suggestions for the organizer. |
| Chapter suggestions | OPTIONAL | Suggestions only; accepted by a human before display. |
| Transcript-based Q&A / "ask the archive" | REJECTED for MVP | Would position the platform as a religious authority (`PRD.md` NG-10). May be revisited only as a *search* aid with explicit non-authority framing and per-fragment citations. |
| Translation | REJECTED | Creates a second, less verifiable text; not our authority to produce. |

## 10. Retention and unpublishing

- Published content persists until the owner or a moderator unpublishes it, or a retention policy
  applies (`RETENTION.md`).
- A speaker's unlisting request removes profile/first-person surfaces but keeps historical records
  (attendance and event metadata) intact — documented in `PRIVACY.md` §Deletion (§"conflicting
  rights": the mosque's record vs the speaker's request).
- Deleting an event that has published content requires an explicit decision about the content
  (archive or unpublish), recorded in the audit log.

## 11. Acceptance criteria

1. Published pages always state provenance for audio and transcript.
2. `INTERNAL` policy content is inaccessible publicly through every path (page, direct asset URL,
   search) — verified by a security test.
3. Search never returns drafts, unpublished transcripts, or internal audio.
4. A withdrawn transcript shows an explanation page, not a 404, and is gone from search.
5. Chapter navigation seeks the audio accurately (± 1 s of the stated timestamp).
6. No page displays a rating, ranking, popularity or "recommended" surface for speakers.
