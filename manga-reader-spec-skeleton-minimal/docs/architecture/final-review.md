# Final architecture review and traceability audit

Review performed 2026-09-26. Corrections incorporated: no exact unsupported patch versions asserted; provider/auth identity decision explicitly open; OTel logs marked development; feature boundaries made ports-first; no real database schema/migration or product data; S3-compatible differences flagged; image processor remains planned only; 500-page memory bounded requirement called out; anonymous progress not assumed. No cyclical dependencies in allowed graph.

## Traceability sample

| Requirement | Architecture | ADR | Task | Skeleton / contract | Planned tests |
|---|---|---|---|---|---|
| FR-CATALOG-001 | catalog→manga read port | 001,002,003 | T-CAT-001 | features/catalog contracts | catalog published-only integration |
| FR-READER-001 | reader consumes chapter manifest | 001,007 | T-READER-001 | reader contracts | manifest contract/E2E |
| FR-READER-008 | bounded client window | 007 | T-READER-031 | ReaderWindow contract | UNIT-READER-031, memory stress |
| FR-READER-014 | progress port, owner auth | 003,006,007 | T-READER-021 | progress repository interface | concurrency/authorization integration |
| FR-LIBRARY-006 | owner-scoped progress | 006,007 | T-READER-021 | progress contract | IDOR tests |
| FR-UPLOAD-002 | quarantine + media pipeline | 004,005 | T-UPLOAD-015 | upload intake placeholder | archive corpus/fuzz |
| FR-ADMIN-003 | admin policy + audit | 006,009 | T-ADMIN-001, T-AUDIT-001 | admin service contract | role matrix/E2E |
| NFR-PERF-014 | O(window) image lifecycle | 007 | T-READER-031, T-PERF-001 | ReaderWindow type | 500-page memory stress |
| NFR-SEC-011 | isolated bounded upload processing | 005,009 | T-UPLOAD-014/015, T-SEC-001 | upload port placeholder | bomb/path/MIME tests |
| NFR-A11Y-001 | accessible reader/UI | 001,007 | T-ACCESS-001 | route/component TODO boundaries | axe + manual AT |
| NFR-OBS-001 | telemetry adapter | 008 | T-OBS-001 | telemetry contracts | redaction/trace tests |
| NFR-REL-001 | managed deployment/recovery | 009 | T-PROD-001 | deployment docs | restore/rollback drills |

Coverage: every P0 PRD area maps to an epic/task family; task backlog is representative and intentionally does not enumerate every microtask. Before implementation, expand requirement-to-task mapping for all listed FR/NFR IDs and close open decisions. Counts: 42 stable requirements in PRD (34 FR, 8 NFR); 26 unique task entries; 12 vertical slices. Audit finding: TASKS has repeated references where epic overlap occurs; task numbering graph must be normalized and dependencies explicitly assigned before kickoff. No implementation or feature behavior was added. No available Agent Skill registry was exposed; SKILLS.md states that limitation.

## Architecture review findings
- Acceptable for specification phase: modular monolith without unneeded brokers/search/cache/Kubernetes.
- Open: identity provider/auth library, object provider/region, rights evidence and lifecycle, progress concurrency and completion threshold, anonymous state policy, upload processor sandbox/worker boundary, exact API route/versioning, SLO/RPO/RTO.
- Correct before implementation: tasks list count and task ID reuse/ambiguous dependency. T-FOUND-001 is explicitly first task. Security, accessibility and mobile budgets documented.
- No forbidden implementation detected: source files are contracts and explicit throws/TODO only.
