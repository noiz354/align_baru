# Page 13 — Security incident report gap report

**Decision:** PARTIAL / NOT DONE. This is an operator capture pilot, not an end-to-end production incident system. Do not mark T-INC-001 complete.  
**Baseline:** `docs/integration/13-security-incident-ground-truth.md`  
**Current architecture:** `docs/integration/13-security-incident-architecture.md`

## Acceptance matrix

| Requirement | Current result | Evidence | Remaining work / release impact |
| --- | --- | --- | --- |
| Neutral, non-accusatory incident report page | Implemented in code | `src/app/operator/incidents/new/incident-report-client.tsx`; domain category help; route tests | Browser/operator review not yet completed; keep wording review open |
| Real operator/session + active location context | Partial | Self-scoped API test uses seeded local operator/shift/site | Auth adapter is fake in development and fails closed in production; no real operator sign-in runtime acceptance |
| Server-side auth and tenant/operator isolation | Partial, route-test covered | `tests/integration/incident-report-api.test.ts`: unauthenticated, HQ role, cross-tenant, other operator direct-detail URL, spoofed scope | Production identity/session integration and real database row-level scope tests remain release gates |
| Strict server input validation | Implemented for online contract | Unit/API tests cover category, narrative bounds, amount pairing/integer bounds, future time, strict protected-field/evidence rejection, key match | Add contract-level fuzz/property cases if online schema evolves |
| Optional amount/chronology/current site persistence | Local pilot implemented | Route test asserts row fields; offline test asserts device timestamp path | No deployed SQL migration; no production persistence; no business-time past-age bound in current validation |
| Idempotent submission | Local path covered | Same-key replay/no duplicate, changed same-key body 422, invalid key and same client ID conflict path | Memory/file store has no transactional concurrency guarantee; production unique constraint/transaction/retry behavior must be proven |
| Audit and data minimization | Local path covered | Audit test checks `incident.submitted` and narrative absence; logger spy checks payload redaction | Verify centralized logs, audit access, retention, alerts and backups in production; review legacy transition audit path before enabling it |
| Evidence upload/reference and validation | Explicitly unsupported (truthfully surfaced) | UI says unavailable; strict online schema rejects evidence keys; analytics docs omit evidence event | No upload/reference/private storage/access/deletion. Do not accept evidence until security/privacy approval and full evidence validation/retention/purge proof; no `incident_evidence_added` event exists |
| Status workflow | Partial/unsupported on Page 13 | New records begin `SUBMITTED`; UI only displays known server status | No operator lifecycle mutation, reviewer/HQ scoped detail, assigned severity, owner/SLA, transition UI or notification/escalation. Broader workflow must be implemented and tested separately |
| Offline submission | Compatibility path retained, event time now passed through | `tests/integration/incident-offline-sync.test.ts` | Legacy offline contract accepts a different category field and bypasses the online strict schema; verify actual device outbox/auth/retry lifecycle and delayed-sync semantics |
| Real runtime, reload and server restart | Pending evidence | `docs/integration/13-security-incident-runtime-evidence.md` | Must run actual app, verify saved/read state and restart durability. Runtime proof against local file store is not production durability proof |
| Browser acceptance/accessibility | Pending | No browser acceptance claimed | Operator/laptop review still needed; test mobile layout, form recovery after network loss, contrast/focus/screen-reader behavior and direct URLs |
| Build/CI gate | Local build/full test pass; remote CI and browser tests pending | `docs/integration/13-security-incident-runtime-evidence.md` records typecheck, 203-test full suite and production build PASS | `check:docs` and `check:stubs` fail on repository-wide pre-existing/page-stub policy issues; full static lint coverage is absent from current ESLint config. Trigger/inspect remote CI when available |
| Retention/deletion | Unsupported for production | `RETENTION.md` policy only | No incident purge job, verified backups deletion, DSAR workflow or production retention enforcement. Define data lifecycle before production reports are collected |

## Highest-priority blockers

1. **P0 — Production identity and durable storage:** Development fake actor plus local JSON is the only runnable path; production auth returns no session. Deploy no operator report data to production until real auth, transactional persistence, backward-safe migration, and scope queries are verified.
2. **P0 — Browser/runtime acceptance:** The test suite does not replace user acceptance. Complete operator browser flow, unauthorized direct URL proof against a running app, validation/error/retry handling, reload and restart evidence.
3. **P1 — Evidence is unavailable:** Keep the upload section explicitly unavailable and do not accept a URL/asset ID. Before enabling it, define private storage, object authorization, MIME/size/content validation, malware/privacy review as applicable, retention/deletion including backups, and audit/event proof.
4. **P1 — Offline reconciliation:** Maintain the existing direct queue call, but normalize old category IDs and establish device-time/idempotency semantics end-to-end before relying on offline incident capture.
5. **P1 — Lifecycle/HQ response:** `SUBMITTED` is not the complete incident workflow. Human acknowledgement, scoped review, status transitions, response notification and safety escalation remain separate work.
6. **P1 — Operational privacy controls:** Apply and verify retention, data access/audit monitoring, backup retention and DSAR processes against incident narratives and amount/location links.

## Stop conditions

- Never label `UNOFFICIAL_PAYMENT_REPORTED`, `SECURITY_CONCERN_REPORTED`, `THEFT`, or other operator categories as a finding about an identified person.
- Never imply a P1 hint creates an immediate response; direct users to human/emergency help for immediate danger.
- Never ship evidence controls backed only by `src/server/storage/evidence-store.ts` fake presigning.
- Do not claim production readiness, offline browser acceptance, reviewer workflow, evidence handling, or completed runtime acceptance from local route tests.
