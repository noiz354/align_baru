# Operator Recognition (Operator of the Day / Month / Year)

**Document ID:** DOC-PRODUCT-OPERATOR-RECOGNITION
**Status:** Phase 0 specification. **No scoring algorithm is implemented** — the functions
`buildPerformanceSnapshot` and `computeRecognitionPeriod` throw `Not implemented: T-PERF-001` /
`Not implemented: T-REC-001`.
**Related:** `PERFORMANCE.md`, `PRD.md` §9.4, ADR-0029, `docs/security/PERMISSIONS.md`, `QA.md`

---

## 1. Why this is designed so carefully

Recognition changes behaviour. A revenue-only leaderboard rewards whoever happens to be posted at the
busiest location, punishes the operator who was handed a quiet spot or a broken cart, and creates an
incentive to manipulate records (proxy sales, voided sales, inflated expenses, unrecorded cash).
A hidden "AI score" is worse: it judges people with no explanation and no appeal. Both are refused
here. Recognition must be **transparent, multi-factor, normalised, reviewable and appealable**
(FR-RECOG-001..008, FR-PERF-001..010).

## 2. Candidate inputs (from `OperatorPerformanceSnapshot` only)

Inputs are candidate measures, each with a published weight range. None of them is revenue.

| Input | What it observes | Why it is fair | Anti-gaming note |
| --- | --- | --- | --- |
| Data completeness | Shifts with complete attribution (location, price snapshot, payment state) | Rewards honest bookkeeping at any traffic level | Also measured by "corrections later requested" |
| Closing punctuality | Closings submitted within a reasonable window after selling, with cause categories | Patience with causes avoids punishing a busy evening | Cause categories are recorded, not assumed |
| Cash reconciliation quality | Share of closings with explained variance (reason recorded, including `UNKNOWN`) | Rewards explanation, not flattering numbers | Zero-variance-by-tolerance is not a target |
| Stock discipline | Counts performed, reasons recorded, waste/sample/staff-meal disclosure | Rewards truthful reporting | Not a "no-variance" measure (that would reward concealment) |
| Sales completion | Completed sales vs abandoned drafts | Neutral to traffic volume | Read with void-rate context |
| Void / correction rate | Immutable corrections referencing originals | Detectable and explainable | Explanation stored with each correction |
| Customer-aid signals | Loyalty-aid actions only where the programme exists and consent allows | Not required to be recognised | Never a "customer rating" of an operator |
| Incident handling | Reporting and follow-through on incidents operationalised by the operator | Rewards safety and honesty | Reporting more incidents is never a penalty |
| Availability & reliability | Assigned shifts started, not silently skipped, with declared closures | Normalised by declared closures | Silent absence is addressed by a supervisor, not by the score |
| Price discipline | Overrides used within bounds and documented | Encourages compliance over concealment | Overrides per shift, not per rupiah value |

**Refused inputs:** revenue or margin per operator; sales per hour; cash collected per hour; app
usage; time-to-serve; location "compliance" percentages; movement patterns; camera or photo checks of
the operator; any inferred productivity metric (FR-PERF-002).

## 3. Normalisation

Every input is expressed relative to a **comparable baseline**, never as an absolute:

| Factor | Treatment |
| --- | --- |
| Location traffic band (high / medium / low) | Per-band baselines; missing bands use rolling medians for that band |
| Shift duration | Per-hour normalisation where duration distorts a measure (never for revenue) |
| Day of week and time of day | Compared within the same weekday class (weekday, weekend, holiday) |
| Weather band (reported) | Recorded as context when reported; no automatic penalty source |
| Network / device problems | Sync-health context recorded so a device issue never reads as negligence |
| Closures and stock availability | Declared stock-outs and closures are excluded from "missed" measures |
| Area/seasonality | Compared within the area's own rolling window, never across areas with different rhythms |

Minimum sample size gates apply per period (FR-RECOG-002). Below the gate, the operator is **not
assessed** for that period and the reason is stated — silence is honest; a thin-sample award is not.

## 4. Periods, weights and publication

| Period | Minimum shifts in period | Weights |
| --- | --- | --- |
| Day | ≥1 shift meeting the completeness gate | Data quality 30% · closing quality 25% · stock discipline 15% · sales completion 15% · incident handling 15% |
| Month | ≥8 shifts | Data quality 25% · closing quality 20% · stock discipline 15% · sales completion 15% · avoidance of unexplained variance 15% · availability 10% |
| Year | ≥60 shifts | Monthly measures aggregated with stability weighting; outliers explained, not dropped silently |

- Weight **ranges** and the normalisation method are published to operators in advance and versioned;
  a change requires a recorded decision and applies to future periods only (FR-RECOG-003).
- The system computes a **candidate shortlist**, never an automatic winner.
- A human reviewer (People/HQ plus the area supervisor) reviews the shortlist, checks context
  (long illness, broken cart, flooded location) and records a rationale (FR-RECOG-004).
- The award is published to the operator and their supervisor by default. Public visibility, if any,
  is an explicit organisational decision, never a default (FR-RECOG-006).
- Any operator may appeal; the appeal and outcome are recorded against the period (FR-RECOG-005).

## 5. What the system must never do

1. Publish a revenue-only ranking, in any surface, at any period (FR-PERF-004).
2. Apply an automatic penalty, suspension, pay reduction or schedule punishment from a score
   (FR-PERF-009, FR-RECOG-007).
3. Use hidden or unexplainable inputs; every input must be viewable by the operator it describes
   (FR-PERF-006).
4. Expose an individual operator's ratings to customers or to other operators outside the award.
5. Use surveillance data (continuous location, app usage, device telemetry) as an input.
6. Store a score for a person without the inputs and reasoning that produced it (auditability).
7. Recompute a past period silently: a re-run keeps the previous result and records who ran it and
   why (FR-PERF-010).

## 6. Operator-facing explanation

For each input an operator can see: what was measured, the period, the sample size, the comparability
band, how their value was computed, and what would change it. Wording is plain Indonesian and
non-judgemental. If an input is disputed, the dispute and its outcome are recorded (FR-PERF-007).

## 7. Review flow

```text
period end → candidate shortlist computed (gates applied)
   → People + supervisor review (context check, rationale)
   → publish with explanation to shortlisted operators (winners and non-winners)
   → appeal window → outcome recorded → period archived with inputs and weights version
```

## 8. Test and QA anchors

Suite: `tests/unit/*` for normalisation maths (added with T-PERF-002), integration tests proving
that revenue cannot determine an outcome, that the sample gate suppresses thin periods, that an award
requires a reviewer id, and that no automatic consequence follows a score. QA family QA-H /
QA-P (see `QA.md`).
