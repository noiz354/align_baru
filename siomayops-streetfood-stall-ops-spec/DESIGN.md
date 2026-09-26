# DESIGN — SiomayOps

**Document ID:** DOC-DESIGN
**Status:** Phase 0 (specification; no UI implemented)
**Companions:** `PRD.md` (§7 requirements), `ACCESSIBILITY.md`, `docs/design/DESIGN-SYSTEM.md`, `docs/design/PAGES.md`, `OFFLINE.md`

---

## 1. Who we are designing for

An operator is standing at a roadside spot, holding a phone in one hand, serving a customer with the
other, sometimes in bright sun or rain, sometimes with a queue. Design decisions answer to that
reality, not to dashboard aesthetics.

| Constraint | Consequence |
| --- | --- |
| One hand, one thumb, sometimes wet or oily fingers | Large targets, bottom-anchored primary actions, no precision gestures, no swipe-only actions |
| Glare, small screens, cheap displays | High contrast, large numerals, minimal chrome, dark-on-light default |
| Interruptions | Every flow must be resumable and must never lose entered data on navigation or interruption |
| Low typing tolerance | Numeric keypads, presets, chips, "uang pas"; free text always optional except a required reason |
| Flaky connectivity | Offline state is a first-class visual state, not an error |
| Trust and dignity | No shaming language, no punitive colours for honest reporting, no hidden scoring |

## 2. Design principles

1. **The record is the truth, and the truth is shown honestly.** Statuses say exactly what is known:
   `Tunai — selesai`, `QRIS — menunggu verifikasi`, `Belum tersinkron`.
2. **Fast beats complete.** A sale must never require more than the minimum data. Optional richness is
   additive, never blocking.
3. **Show the state of the device.** Sync, battery-saver, offline and stale-data states are visible
   without hunting.
4. **Never ask twice.** Data already known (shift, stall, location, price) is prefilled and editable
   only where it should be.
5. **Reversible where safe, explicit where not.** Drafts can be edited; completed sales can be voided
   with a reason; accepted closings cannot be edited, only corrected.
6. **Neutral by default.** Differences are "selisih", not "kehilangan". Reasons, never accusations.
7. **No dark patterns.** Consent is opt-in, refusals are as easy as acceptances, no nagging, no
   pre-ticked boxes, no fake urgency.
8. **Respect the operator's time and data plan.** No autoplay, no heavy media, no third-party scripts,
   bounded payloads.

## 3. Surfaces

| Surface | Primary device | Content | Notes |
| --- | --- | --- | --- |
| **Operator app** (installed PWA) | 360×640 Android, one thumb | Shift start/end, location report, POS grid, payments, expenses, stock counts, requests, alerts | Must work offline; ≤4 taps for the common sale |
| **Supervisor app** | Same PWA, different role | Team status, approvals, incident follow-up, handover, coaching notes | Mobile-first; approvals must work with one hand |
| **HQ console** | Desktop/laptop | 10 cards (§10), queues, drill-downs, exports | Freshness displayed; exceptions first |
| **Finance console** | Desktop | Verification queue, expense review, variance review, settlement matching, reconciliation records | Evidence-centric, keyboard-friendly |
| **Auditor view** | Desktop, read-only | Audit search, reconstruction of a shift, exports | No write actions exist in this surface |
| **Customer touchpoints** | Customer's phone (no app) | Payment confirmation for verified states, optional receipt link, optional loyalty enrolment | Never requires installing anything or sharing a phone number |

## 4. Operator core flows and tap budgets

Tap budgets are acceptance criteria, not aspirations (see `docs/product/SHIFTS.md` for the full walkthroughs).

| Flow | Budget | Path |
| --- | --- | --- |
| 1-item cash sale | **4 taps** | Home → item tile → "Tunai" → "Uang pas" (confirmation auto-dismisses) |
| 3-item cash sale with change | **6 taps** | Home → 3 tiles → "Tunai" → amount preset ("20rb") → "Selesai" |
| Record a field expense | **4 taps** | Home → "Uang keluar" → category chip → amount preset → save (note optional) |
| Start a shift | **4 taps** | Home → "Mulai shift" → confirm opening cash (prefilled from last closing) → confirm planned location → start |
| Report a move | **3 taps** | Home → "Lokasi" → "Pindah" + reason chip |
| Record a QRIS payment | **4 taps** | Sale → "QRIS" → confirm amount → record as waiting verification |
| Close the day | **8 taps** | Home → "Tutup hari" → stock quick-count → cash count keypad → variance (if any) → reason if needed → submit |
| Ask for help | **2 taps** | Home → "Butuh bantuan" → reason chip |

