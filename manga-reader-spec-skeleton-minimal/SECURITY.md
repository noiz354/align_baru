# Security requirements

Security is deny-by-default, threat-led; authorized content is not equivalent to DRM. Scope includes browser, Next app, identity/session, DB, upload quarantine, processors, object store/CDN, CI and operators.

- Enforce authentication and resource/role authorization server-side per request and per object (NFR-SEC-001, FR-ADMIN-003); no UI-only checks.
- Protect browser sessions with mature provider/library decision, secure HttpOnly/Secure/SameSite cookies, rotation/revocation, CSRF strategy for state changes, origin checks where appropriate, CSP and output encoding. Review OAuth only if selected later.
- Parameterized ORM operations, least privilege DB roles, bounded input and output, reviewed migrations; no interpolated SQL.
- Uploads: strict caps, content sniff/allowlist, quarantine, random keys, path normalization, archive entry/path/count/expanded-byte/dimension limits, parser sandbox/time/memory limits, checksums, malware scanning decision, never publicly serve raw uploads. ZIP central-directory and symlink handling; reject traversal and nested archive abuse.
- Media delivery: private bucket, narrowly scoped expiring signed GET or authenticated proxy, exact origin/CORS policy, no credentials in browser, content-type/disposition/nosniff, immutable versioned assets only after publication.
- SSRF: ingestion fetch-by-URL is out of scope; if ever added, block private/link-local/metadata addresses, revalidate redirects/DNS and egress-control.
- Admin: MFA for privileged operators recommended/required before production; least privilege, audited publish/reject, dual-control policy to decide for high impact actions.
- Logging/telemetry: redact secrets, session IDs, signed URLs, email and reading content; restricted retention/access.
- Supply chain: lockfile, pinned GitHub Actions by SHA, minimal permissions, dependency scanning, provenance/SBOM and review; no secrets in PR logs.
- Incident response, backup protection and restore testing required before launch. Details in THREAT_MODEL.md and DEPLOYMENT.md.

Verification: abuse-case tests, authorization matrix, dependency/SAST/secret scanning, upload fuzzing in isolated environment, CSP/security headers tests, manual admin and session review. Related tasks EPIC-09 and EPIC-12.
