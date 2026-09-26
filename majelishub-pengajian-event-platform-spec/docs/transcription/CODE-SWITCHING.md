# CODE-SWITCHING AND RELIGIOUS LANGUAGE

Requirements: NFR-ETH-002, NFR-I18N-001…004, FR-TRANSCRIPT-009 · Related: `TRANSCRIPTION.md`,
`docs/product/CONTENT-INTEGRITY.md`, `docs/transcription/REVIEW-WORKFLOW.md`

---

## 1. The problem in plain terms

A typical Indonesian kajian is not monolingual. In a single utterance a speaker may move between
Indonesian, Arabic phrases, a Qur'anic verse with tajwid, a transliterated term, a local-language
aside, and scholarly names in Arabic script. Speech recognition models handle this badly:

| Failure | Example | Consequence if published uncaught |
|---|---|---|
| Arabic recognised as Indonesian gibberish | "إِنَّ اللَّهَ" → "inalah" | Nonsense in a religious context |
| Verse mangled | A citation becomes a near-quote | A fabricated religious quotation |
| Arabic dropped | Model emits nothing for the Arabic span | A claim appears to have no basis |
| Transliteration drift | Inconsistent spelling of the same term across a transcript | Confusing, looks careless |
| Hallucination over pause | Model invents fluent text during silence | Invented words attributed to a speaker |
| Names confused | Two scholars with similar names swapped | Misattribution — the most damaging error |

The product's answer is not a better model. It is **structure**: mark it, show uncertainty, keep the
original, and put a human between the machine and the public.

## 2. Data model consequences

| Element | Rule |
|---|---|
| `kind` per segment | `SPEECH` · `RECITATION` (Qur'an/hadith/du'a) · `QUOTE` (speaker quoting someone) · `NAME` · `NOISE` · `GAP` |
| `lang` per segment | BCP-47 where known (`id`, `ar`, `id-Latn`, local languages as tagged); `und` when unknown — never guessed silently |
| Original text | Stored verbatim (machine output = revision #1); never modified in place |
| Review text | Human revisions; the original remains retrievable for audit |
| Uncertainty | Per segment, with an optional range and a note |
| Citations | Structured, optional, reviewer-provided (surah:ayah, hadith collection:number) — never auto-attached |

## 3. Detection we do (structural only)

1. **Script detection:** Unicode script ranges determine whether a span is Arabic-script; this tags
   segments and drives rendering (direction, font, line height).
2. **Verse-like heuristics:** Arabic span length + phrasing + provider annotations raise
   `POSSIBLE_RECITATION` for the reviewer. Heuristics never write text and never "fix" it.
3. **Term consistency check (advisory):** if the same term appears in materially different spellings,
   the reviewer sees a "konsistensi istilah" list — a **suggestion list**, not an automatic rewrite.
4. **Transliteration hints:** a small, curated, deployment-editable glossary (e.g. "hadits" vs "hadith")
   produces suggestions only; the glossary never rewrites stored text.
5. **Gap adjacency** (see `docs/transcription/PIPELINE.md` §4) prevents invented text across silence.

## 4. What is forbidden (hard rules)

1. **No automatic correction** of Arabic text, verses, hadith, du'a, or attributions — anywhere, at any
   stage (`NFR-ETH-002`).
2. **No automatic translation** of any segment.
3. **No substitution** of a machine transcription with a remembered or corpus "canonical" verse text.
   If the audio is unclear, the text stays unclear and is marked so.
4. **No silent normalisation** of names, honorifics or transliteration.
5. **No confidence scores or "quality" numbers on the public page** (false precision, and it invites
   judging people).
6. **No publishing of recitation segments without reviewer verification** — they are blocking flags.

## 5. Rendering requirements (see also `ACCESSIBILITY.md`)

1. Arabic segments render with `lang="ar"` and `dir="rtl"`, with a font stack that includes proper Arabic
   shaping and diacritics; no clipped harakat, no broken ligatures.
2. Mixed-direction lines must not reorder Indonesian text around an Arabic span — components are tested
   for bidi correctness (`tests/browser/transcript/arabic-rendering.test.ts`).
3. Copy/paste from the page preserves the characters and direction markers.
4. Screen readers announce Arabic spans in Arabic (language tags present) — verified in the accessibility
   pass.
5. Large-text mode (20 px base / 56 px targets) must not truncate Arabic diacritics.

## 6. Reviewer guidance (the human part)

1. Listen to the Arabic span at least twice before deciding.
2. If the phrase is a known verse and the audio is ambiguous, **mark it uncertain**; do not "restore" it
   from memory (memory is the failure mode, not the safety net).
3. Verify attributions ("kata Ibnu Katsir…") against a credible reference or mark them uncertain.
4. Keep the speaker's own wording; do not polish rhetoric.
5. Spell recurring terms consistently within a transcript; when unsure, follow the deployment glossary
   (advisory) and the speaker's own usage in the audio.
6. Prefer an explicit `[tidak jelas 00:12:31–00:12:44]` marker over a confident guess.

## 7. Fixtures and tests

| Fixture | Purpose |
|---|---|
| `speech-id+ar-code-switch-5m.webm` | Indonesian speech with Arabic phrases (rights-cleared or synthetic) |
| `recitation-verse-30s.webm` | A verse recited slowly, for marker/verification UI tests |
| `names-unclear-1m.webm` | Scholar names spoken indistinctly, to test `PROBABLE_NAME` flags |
| `silence-10m.webm` | Hallucination-risk region (must become `[jeda]`, never invented text) |
| `mixed-script-transcript.json` | Segment shapes with `ar` spans, bidi cases, diacritics, uncertain markers |

Tests: no-autocorrect invariants, marker persistence through lifecycle, bidi rendering, and a test that
asserts a machine draft containing an Arabic span cannot be published without a human revision touching
that span.

## 8. Honest limitation statement

Automatic transcription of Indonesian–Arabic code-switched religious speech with current models is
**not reliable enough to publish unreviewed**, and this product does not pretend otherwise. The
published page says plainly: reviewed by a human, on a date, from a specific revision. Where the machine
was wrong, the human's correction is the record; where the human was unsure, the reader is told.