Rules that protect the budgets:

- No confirmation dialog for actions that are safe to repeat (cash sale completion is idempotent).
- Confirmation is required only for: void a sale, close a shift, submit a closing, delete an unsynced
  draft, and any action that cannot be undone.
- The POS grid shows the top items for this location first (server-provided ordering), never a
  client-guessed ranking.
- A failed sync never blocks a new sale.

## 5. Interaction states (every surface must define all of these)

| State | Operator surface | HQ surface |
| --- | --- | --- |
| Loading | Skeleton tiles, ≤400 ms before content or an explicit "memuat…" | Card skeleton with last-known value and its age |
| Empty | Explains what to do next ("Belum ada penjualan. Tekan + untuk mulai") — never a bare blank | Explains why it is empty and what action resolves it |
| Offline | Persistent, calm banner: "Tanpa sinyal — penjualan tetap tercatat"; count of pending records | Freshness badge switches to stale with the last successful compute time |
| Stale data | Field data keeps working; freshness shown where relevant | Values dimmed with age (`computedAt`) and never presented as current |
| Pending verification | "Menunggu verifikasi" with an explanation accessible in one tap | Backlog queue with age and value |
| Conflict | Plain explanation: what happened, what to do now, who to contact | Exception list with the conflicting records side by side |
| Error (recoverable) | Plain Indonesian, retry action, no error codes | Error code + correlation ID + retry, copyable for support |
| Error (fatal for a flow) | What is blocked, what still works, and how to get help | Same plus escalation link |
| Success | Short, unambiguous, amount visible, next action optional | Toast + optimistic row state, then reconcile with the server value |

## 6. Wording and tone (Bahasa Indonesia first)

Hard rules:

| Rule | Examples |
| --- | --- |
| Payment wording is exact | Use **"Menunggu verifikasi"** for unverified digital. Never "berhasil", "lunas", "sukses", "done" |
| Cash wording is exact | "Tunai" is complete only after the transaction is recorded; "kembalian" shows the computed amount |
| Differences are neutral | "Selisih" with the amount and a reason; never "hilang", "dicuri", "tidak jujur" |
| No blame in system messages | "Data belum lengkap" not "kamu salah input" |
| Reasons are chosen, not typed, with an optional note | Chips for common reasons, plus "Lainnya" with a short note |
| No jargon | "Hari kerja", "Setoran", "Selisih kas"; avoid "idempotency", "webhook", "payload" in operator surfaces |
| Quantities use local idiom | "porsi" (portion) rather than "unit" |
| Money uses Indonesian grouping | `Rp10.000`, `Rp1.250.000`; no decimals in operator surfaces (IDR minor unit = 1) |
| Time uses local context | "06.20", "2 jam lalu" rather than timestamps with time zones |
| Uncertainty is expressed | "Belum dikonfirmasi", "Belum ada laporan" rather than empty or implied failure |

Banned patterns: shaming copy ("anda melebihi target"), false urgency ("segera atau data hilang"),
ambiguous payment language, dark-pattern consent, hidden scoring, and any wording that implies an
operator was dishonest.

## 7. Visual foundations (summary; full tokens in `docs/design/DESIGN-SYSTEM.md`)

| Element | Decision |
| --- | --- |
| Base typography | System fonts; body 16 px, minimum 14 px for secondary text, monetary figures at 20–28 px with tabular numerals |
| Tap targets | Minimum 44×44 px; POS tiles minimum 72×72 px with item name and price |
| Colour semantics | Green/neutral = recorded and verified; amber = waiting (including "menunggu verifikasi"); grey = not yet reported; red reserved for blocking errors and safety, never for an operator's honest variance report |
| Iconography | Simple, labelled; no icon-only actions for money |
| Density | Operator: generous spacing. HQ: compact tables with zebra rows and sticky headers |
| Motion | Minimal, ≤150 ms, respects `prefers-reduced-motion` |
| Dark mode | Not a pilot requirement; if added, contrast rules must be re-verified |
| Numerals | Tabular; right-aligned in tables; grouped with dots in both surfaces |

## 8. Accessibility commitments (binding; details in `ACCESSIBILITY.md`)

- Every interactive control has a labelled accessible name; icon-only controls are forbidden for
  money actions.
