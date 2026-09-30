# RETENTION

**Document ID:** DOC-RETENTION
**Status:** Policy specification; no production-grade scheduled retention job has verified deletion (pilot purgers exist for GPS/video, but are not release evidence)
**Related:** ADR-0037, `PRIVACY.md`, `DATA_MODEL.md` §6, `OPERATIONS.md`

---

## 1. Principles

1. **Keep what must be kept.** Financial records and audit events support disputes, audits, and
   legal obligations — they are retained longest.
2. **Delete what does not need keeping.** Raw location reports, evidence photos, telemetry, and
   stale loyalty identifiers are liabilities, not assets.
3. **Aggregate instead of retaining raw.** Operational insight (location baselines, expense
   patterns) survives as aggregates after raw data expires.
4. **Deletion must be provable.** Retention jobs log counts and ranges deleted (no PII in logs).
5. **Legal hold overrides retention.** A documented hold freezes deletion for specific records.
6. **Detach before delete.** Where financial history must remain but personal identifiers need
   not, identifiers are removed/irreversibly hashed rather than the record being destroyed.

---

## 2. Retention schedule (working policy — subject to legal review)

| # | Data | Retention (default) | Class | Rationale | Deletion method |
| --- | --- | --- | --- | --- | --- |
| R-01 | Sales, sale items, adjustments | Long (e.g. 10 years) | Financial | Disputes, tax/commercial record expectations, audit | Archived, then purged on policy |
| R-02 | Payments, payment attempts, reconciliation records | Long (matching R-01) | Financial | Money movement evidence | Archived/purged |
| R-03 | Raw provider callbacks (`jsonb` payloads) | Medium (e.g. 24 months) | Financial-supporting | Dispute window; payloads are large and sensitive | Purge; summary retained in payment record |
| R-04 | Shift closings (summaries) | Long | Financial | Cash accountability | Archived/purged |
| R-05 | Expenses + review records | Long | Financial-adjacent | Reimbursement/audit | Archived/purged |
| R-06 | Expense evidence photos | **Short** (e.g. 90 days after review or shift close) | Sensitive-ish | Operational need only | Object deletion |
| R-07 | Audit events | **Longest** (e.g. 10 years, or per legal advice) | Compliance | Non-repudiation | Append-only; archived, never edited |
| R-08 | Shifts, assignments, operator status history | Medium-long (e.g. 24–36 months) | Operational | Fairness disputes, planning, payroll-adjacent questions | Purge with aggregates kept |
| R-09 | Location reports (raw) | **Short** (e.g. 90 days) | Personal (movement) | Coverage and dispute window only | Purge; aggregates (per location/day) retained longer |
| R-10 | Location aggregates (occupancy, coverage) | Long | Derived, non-personal | Planning | Retain |
| R-11 | Incident records (incl. bounded narrative, reported amount/context, event time and optional shift/site links) | Medium (e.g. 24 months) | Operational/personal | Safety learning, disputes | Purge; Page 13 pilot has no production purge job or verified enforcement |
| R-12 | Incident evidence photos | Short (e.g. 90 days post-resolution) | Sensitive | Resolution only | Object deletion; incident summary retained; Pages 13–14 accept/review no evidence and create no evidence rows |
| R-13 | Customer loyalty accounts + transactions | Active + short grace (e.g. 12 months inactivity) | Personal | Programme operation | Delete/anonymise; redemption references in sales detached |
| R-14 | Reward instances | Same as loyalty window | Personal-adjacent | Anti-fraud (double spend) | Purge |
| R-15 | Messages (operational) | Medium (e.g. 24 months) | Operational | Dispute/learning | Purge |
| R-16 | Operational alerts | Short (e.g. 12 months) | Operational | Trend analysis | Purge |
| R-17 | Application logs | Short (e.g. 30 days) | Technical | Debugging | Rotation |
| R-18 | Traces/metrics | Short–medium (e.g. 30–90 days) | Technical | Performance | Rotation |
| R-19 | Metric snapshots (performance) | Medium (e.g. 36 months) | Personal-adjacent | Fairness transparency | Purge with policy note |
| R-20 | Recognition results | Long (e.g. 10 years? — decide with HR policy) | Personal-adjacent | Fairness, appeals | Retain per HR decision; document |
| R-21 | Idempotency records | Medium (e.g. 24 months, ≥ replay risk window) | Technical | Replay safety | Purge |
| R-22 | Outbox events | Short after processing (e.g. 14 days) | Technical | Reliability | Purge |
| R-23 | Backups | Rolling (e.g. 35 days) + monthly archives per R-01 | All | Recovery | Expire per policy |
| R-24 | Exports (CSV/report artefacts) | Short (e.g. 30 days) | Sensitive | Delivery only | Object deletion; export action logged |
| R-25 | Explicit one-shot GPS samples attached to location reports (coordinates, accuracy, captured time) | **Maximum 14 days after capture** | Precise personal work-location data | Operator-confirmed location report only | Purge GPS fields; retain the selling-point report under R-09; no GPS-specific legal-hold extension without new privacy review |
| R-26 | Raw Page 11 human-traffic video (silent, ≤10 seconds) | **Maximum 24 hours from upload** | Personal data of operators/incidental bystanders | Upload-gated first-party temporary evidence; never training or HQ review | Irreversibly delete primary object and every replica/backup within the same 24-hour ceiling; no legal-hold extension without a new privacy review; production blocked until deletion is verifiable |
| R-27 | Manual traffic count/band and coarse sample metadata (no operator/shift key) | Working default **90 days**, subject to privacy-owner/DPO review | Operational aggregate; re-identification risk remains | Local traffic planning only; never individual performance, attendance or discipline | Purge sample-level rows at expiry; retain only reviewed non-identifying aggregate if justified; no video/object key retained after R-26 purge |
| R-28 | Page 12 site-condition observations, including wet/dry, shelter and bounded notes | Working maximum **90 days**, subject to privacy-owner review | Operator-linked operational context | Active-site operational decision support only; no performance/discipline use | Pilot opportunistic purge removes row and idempotency index; production requires a scheduled, verifiable purge and backup-expiry policy |

