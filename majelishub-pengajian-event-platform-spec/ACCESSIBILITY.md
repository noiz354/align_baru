# ACCESSIBILITY

Target: **WCAG 2.2 Level AA** where practical, with specific commitments for the participants most
at risk of exclusion — older jamaah, low-vision users, and people using cheap devices in bright
daylight.

Requirements: NFR-A11Y-001…008 · Design: `docs/design/DESIGN-SYSTEM.md` · UX: `DESIGN.md`

---

## 1. Who we are actually designing for

| Person | Constraint | What it demands |
|---|---|---|
| Bu Sariah, 61 | Presbyopia, prefers large text, one hand, outdoors | ≥16 px body text, a large-text mode, high contrast, no fine gestures |
| Pak Yusuf, 70 | Low vision + no smartphone fluency | Linear flows, no icon-only controls, unambiguous states, screen-reader-friendly ordering |
| Rizka, 22, volunteer | Bright sunlight, queue pressure, gloves | Large targets, high-contrast feedback, minimal reading during scanning |
| A participant with a wheelchair | Physical access | Accessibility information about the venue is **content**, not decoration (`FR-MOSQUE-003`) |
| A deaf participant | Cannot hear the kajian | Published transcripts are an accessibility feature, not just an archive feature |
| A participant with a dexterity impairment | Precise tapping is hard | 44 px targets, no drag-only interactions, forgiving form validation |

## 2. Conformance commitments

| Criterion area | Commitment |
|---|---|
| Perceivable | Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text/UI components; no information by colour alone; no text in images; scalable text; captions/transcripts for audio where available, with an explicit statement when not |
| Operable | Full keyboard operation; visible focus (2 px, 3:1 against adjacent colours); no keyboard traps; skip links; target size ≥ 44×44 px; no motion-triggered interactions; timing not used as a hidden requirement |
| Understandable | Plain Bahasa Indonesia; consistent navigation; errors identified in text with the fix; no unexpected context changes; one primary action per screen |
| Robust | Semantic HTML first; ARIA only where necessary and correct; tested with screen readers (TalkBack, VoiceOver, NVDA) |
| WCAG 2.2 additions | Focus not obscured (sticky headers/bars accounted for), consistent help location, redundant entry avoided (no re-typing the same data across steps), accessible authentication (no cognitive-function test; magic links and passkeys; paste allowed in code fields) |

## 3. Flow-specific requirements

