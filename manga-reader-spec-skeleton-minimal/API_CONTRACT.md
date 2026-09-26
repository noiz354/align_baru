# API contract (planned only)

Boundary: versioned same-origin JSON `/api/v1`; server-rendered reads may share application services but must preserve same DTO/authorization guarantees. Success/error envelopes are stable; cursor pagination opaque; no storage keys returned. All input schemas bounded. This table is a contract outline, not handler authorization substitute.

| Operation | Req | Caller/authz | Input → output | Failures/validation | Rate/idempotency |
|---|---|---|---|---|---|
| GET catalog / GET manga/:slug / GET manga/:slug/chapters | FR-CATALOG-001/002 | public; published only | filters/cursor → catalog/detail/page | 400 invalid filter, 404 concealed unpublished, 429 | per-IP bounded; GET safe |
| GET search | FR-SEARCH-001 | public | q (bounded), facets,cursor → results | 400 too long/invalid, 429 | stricter per-IP; deterministic pagination |
| GET chapter/:id/manifest | FR-READER-001/013 | public or entitled per future policy | id → ordered metadata + controlled delivery references | 404 concealed, 410 unavailable, 429 | edge cache policy; no sensitive query |
| GET/PUT progress | FR-READER-014, FR-LIBRARY-006 | session; owner only | chapter/page/version → progress/version | 401,404,409 stale/deleted,422 invalid page | user limit; conditional/versioned idempotent upsert |
| GET/POST/DELETE library entries | FR-LIBRARY-001/002 | session owner | manga ID/cursor → entries | 401,404,409 duplicate,422 | user limit; PUT semantics idempotent |
| GET/POST/DELETE bookmarks | FR-LIBRARY-003 | session owner | chapter/page anchor → bookmark | 401,404,409 stale,422 | user limit; idempotency key for create |
| GET/PUT preferences | FR-LIBRARY-005 | session owner | versioned preferences → preferences | 401,422 schema/version | user limit; conditional update |
| POST auth session / DELETE session | FR-AUTH-001 | public credentials / session | provider-defined credential → minimal account/session | generic 401,429,503 | IP+account throttles; safe retries carefully limited |
| Admin catalog/chapter operations | FR-ADMIN-001..003 | session + scoped editor role | validated metadata/state/version → resource revision | 401/403/404/409/422 | actor limits; idempotency for publish commands |
| POST upload intent / POST finalize / GET upload status / POST reject | FR-UPLOAD-001..004 | scoped operator | metadata/checksum/idempotency → opaque upload status | 401/403/409/413/415/422/429 | strict per actor and global quotas; dedupe token |

### Error taxonomy and HTTP mapping
`AUTH_*` (401/403), `CATALOG_*` / `MANGA_*` / `CHAPTER_*` / `READER_*` / `LIBRARY_*` (404 concealed, 409 conflict, 422 invalid state), `UPLOAD_*` (400/413/415/422/409), `STORAGE_*` (502/503 generic), `VALIDATION_*` (400/422), `RATE_LIMIT_*` (429 with safe retry hint), `INTERNAL_*` (500 generic). Public error: stable code, safe message, requestId; never stack, SQL, paths, token, signed URL, or internal provider detail. Operational errors logged with redaction and severity; security anomalies sampled/alerted according to SECURITY/OBSERVABILITY. Validation does not replace authorization. No API handlers in this phase.
