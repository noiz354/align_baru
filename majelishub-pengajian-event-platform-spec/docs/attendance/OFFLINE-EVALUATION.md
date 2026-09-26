# OFFLINE CHECK-IN — EVALUATION (ADR-0007)

Requirement: FR-CHECKIN-016, NFR-REL-006 · Decision: **offline synchronisation is deferred; not
implemented in the MVP** · Related: `CHECKIN.md`, `RUNBOOK.md` RB-01, `docs/architecture/FAILURE-MODEL.md`

---

## 1. The question

Should a check-in device be able to record arrivals while it has no connection to the server (venue
Wi-Fi down, mobile data saturated, platform unreachable), then synchronise later?

## 2. Why it is tempting

- Mosques in Indonesia frequently have poor data connectivity, especially at 04:30 in a crowded hall.
- The entrance is the most visible point of failure; a queue forms in seconds.
- Volunteers already keep paper lists, so "the device was offline" is a real operational state.

## 3. Options considered

| Option | Description | Verdict |
|---|---|---|
| **A. Pure online** | Every check-in requires the server; failure means manual/paper | **Baseline retained** |
| **B. Offline-first with CRDTs / local authority** | Device records arrivals locally and syncs later; local state is authoritative | Rejected for MVP |
| **C. Offline queue of *intents* with optimistic local display** | Device lets operators mark arrivals locally, shows an explicit "belum tercatat" state, and syncs when back | Deferred (see §6) |
| **D. Paper fallback with bulk entry afterwards** | Staff write arrivals on a printed list; entries are typed in afterwards with reasons | **Adopted** |
| **E. Hybrid: local token cache for validation only** | Device caches a validation index (hashed tokens) to answer "valid?" offline, but commits nothing | Deferred with C |
| **F. On-site local server / hotspot appliance** | Mosque runs a small local instance that syncs | Rejected for MVP (operational complexity, security surface, who maintains it at 04:30?) |

## 4. Why offline authority (B) was rejected for the MVP

1. **Duplicate attendance is the rank-1 failure.** Two devices offline simultaneously, each with its own
   belief about a token, produce conflicting records; merging them requires conflict resolution rules
   for a fact that is inherently single ("arrived once").
2. **Security.** An offline device must validate tokens without the server, i.e. it must carry a
   validation index (or worse, accept anything). Either way a stolen device becomes an oracle, and
   revocation (lost phone, abuse) cannot propagate.
3. **Attribution and audit.** The record of who scanned what, with which device, becomes provisional;
   the audit trail would have to be reconciled, and audit trails lose their value when they are
   negotiable.
4. **Feedback loops.** Attendance reporting, no-show derivation and correction flows all assume a single
   authority. Making the device authoritative means every downstream report needs a reconciliation
   stage.
5. **Complexity vs. deployment reality.** The operational context is one to three devices, one venue,
   and a printed list that already exists. The maintenance burden of a sync engine (conflict UI, partial
   sync states, device clock skew, version skew) is not proportionate for the MVP.

## 5. Consequences of the decision (accepted deliberately)

| Consequence | Mitigation |
|---|---|
| The entrance degrades when connectivity fails | Manual short-code entry, name lookup, and the printed-list path; the console tells the operator what to do |
| Some arrivals are recorded minutes or hours later | Bulk entry requires a reason and records the entry time plus the stated arrival time; reports distinguish "check-in via manual entry" and show a data-quality note |
| Duplicate risk moves to paper | Bulk entry is idempotent per registration (unique constraint) and refuses a second record with `ALREADY_CHECKED_IN` |
| Operators may feel the product "failed" | The UI never shows a success state while offline ("belum tercatat"), and the console clearly presents the paper fallback as a *supported* mode, not a failure |
| Poor connectivity at some venues is invisible | Pre-flight checks in the console (connectivity indicator, last-sync time) let organizers know before the event; recurring problems are flagged in the organizer's dashboard |

## 6. Revisit triggers (when to build option C/E)

Build offline intent-queueing **only** when at least one of these is true, and with a new ADR:

1. A deployment reports **≥ 2 entrance incidents per month** caused by connectivity (measured via
   `checkin_total{result=UNAVAILABLE}` clustered during event windows).
2. A venue's connectivity is structurally bad (documented by repeated backlog/availability alerts) and
   paper fallback demonstrably costs accuracy (bulk-entry share > 20% of check-ins for recurring events).
3. A deployment is willing to fund the maintenance of a sync engine and its tests, including the
   conflict UI and the device-revocation story.
4. Option E becomes safe: the validation index can be limited to **the event's own tokens**, hashed,
   with short TTL, bound to one device, and stored in a way that survives neither device theft nor clock
   manipulation — evaluated honestly, including its residual risk.

If built, the design constraints are already fixed by the rest of the system:

- Local records are **intents**, never attendance rows; the server remains the only writer.
- The UI distinguishes at all times: "tercatat" / "belum tercatat" / "menunggu sinkronisasi" — never a
  success shape while unconfirmed (FR-CHECKIN-016).
- Every synced intent carries device id, local time, and the operator's session; server time is
  authoritative for the record.
- Conflicts resolve to one attendance record with the **earliest** arrival time; the loser is recorded
  as a duplicate, with both device ids retained for the audit trail.
- Revocation wins: a token revoked while a device was offline must be rejected at sync time, and the
  operator informed that a person's entry needs manual resolution.
- Offline mode is a **flag** that an organizer turns on deliberately for a specific event, not a silent
  automatic behaviour.

## 7. Current state in the product

- Conceptual manual fallback exists and is first-class (`ADR-0026`, `CHECKIN.md` §8).
- No sync engine, no local attendance storage, no offline validation cache is implemented.
- The paper/print path is supported: printable participant lists with short codes are referenced in
  `CHECKIN.md` and are part of VS-4 acceptance.
- The console's offline behaviour is specified: reject-with-clarity, never fake success.
