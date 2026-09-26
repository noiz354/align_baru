# Vertical-slice roadmap

No slice is executed in this phase. Sequence may change only via ADR/task update.

| Slice | Requirements/tasks | Dependencies | User-visible result | Automated / manual verification | Exit criteria |
|---|---|---|---|---|---|
| VS-0 Foundation | NFR-SEC-001,NFR-OBS-001; T-FOUND-001..006 | none | deployable empty app shell, quality gates | build/type/lint; inspect configuration | environments, boundaries, CI and runtime baseline documented |
| VS-1 Catalog | FR-CATALOG-001..003, FR-SEARCH-001; T-CAT-001..008 | VS-0, DB ADR | browse/detail/chapters | API/integration + browser | published-only and pagination acceptance |
| VS-2 Minimal Reader | FR-READER-001..003,006,007; T-READER-001..010 | VS-1, media contract | one usable chapter and modes | reader unit/E2E | first page + explicit direction/errors |
| VS-3 Reader Navigation | FR-READER-004..005,009; T-READER-011..020 | VS-2 | keyboard/pointer/touch, zoom/fullscreen, chapter boundary | browser/device/manual a11y | all input paths and boundaries pass |
| VS-4 Reader Performance | FR-READER-008,010..014; NFR-PERF-013/014; T-READER-021..040 | VS-2/3 | bounded large-chapter reading and progress | 50/100/200/500 stress, network throttling | memory/network budgets and recovery pass |
| VS-5 Authentication + Library | FR-AUTH-001, FR-LIBRARY-001..006; T-AUTH/T-LIB | VS-0, ADR-006 | accounts, save/resume | authorization integration/E2E | owner isolation, revocation, restore pass |
| VS-6 Admin | FR-ADMIN-001..004; T-ADMIN-001..012 | VS-1, VS-5 | authorized editors curate/publish | role matrix/admin E2E | audit, validation, publication gates pass |
| VS-7 Secure Upload Pipeline | FR-UPLOAD-001..004; T-UPLOAD-001..030 | VS-6, ADR-004/005, NFR-SEC-011 | controlled ingestion/review | archive corpus/fuzz/resource tests | quarantine→review→publish proven safely |
| VS-8 Search | FR-SEARCH-001/002; T-SEARCH-001..008 | VS-1 | useful metadata search | contract/perf/relevance fixtures | latency and deterministic results budget |
| VS-9 Hardening | NFR-SEC-001,011; T-SEC-001..012 | VS-5..8 | safer production workflows | pen test, dependency and abuse tests | critical findings closed/accepted |
| VS-10 Observability | NFR-OBS-001; T-OBS-001..008 | VS-0..9 | operational visibility | telemetry contract and alert tests | dashboards, redaction, alert owners |
| VS-11 Production | NFR-REL-001; T-PROD-001..012 | all prior | launch-ready service | restore/rollback/load/smoke | SLO, recovery, go-live checklist signed |

Verification includes automated suites and manual mobile/accessibility/operator QA. Rights/legal signoff is a release gate. Feature sequencing does not authorize work by itself; execute task dependencies and approval gates.