- Contrast ≥4.5:1 for text, ≥3:1 for large text and UI boundaries.
- Status is never conveyed by colour alone (text plus shape/icon).
- Font scaling to 130% keeps all controls reachable and amounts untruncated.
- Screen-reader paths exist for: starting a shift, recording a sale, recording an expense, closing,
  reporting location, and viewing an alert.
- Forms prevent errors where possible (numeric keypads, range checks, prefills) and explain them in
  plain language with a fix action.
- Focus order matches visual order; no keyboard traps in the HQ console; the verification queue is
  fully keyboard-operable.

## 9. Ethics in the interface (non-negotiable)

1. **Consent is real.** Loyalty enrolment is opt-in with the purpose stated in one sentence; refusal
   is a single tap and does not change service or price.
2. **No surveillance affordances.** No "last seen", no live map of people, no activity timeline of an
   individual beyond their own shift records, no "online status" pressure.
3. **No punitive defaults.** Variance and expense screens never default to a punitive interpretation;
   escalation is a human action with a reason.
4. **Flags are about records.** Any pattern flag shows what pattern matched and how to contest it;
   flags never name a person in a queue title.
5. **Operator data belongs to the operator.** They can see everything recorded about them, in the same
   wording the system uses internally (§7.1 FR-OPERATOR-010).
6. **Recognition explains itself.** Weights, normalisation and the review step are visible where the
   award is shown (FR-RECOG-003).
7. **No engagement mechanics.** No streaks, no badges for app usage, no gamified pressure, no
   notification spam; quiet hours and digests are respected (FR-COMM-008).

## 10. HQ dashboard: ten cards

| # | Card | Question it answers | Freshness | Drill-down |
| --- | --- | --- | --- | --- |
| 1 | Coverage today | Who is selling, where, and who is not? | ≤2 min | Shift list, location report |
| 2 | Sales today | How much, by method, split verified vs unverified? | ≤2 min | Sale list, item mix |
| 3 | Cash position | Expected vs counted, variance, unreconciled items | ≤5 min | Closings, shifts |
| 4 | Verification backlog | What is waiting, how old, how much? | ≤2 min | Payment queue |
| 5 | Stock status | Issues, consumption, waste, variance, restock requests | ≤10 min | Stall stock, transfers |
| 6 | Incidents | What needs attention, by severity and age | live-ish | Incident board |
| 7 | Expense review | What is queued, flagged, overdue? | ≤5 min | Expense queue |
| 8 | Unfinished closings | Which business days/shifts are incomplete? | ≤5 min | Closing list |
| 9 | Location coverage | Which selling points are used, dormant, or restricted? | ≤15 min | Location detail |
| 10 | Exceptions first | The catch-all "what is broken right now" list | live-ish | Any |

Every card displays `computedAt`; stale cards are dimmed and labelled; no card renders a number without
its verification status where that distinction exists (payments).

## 11. Content and localization

- Primary language: Bahasa Indonesia (informal-professional register used in the field). Regional
  vocabulary (e.g. "mangkal", "gerobak", "porsi") is preserved rather than translated away.
- English is the language of code, documentation and HQ technical surfaces.
- Number, date and currency formatting follow Indonesian conventions; times are local
  (Asia/Jakarta) for operators and finance, with the business day shown explicitly at closing.
- Copy is written by product, reviewed against §6, and stored in a single content file per surface so
  wording changes never require hunting through components.

## 12. Design review checklist (applies to every UI change)

1. Does it respect the tap budget for its flow?
2. Is the payment/state wording honest and unambiguous?
3. Are all interaction states defined (§5), including offline and stale?
4. Does it avoid shaming, blaming or pressuring the operator?
5. Do the tap targets, contrast and font-scaling rules pass?
6. Is any new data collection introduced? If yes, is it consented, needed, and in `PRIVACY.md`?
7. Is anything shown that the viewer is not authorised to see (scope check)?
8. Can a mistake be undone, or if not, is the irreversibility obvious before committing?
9. Does it work with one hand, one thumb, on a 360×640 screen, in daylight?
10. Does it degrade gracefully when a dependency is unavailable?

## 13. Anti-patterns explicitly rejected

Live operator maps · productivity leaderboards on the operator home · "last seen" indicators ·
notification badges used as pressure · auto-escalation banners · countdown timers on approvals ·
pre-ticked consent · hidden defaults for payment method · colour-only status · charts without
freshness · text entry where chips suffice · any screen implying the operator is a suspect.
