# PERFORMANCE (Operator)

**Document ID:** DOC-PERFORMANCE
**Status:** Phase 0 (specification; **no metric computation implemented**)
**Related:** FR-PERF-*, FR-RECOG-*, ADR-0029, `docs/product/OPERATOR-RECOGNITION.md`, `apps` `features/performance`

---

## 1. Principles

1. **Operational and contextual.** Metrics describe the *operation*, not the worth of a person.
2. **Multi-factor.** Sales alone is not a performance measure; it is one input among many.
3. **Normalised.** Shift duration, day-of-week, location traffic, weather, and closures are
   accounted for before comparison.
4. **Transparent.** Every metric has a documented formula, inputs, and limitations
   (FR-PERF-009).
5. **Visible to the operator.** An operator can always see their own breakdown (FR-PERF-003).
6. **Never punitive automatically.** No metric triggers sanctions (FR-PERF-004).
7. **Reproducible.** Any published metric can be recomputed from stored facts
   (FR-PERF-010).

---

## 2. Metric catalogue (definitions, not implementations)

| # | Metric | Definition | Normalisation | Notes |
| --- | --- | --- | --- | --- |
| M-1 | Sales value | Sum of COMPLETED sales (net of voids) | Per hour in location, per shift | Raw revenue is **never** a ranking on its own |
| M-2 | Transactions | Count of COMPLETED sales | Per hour present | Flow indicator |
| M-3 | Average transaction value (ATV) | Sales ÷ transactions | Item mix aware | High ATV can mean upselling or a menu mismatch |
| M-4 | Shift completion | Closed shifts ÷ started shifts | — | Reliability indicator |
| M-5 | Shift punctuality | Actual start vs planned start | Tolerance band | Punctuality is context-bound (transport, weather) |
| M-6 | Cash reconciliation accuracy | 1 − (|cash variance| ÷ expected cash) with tolerance rules | By shift size band | Variance must never be treated as theft |
| M-7 | Stock accuracy | % of counted items within tolerance | By item category | Voluntary honesty is rewarded; unknown is allowed |
| M-8 | Price compliance | % of sales at effective price / approved overrides | By location | Overrides with reasons count as compliant |
| M-9 | Location discipline | % of shift time with a reported location | — | Signals coverage quality, not surveillance |
| M-10 | Incident involvement | Count of incidents (any role) | By category | Presence is neutral; some categories (equipment) are not the operator's fault |
| M-11 | Customer feedback | Optional ratings (taste, cleanliness, service, speed, value, overall) | Sample size aware | Not exposed publicly per operator by default |
| M-12 | Operational compliance | Checklist adherence (stock counts, counts at closing, mandatory reasons) | — | Process hygiene, not sales |
| M-13 | Stock variance explainability | % of variances with a recorded reason (incl. `UNKNOWN`) | — | Rewards honest reporting, not zero variance |
| M-14 | Team contribution | Handovers accepted cleanly, helping neighbouring stalls, sharing verified locations | — | Optional, qualitative flags from supervisors |
| M-15 | Location baseline delta | Sales vs the location's own historical baseline for the same time window | Location + time window | Makes comparison fair across traffic levels |

---

## 3. What we explicitly refuse to measure

| Refused | Why |
| --- | --- |
| Idle time / keystroke activity / screen time | Surveillance; meaningless for a street vendor who waits for customers |
| Movement outside reported locations | Privacy violation (ADR-0007) |
| Speed of tapping the UI | Would incentivise error-prone haste |
| "Suspicion score" of any kind | Opaque, harmful, and prohibited (PRD §3) |
| Ranking purely by revenue | Unfair across locations (FR-RECOG-003) |
| Customer ratings exposed per operator publicly | Dignity; retaliation risk (FR-PERF-006) |
| Cross-operator comparisons without context | Misleading, punitive |

---

## 4. Fairness model (comparison rules)

```text
Raw outcome                 Adjusted expectation            Comparison
──────────────             ─────────────────────           ──────────────
Sales Rp 480,000     vs     Location baseline for           → performance ratio
                            (location, weekday, window,     (with confidence band
                            weather band, stock             and sample size)
                            availability)
```

| Factor | How it is accounted for |
| --- | --- |
| High-traffic vs low-traffic location | Location baseline delta (M-15), not absolute revenue |
| Weather | Shift flagged with weather disruption; expectations adjusted or excluded |
| Shift duration | Per-hour normalisation; long shifts do not auto-win |
| Day of week | Same-weekday baselines |
| Location closures / disruptions | Operator-reported status and incidents adjust expectations |
| Stock availability | Shifts with documented stock-outs are excluded from sales comparisons |
| Operator experience | Trainees accompanied by a trainer are flagged and excluded from individual comparison |
| Menu/pricing differences | Location-appropriate price set used in the baseline |

**Rule:** any comparison shown to a human must display which adjustments were applied, or must
be omitted entirely.

---

## 5. Anti-patterns (explicitly forbidden presentations)

1. A single leaderboard sorted by revenue.
2. "Bottom 10 operators" lists pushed to supervisors as a work queue of people to confront.
3. Performance data in any automatically generated message that implies a warning.
4. Metrics shown to other operators (comparison only via anonymised percentile with context,
   and only where a deployment explicitly enables it).
5. Any metric surfaced without its caveats and sample size.

---

## 6. Operator-visible surface (planned)

```text
/my-performance
 ├── Ringkasan periode ini (shifts, transactions, sales, ATV)
 ├── Akurasi (kas, stok) — dengan penjelasan apa artinya
 ├── Keandalan (shift selesai, tepat waktu)
 ├── Umpan balik pelanggan (agregat)
 └── "Bagaimana nilai ini dihitung?" — penjelasan rumus + sumber data
```

Requirements: plain language, no jargon, no comparative shame, and a clear statement of what
the operator can do to improve each factor.

---

## 7. Data and audit requirements

| Requirement | Detail |
| --- | --- |
| Reproducibility | Metrics recomputable from stored facts; formulas versioned (`metricVersion`) |
| Period snapshots | Stored per period so historical reports do not drift when formulas change |
| Change control | Changing a formula is a versioned, reviewed change with a written rationale |
| Source attribution | Each metric lists the tables/events it derives from |
| Retention | Metric snapshots per `RETENTION.md`; raw supporting data per financial retention |
| Access | Operator (own), supervisor (area), HQ (scope), auditor (read-only) |
| Audit | Any manual adjustment to a metric (rare, discouraged) requires reason + actor |

---

## 8. Relationship to recognition

Performance metrics are an **input** to recognition, never the recognition itself. Recognition
adds weighting, normalisation, human review, and an override process
(`docs/product/OPERATOR-RECOGNITION.md`, ADR-0029). A performance metric must never be
published as a judgment about a person.