*Durations marked "e.g." are placeholders to be confirmed with legal/commercial advice before
production. The architecture must make changing them a configuration change, not a rewrite.*

**Page 15 boundary:** conversation audio and transcripts are not accepted or stored. No retention
period is defined for them; the microphone remains prohibited and the recorder page is
informational only. Do not borrow the retention periods for incident photos or Page 11 silent video.
A separate policy/DPIA and verified primary/backup deletion design are prerequisites to proposing
any audio processing.

---

## 3. Deletion mechanics (planned)

| Concern | Approach |
| --- | --- |
| Soft vs hard delete | Financial/audit: no delete. Operational/personal: hard delete or anonymise on schedule. |
| Anonymisation | Replace identifiers with irreversible hashes; retain aggregates and financial linkage without PII |
| Cascades | Deleting a customer removes loyalty accounts/transactions/rewards; sale rows keep amounts and detach `customerRef` |
| Object storage | Deletion API + lifecycle rules on buckets as a backstop |
| Backups | Deleted data expires with backup rotation; deletions documented in the retention log with ranges |
| Legal hold | Explicit hold flag per entity scope; retention job skips held records and logs the skip |
| Verification | Quarterly restore-and-verify drill includes confirming that retention-deleted data is absent |

---

## 4. Retention jobs (future; not implemented)

```text
jobs/retention/daily
 ├── purge GPS sample fields older than R-25 (do not delete the linked R-09 report)
 ├── purge raw traffic video and replicas by R-26; detach media metadata from manual traffic results
 ├── purge sample-level traffic count/band records by R-27
 ├── purge site-condition observations and bounded notes by R-28
 ├── purge location reports older than R-09
 ├── purge expense evidence older than R-06 (object delete first, then row clear)
 ├── purge incident evidence older than R-12
 ├── anonymise loyalty accounts inactive beyond R-13
 ├── purge messages older than R-15
 ├── purge alerts older than R-16
 ├── rotate logs/traces per R-17/18
 └── emit retention audit record (counts only, no PII)
```

Job requirements: idempotent; dry-run mode; observable (counts, durations, failures); a failure
must alert (a silent retention failure is a compliance bug); runs must never delete more than the
policy permits even if misconfigured (bounds + review).

---

## 5. Legal and organisational considerations

| Consideration | Stance |
| --- | --- |
| Tax/commercial record expectations | Confirm with an Indonesian adviser; current design keeps financial records long by default |
| UU PDP deletion vs financial retention | Deletion requests are honoured for personal data; financial records are retained with identifiers detached where lawful; the basis is documented and explained to the requester |
| Employment data | Shift/assignment history has HR relevance; retention aligned with company HR policy |
| Dispute windows | Retention ≥ the practical dispute window for cash and stock issues |
| Litigation hold | Freezes specific scopes; documented in `RUNBOOK.md` |
| Vendor retention | Provider-side retention (payment provider, WhatsApp, observability) reviewed in the vendor register; prefer providers with configurable, short retention |

---

## 6. Anti-patterns

1. "Keep everything forever in case it's useful" — expensive, risky, and unlawful under
   purpose limitation.
2. Silent retention failures with no alerting.
3. Deleting financial records to satisfy a deletion request (destroys integrity; identifiers
   should be detached instead, where lawful).
4. Retaining raw location trails long "for analytics" — use aggregates (R-10).
5. Retaining evidence photos indefinitely.
6. Deletion without an audit record of the deletion action itself.