### 3.1 Participant discovery and registration
- Semantic landmarks (`header`/`nav`/`main`/`footer`), one `h1` per page, logical heading order.
- Event cards are links with descriptive accessible names ("Kajian Ba'da Subuh, Minggu 11 Oktober,
  Masjid Al-Ikhlas") — not "Selengkapnya".
- Forms: labels always visible, `autocomplete` set, errors announced (`role="alert"`) and tied by
  `aria-describedby`; a submission error never loses entered data.
- Time information includes the weekday and timezone label in text, not only in an icon.
- Registration requires no account, no CAPTCHA, and no timed interaction (WCAG 2.2 accessible
  authentication).

### 3.2 "My registration" and QR
- The QR is accompanied by the **short code in large text** (`--text-code`, 32 px, tabular) so a
  participant who cannot hold a phone steady, or whose screen is dim, can read it aloud.
- A "Perbesar kode" (enlarge) action maximises brightness/contrast and size.
- The page works offline with a stated last-sync time (`NFR-MOB-004`).
- The QR image has an adjacent text alternative with the code, not an empty `alt`.

### 3.3 Check-in (volunteer) — accessibility of the *operator* experience
- Result states are perceivable by three channels: colour + icon + text (≥ 40 px label).
- Optional sound feedback with a visible mute state.
- The manual path is reachable by keyboard and does not require the camera.
- **PII-free announcements:** the live region announces "Check-in berhasil" (and the first name only
  for the operator's visual confirmation) — never a full name or contact.
- No gestures beyond tap; no long-press requirements.

### 3.4 Recording console
- Every control is a real button with a text label; state changes announced politely.
- The level meter has a text equivalent ("level: rendah / baik / terlalu keras") and is not
  colour-only.
- Timing/session state is exposed as text ("berjalan 01:12:33"), not as a ticking animation alone.

### 3.5 Transcript viewing and reviewing
- Transcript is structured as a list of segments with time and text; heading structure reflects
  chapters.
- Arabic spans carry `lang="ar"` and render with the Arabic font stack; mixed-direction text is
  handled (no clipped diacritics; correct bidi ordering).
- Timestamp controls are buttons with accessible names ("Putar dari menit 12 lewat 30 detik").
- Published audio has a transcript or an explicit "transkrip belum tersedia" statement
  (`NFR-A11Y-007`); when a transcript exists it is the canonical accessible alternative to audio.
- The review editor supports keyboard-only operation with shortcuts that are documented and
  discoverable (a help dialog), and never traps focus.

### 3.6 Large-text and older-participant mode
- A visible "Teks lebih besar" toggle persists per device, raising base text to 20 px and controls to
  56 px.
- Respects OS-level font scaling and 200% browser zoom with no horizontal scrolling and no clipped
  content (verified per page).
- Icon + text pairing everywhere; no icon-only primary actions.

## 4. Forms and content authoring rules

- Every input has a visible label; placeholders are hints, never labels.
- Required fields marked in text, not only with a colour or an asterisk without explanation.
- Error messages name the field and the fix, in the user's language, in the user's terms.
- Free-text fields accept Arabic script, emoji-free punctuation is not enforced, and no ASCII-only
  validation exists anywhere (`NFR-I18N-003`).
- Documents/PDF output (exports, printed programmes) must meet contrast and use ≥ 12 pt text.

## 5. Non-camera/non-microphone fallbacks (mandatory, not optional)

| Feature | Fallback |
|---|---|
| QR scanning at the entrance | Short-code entry, name search, walk-in registration (`CHECKIN.md` §6) |
| Camera permission denied permanently | The operator console replaces the viewfinder with manual entry; the participant can read the short code |
| Microphone denied | Documented external-recorder path plus file upload (P1), with instructions |
| Audio playback | Transcript is available as the accessible alternative; the player is keyboard operable and does not autoplay |
| Push notifications | In-app list and email always exist (`NOTIFICATIONS.md`) |

## 6. Testing and verification

| Method | When | Evidence |
|---|---|---|
| Automated axe-core scan (`@axe-core/playwright`) on every P0 flow | each CI run | zero critical violations; report attached to the build |
| Keyboard-only walkthrough script (below) | per release | recorded in the PR/QA notes |
| Screen-reader walkthrough (TalkBack on Android; VoiceOver on iOS) | per release for participant + check-in flows | recorded findings; issues filed with severity |
| 200% zoom + large-text mode + 360 px width | per release | screenshots attached to the release checklist |
| Contrast audit on all status colours | per release | token audit output |
| Colour-blind simulation on check-in result states | per release | verified that icon+text carry the meaning alone |
| Content review of notices (recording/feedback/consent) for plain language | per release | reading-level review note |

### Keyboard-only walkthrough script (mandatory minimum)

1. Land on `/`, reach the first event card with `Tab`, open it with `Enter`.
2. Complete registration using only the keyboard, including fixing a validation error.
3. Open "my registration", enlarge the code, read the short code.
4. As a volunteer: reach the check-in console, use the **manual short-code path** entirely by
   keyboard, confirm a success and an "already checked in" state.
5. As an organizer: create and publish an event, then open the attendance summary.
6. As a reviewer: open a draft transcript, seek audio by keyboard, edit a segment, save, approve.
7. Confirm focus is never lost, never trapped, and always visible.

## 7. Known limitations (honest list)

| Limitation | Impact | Mitigation / status |
|---|---|---|
| Live audio has no real-time captions | Deaf participants cannot follow live unless a transcript is published later | Documented; published transcript (after review) is the accessible artefact; real-time captioning is out of scope (`PRD.md` NG, `TRANSCRIPTION.md` §11) |
| Camera-based scanning needs decent lighting | Frustration in very dark venues | Manual code entry always available; venue lighting guidance in organizer docs |
| Old Android browsers (pre-Chrome 110) lack some APIs | Degraded experience | Supported matrix documented (`NFR-MOB-001`); fallbacks exist |
| Arabic diacritic editing ergonomics | Slow for reviewers | Documented; the editor is keyboard-first and tested with reviewers |
| PWA push inconsistencies | Some users miss notifications | In-app + email always exist |

## 8. Definition of done for accessibility (per slice)

A slice is not done until: automated scans pass on its pages, the keyboard script for its flows
passes, its status colours are token-audited, its fallbacks exist, and its copy has been read for
plain language. Accessibility findings are **blocking** for participant-, volunteer- and
reviewer-facing surfaces, and tracked as P1 elsewhere.
