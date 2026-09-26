# Threat model

| Threat / boundary | Scenario → impact | Planned mitigation | Verification | Req / task |
|---|---|---|---|---|
| XSS / browser, metadata | hostile title/synopsis executes script, steals session | contextual escaping, safe rendering, CSP, sanitize only if rich text is later allowed | payload tests + CSP review | NFR-SEC-001 / T-SEC-001 |
| CSRF / session mutations | cross-site request changes library/admin state | SameSite, CSRF token/origin strategy, no state-changing GET | cross-origin browser tests | NFR-SEC-001 / T-SEC-002 |
| IDOR / all resource endpoints | change chapter/user ID to read/write another user's data | per-resource owner/policy checks; concealed not-found policy | authorization matrix tests | FR-LIBRARY-006 / T-SEC-003 |
| SQL injection / data access | crafted search/filter alters query | parameterized query builder; validate sort/filter allowlists | adversarial input and review | NFR-SEC-001 / T-SEC-004 |
| broken access / privilege escalation | user forges role or editor accesses unrelated tenant scope | server-side scoped roles, deny defaults, no client claims as authority | role matrix + admin E2E | FR-ADMIN-003 / T-SEC-005 |
| session theft / auth | XSS/device/network compromise reuses token | secure cookie, rotation/revoke, short bounded lifetime, MFA admin | cookie/header/session tests | FR-AUTH-001 / T-AUTH-004 |
| upload abuse / upload boundary | malicious oversized or forged upload consumes service | quotas, staged upload, content validation, quarantine | limit/bypass tests | NFR-SEC-011 / T-UPLOAD-014 |
| path traversal / Zip Slip | crafted archive writes outside work directory | safe extraction library/isolated temp; reject absolute, traversal, symlink entries | corpus fuzz tests | NFR-SEC-011 / T-UPLOAD-015 |
| decompression bomb | tiny archive expands huge / image pixel bomb | compressed+expanded limits, entry count, dimensions, CPU/memory/time limits | adversarial fixture tests | NFR-SEC-011 / T-UPLOAD-016 |
| MIME spoofing / unsafe delivery | executable/polyglot served as image | decode/re-encode allowlisted raster formats; nosniff; safe headers | file corpus & header test | FR-UPLOAD-002 / T-UPLOAD-021 |
| SSRF / future remote ingestion | supplied URL reaches metadata/private network | feature excluded; if introduced egress allowlist, IP/DNS/redirect validation | network isolation tests | NFR-SEC-011 / T-SEC-006 |
| unsafe file delivery / CDN | public origin exposes unpublished content or signed URL leaks | private bucket, short scope expiry, publish gate, referrer/log redaction | access-policy integration test | FR-UPLOAD-004 / T-UPLOAD-024 |
| secrets leakage / CI/runtime | credentials in repo/build/browser | secret manager, server-only env, scan, rotation | secret scan and bundle audit | NFR-SEC-001 / T-SEC-007 |
| logging leakage / telemetry | signed media URL or reading identity recorded | structured redaction, data minimization, access/retention | log inspection tests | NFR-OBS-001 / T-OBS-004 |
| rate abuse / public endpoints | enumeration/search/upload floods availability | edge/app per-IP/account quotas, caps, abuse alerting | load/429 tests | NFR-SEC-001 / T-SEC-008 |
| supply chain / CI/deps | compromised package/action exfiltrates secrets | lockfile, action SHA pinning, least token permissions, dependency review | CI policy audit/SBOM | NFR-SEC-001 / T-PROD-003 |

Assumptions: authorized media rights and account roles are governed outside the application; CDN and cloud controls are configured and audited. Reassess at launch and on new ingestion, tenant, payment, or third-party integrations.
