# DESIGN SYSTEM

Foundations for MajelisHub UI. **No production components exist in Phase 0**; this document
defines tokens, rules and component anatomy so that Phase 1 implementations converge instead
of inventing.

Scope: `src/shared/ui/**` (primitives), `src/features/*/ui/**` (feature components).
Every component must be reachable from `docs/design/PAGES.md`; a component not used by a
listed page is not built.

---

## 1. Design tokens

Tokens are CSS custom properties defined once in `src/app/styles/tokens.css` and consumed by
Tailwind's theme layer (or plain CSS). **No hard-coded colour, spacing or font values in
components.**

### 1.1 Colour

Calm, high-contrast, low-saturation. Colour is never the sole carrier of meaning.

| Token | Light | Purpose |
|---|---|---|
| `--c-bg` | `#FBFBF9` | Page background (warm off-white, easier outdoors than pure white) |
| `--c-surface` | `#FFFFFF` | Cards, sheets |
| `--c-surface-muted` | `#F2F2EE` | Secondary panels, table stripes |
| `--c-border` | `#D8D8D0` | Dividers, input borders |
| `--c-text` | `#14140F` | Body text (contrast ≥ 14:1 on bg) |
| `--c-text-muted` | `#55554C` | Metadata (≥ 4.5:1 on surface) |
| `--c-primary` | `#0F5132` | Primary action, brand anchor (deep green, not fluorescent) |
| `--c-primary-hover` | `#0B3E27` | |
| `--c-focus` | `#0B63CE` | Focus ring (3:1 against adjacent colours, always visible) |
| `--c-success` | `#12683C` | Check-in success, published state |
| `--c-warning` | `#8A5300` | Degraded states, backlog warnings |
| `--c-danger` | `#9B1C1C` | Failures, destructive actions |
| `--c-info` | `#1F4E79` | Informational banners |

**Status must always be doubled with an icon and a text label** (`NFR-A11Y-002`).
Dark mode is a P2 enhancement; when implemented it must preserve the same semantic tokens —
components never reference raw hex values.

### 1.2 Typography

| Token | Value | Use |
|---|---|---|
| `--font-sans` | system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) | Everything |
| `--font-arabic` | `"Noto Naskh Arabic", "Amiri", serif` | Qur'anic/Arabic spans in transcripts |
| `--font-mono` | `ui-monospace, "SFMono-Regular", monospace` | Codes, timestamps in the editor |
| `--text-xs` | 12 px / 1.4 | Metadata only, never body |
| `--text-sm` | 14 px / 1.5 | Secondary UI |
| `--text-base` | 16 px / 1.6 | Body — **minimum for any user-facing prose** |
| `--text-lg` | 18 px / 1.6 | Lead paragraphs, form labels |
| `--text-xl` | 22 px / 1.4 | Card titles |
| `--text-2xl` | 28 px / 1.3 | Page titles |
| `--text-scan` | 40 px / 1.2 | Check-in result (viewed at ≥ 1 m) |
| `--text-code` | 32 px / 1.2, tabular numerals | Short check-in code display |

Rules: never more than 3 type sizes on one screen; max line length 70 characters for prose;
`font-variant-numeric: tabular-nums` for all counts, times and codes; no text inside images;
`lang` attributes set per content language (mixed Arabic/Indonesian spans annotate `lang="ar"`).

### 1.3 Spacing, radius, elevation, motion

- Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` px (`--space-1…8`). Layout gutters are
  16 px on mobile, 24 px on tablet, 32 px max content inset on desktop.
- Radius: `--radius-sm 6px`, `--radius-md 10px`, `--radius-lg 16px`, `--radius-pill 999px`.
- Elevation: only two levels — `--shadow-card` (1 px, very soft) and `--shadow-sheet`
  (modal/drawer). No decorative shadows.
- Motion: `--motion-fast 120ms`, `--motion-base 180ms`, ease-out only; disabled entirely under
  `prefers-reduced-motion: reduce`. No autoplaying carousels, no parallax, no animated
  backgrounds.
- Breakpoints: `sm 360` (baseline — design here first), `md 768`, `lg 1024`, `xl 1280`.
- Content max width: 720 px for prose, 1120 px for dashboards.

### 1.4 Touch and input

- Minimum target 44×44 px, 8 px minimum separation (`NFR-A11Y-002`).
- Primary actions in the bottom third of the viewport on mobile.
- Inputs are 48 px tall minimum; keyboard type is declared (`inputMode`, `autocomplete`) to
  avoid wrong keyboards for phone numbers and codes.
- Sticky action bars reserve space so content is never hidden behind them.

## 2. Status vocabulary

One status vocabulary across the whole product. Each status has: a label (Bahasa Indonesia),
a token colour, an icon, and a machine value (never shown).

| Domain state | Label (ID) | Colour | Icon |
|---|---|---|---|
| `DRAFT` | Draf | muted | pencil |
| `SCHEDULED` | Terjadwal | info | calendar |
| `REGISTRATION_OPEN` | Pendaftaran dibuka | success | door-open |
| `REGISTRATION_CLOSED` | Pendaftaran ditutup | warning | lock |
| `IN_PROGRESS` | Sedang berlangsung | primary | broadcast |
| `COMPLETED` | Selesai | muted | check |
| `CANCELLED` | Dibatalkan | danger | slash |
| `ARCHIVED` | Arsip | muted | archive |
| `REGISTERED` | Terdaftar | info | ticket |
| `WAITLISTED` | Daftar tunggu (#n) | warning | clock |
| `CHECKED_IN` | Sudah check-in | success | check |
| `NO_SHOW` | Belum check-in | muted | dot |
| `CANCELLED (registration)` | Dibatalkan | danger | slash |
| `WALK_IN` | Datang langsung | info | plus |
| `NOT_REQUESTED` | Belum diminta | muted | — |
| `QUEUED` | Dalam antrean | info | clock |
| `PROCESSING` | Sedang diproses | info | spinner |
| `DRAFT (transcript)` | Draf mesin | warning | robot |
| `REVIEW_REQUIRED` | Perlu ditinjau | warning | eye |
| `APPROVED` | Sudah disetujui | success | check |
| `PUBLISHED` | Dipublikasikan | success | globe |
| `FAILED` | Gagal | danger | alert |
| `RECOVERED` | Dipulihkan | warning | restore |

Transcript provenance labels are **not optional**: `Draf mesin (belum ditinjau)` must be
visible wherever a machine transcript is rendered (`FR-TRANSCRIPT-010`).

## 3. Component inventory (anatomy + rules)

Primitives live in `src/shared/ui/`; every one of these must be implemented before a feature
component builds its own variant.

### 3.1 Form controls
- `TextInput`, `TextArea`, `Select`, `RadioGroup`, `Checkbox`, `NumberStepper`, `Fieldset`.
- Label above, always visible. Help text below. Error text replaces help text and is
  `role="alert"`, linked via `aria-describedby`.
- Validation is server-authoritative; client validation only for format and required-ness.
- Autofill and `autocomplete` attributes are mandatory on name/contact fields.
- A "large text mode" toggle increases base text to 20 px and control height to 56 px
  (`ACCESSIBILITY.md` §Older participants).

### 3.2 Buttons
- `Primary` (one per screen region), `Secondary`, `Ghost`, `Danger`.
- Loading state replaces the label with a spinner **and keeps the label width** (no layout shift)
  and disables the control; the disabled state must be visually obvious but not colour-only.
- Destructive actions never use the primary colour.

### 3.3 Cards
- `EventCard`, `MosqueCard`, `SpeakerCard`, `StatCard`, `AlertCard`, `TaskCard`.
- Anatomy: title (≤ 2 lines), 1–3 metadata rows (icon + label), one action row.
- No images as the dominant element. Speaker photo is optional and small (avatar-size).
- Stat cards show: value, label, definition on tap, and a data-quality note when the number
  is incomplete (`FR-ATTEND-006`).

### 3.4 Tables / list views
- Desktop: sortable table with sticky header; row actions in an overflow menu.
- Mobile: stacked labelled cards; **no horizontal scrolling for primary content**.
- Attendance tables never infer or display a person's data beyond name, status, time.

### 3.5 Dialogs, sheets, banners
- Dialog: max 3 actions, focus trapped, `Esc` closes, focus returns to the trigger.
- Bottom sheet on mobile for secondary choices (filters, device selection).
- Banner: informational/warning/danger, one per page region, dismissible unless it conveys a
  security or integrity condition.

### 3.6 Scanner UI (`CheckInScanner`)
Purpose: maximise first-scan success and throughput.

- Viewfinder occupies the top 60% with a clear QR frame and a "arahkan ke kode" hint.
- **Context bar (non-dismissible):** event title · venue · entrance name · device label.
- Result panel (≥ 40% of the viewport) with three states:
  - **Success** — `--c-success` panel, large ✓, participant first name + count,
    "Check-in 06.14", auto-resume countdown visible.
  - **Already** — warning panel, "Sudah check-in pukul 06.02" — visually distinct from success
    while presenting as a *non-blocking* outcome for the operator.
  - **Failure** — danger panel, plain-language reason, and two actions: **Cari nama**,
    **Daftarkan datang langsung**.
- Manual entry: a large-alphabet short code field (32 px tabular numerals) plus a name search.
- Torch toggle, camera switch, and an "operator mode" text-size bump.
- Sound feedback: short success/failure tones, opt-in, respecting mute.
- Never display the participant's contact details on the operator screen.
- Scanner errors (permission denied, no camera, busy device) render as a full replacement of
  the viewfinder with an immediate manual-fallback panel — never an empty black box.

### 3.7 Recorder UI (`RecordingConsole`)
- States: `READY → RECORDING ⇄ PAUSED → STOPPING → UPLOADING → COMPLETED | FAILED`
  (plus `RECOVERABLE`). Each state is a distinct, labelled panel.
- Always visible during recording: elapsed time (tabular), input level meter, upload state
  (`Terunggah 34/36 potongan` / `3 potongan tertunda`), connection state, and a plain
  statement of local buffering status.
- `--c-warning` is used for any backlog or disconnection — never silent.
- Stop is a two-step confirm only if duration > 30 minutes (accidental stop is costly).
- After stop: a summary listing captured duration, uploaded bytes, gaps detected, and the
  next step. "Rekaman kosong" is an explicit failure state, not an empty success.

### 3.8 Transcript editor UI (`TranscriptEditor`)
- Two panes on desktop: audio player (with rate control 0.75×–2×) and segment list.
  On mobile: collapsed player pinned to the bottom, segments full width.
- Each segment: timestamp (monospace, click to seek), text (editable), certainty control
  (Terpercaya / Ragu / Belum diverifikasi), speaker label where applicable.
- Arabic spans render with `--font-arabic` and a larger line-height; the editor never
  converts, transliterates or "corrects" Arabic automatically.
- Uncertain or unverified segments carry a persistent, non-colour marker (`?` chip plus text).
- Save is explicit and per-chunk (auto-save with a visible "tersimpan pukul hh:mm"), because a
  reviewer's work is expensive.
- Conflict state: "Ada perubahan dari peninjau lain pada bagian ini" with a diff view and a
  choice — never a silent overwrite (`CONCURRENCY` C6).
- Approval is a distinct, deliberate action with a confirmation that lists exactly what will
  become public.

### 3.9 States: loading, empty, error, offline
Every list, detail page and editor defines all five explicitly:

| State | Requirement |
|---|---|
| Loading | Skeleton matching final layout (no layout shift); inline spinner for actions < 1 s |
| Empty | One sentence + one action. Never a blank region. |
| Error | Cause in plain language + retry + alternative (e.g. call the mosque) |
| Offline | Explicit banner + last-sync time + which actions are unavailable |
| Partial | "Menampilkan 20 dari 278" with a load-more that survives refresh |

## 4. Accessibility contract for components

Each primitive must:
- expose correct roles/states (`aria-expanded`, `aria-busy`, `aria-invalid`, `aria-live`);
- be operable with keyboard only, with visible focus (`--c-focus`, 2 px + offset);
- not rely on colour alone;
- announce dynamic results in a polite live region, except check-in results which use an
  assertive region with a **PII-free** announcement ("Check-in berhasil" — not the name);
- respect 200% zoom and OS font scaling without clipping;
- pass an axe check with zero critical violations.

## 5. Content and data-display rules

- **Numbers:** counts are integers with tabular numerals; percentages only when the
  denominator is trustworthy, and always with the denominator visible on tap.
- **No false precision:** attendance never shows a decimal or a projected figure; estimated
  values are labelled `perkiraan`.
- **Timestamps:** absolute time plus relative where helpful ("06.14 · 3 menit lalu"), never a
  bare epoch or ISO string.
- **Codes:** the short check-in code is displayed in groups of four with a copy action.
- **Provenance:** every transcript, summary and recording shows its source, reviewer (if any)
  and last-updated time.
- **Language tags:** mixed-language content annotates each span; screen readers must not read
  Arabic as Indonesian.

## 6. Implementation notes for Phase 1

- Styling: Tailwind CSS 4 with tokens in the theme layer; component variants via `cva`-style
  maps kept local to `src/shared/ui` (no design-system package, no Storybook in Phase 1).
- Every component file starts with a docblock stating: requirement IDs, page(s) using it,
  states implemented, and accessibility notes (mirroring `AGENTS.md` §Contract-first).
- No component may fetch data. Data comes from server components / feature hooks; UI
  primitives are pure.
- Component-level visual verification is by Playwright screenshot of the component's page
  (`TESTING.md` §Visual) — not by a separate gallery app.
