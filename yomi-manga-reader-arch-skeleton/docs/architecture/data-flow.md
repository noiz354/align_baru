# Data Flow

The normative read/write paths. Sequence-level detail for the high-risk flows (reader, upload) and the rules for everything else.

## 1. Read Path — Catalog & Detail

```
Browser ──GET /manga/{slug}──▶ [web: RSC page]
   [web] ──▶ features/catalog.MangaService.detail(slug, caller?)
       └──▶ port MangaRepository.bySlug(slug)          [domain → port]
            └──▶ server/db (Drizzle: ix_manga_slug)      [port impl]
                 └──▶ PostgreSQL
   [web] renders (SSR, streamed) with coverUrl=/media/{coverAssetKey}
Browser ──GET /media/{coverAssetKey}──▶ [web: media route]
   [web] ──▶ server/media.delivery(assetKey)
       └──▶ port ObjectStoragePort.get(key)
            └──▶ S3/R2/MinIO (stream, no buffer)
```

Rules:
- The catalog list (FR-CATALOG-001…005) is the same shape: web → catalog service → MangaRepository.list({cursor, limit, filters, sort}) → rows → DTOs. `latestChapter` is computed in the repository query (single SQL, no N+1).
- Caller context: RSC resolves the session (presence check) and passes an **optional** `Caller { userId?, role }` into the service — the service adds `continueReading` only when present (FR-CATALOG-008). Anonymous path = same service, no caller.
- Caching: response headers per API_CONTRACT §1 (60 s private SWR for public reads; no-store for caller-dependent responses — the detail page is SSR'd server-side, so cache headers apply to the *API*; RSC HTML is no-store by Next default — documented).

## 2. Read Path — Chapter Open & Reader

```
Browser ──GET /manga/{slug}/chapter/{chapter}──▶ [web: reader route]
   [web SSR] ──▶ chapters.ChapterService.open(chapter, caller?)
        └──▶ port ChapterRepository.byId + ChapterPageSource.list(chapterId)
             └──▶ PG (ix_chapters_*, PK range on pages)
   SSR emits: shell + <picture> for page 1 (variant URLs) + pageList JSON (first page + count; full list via API below)
   [client hydrate] ──▶ GET /api/v1/chapters/{id}/pages
        └──▶ same service (public check: published ∧ manga-published)
             → PageAsset[] (ordered; variant URLs; dimensions)
   [client reader] owns ReaderState (reducer):
        window = calculateReaderWindow(current, M, mode)        [pure, T-READER-031]
        loads <img> for window (priority ladder, T-READER-020)  [client fetch of /media keys]
        evicts out-of-hysteresis <img> (residency ≤ 12, T-READER-019)
   progress (if caller):
        POST /api/v1/progress  (debounced 1 s vertical / immediate paged)
        └──▶ progress.ProgressService.save({chapterId, page, scroll, completed?})
             └──▶ port ProgressRepository.upsert (server-stamped LWW, sticky completed)
        GET /api/v1/progress?chapterId (on open, before first paint of images, T-READER-029)
   media:
        Browser ──GET /media/{assetKey}──▶ server/media → storage (stream; immutable headers)
```

Rules:
- The reader never requests pages by index from the server — it has the full list (NFR-PERF-008); the server is only the byte source (`/media`).
- Anonymous: identical path minus progress API calls; local store (T-READER-024) is the only progress surface.
- The 500-page case adds no extra server round-trips vs the 50-page case (same calls; client-side windowing differs by position only) — that's the design intent (ADR-007, NFR-PERF-012).

## 3. Write Path — Upload (the highest-risk flow)

```
Admin UI ──POST /api/v1/admin/uploads (multipart, Idempotency-Key)──▶ [web: route]
   [web] guard requireAdmin → uploads.UploadService.intake(jobInput)
        1. port UploadJobRepository.create(state=queued)              [PG]
        2. port ObjectStoragePort.putStream(staging/{jobId}/{name}, stream)  [S3]
        3. 202 {jobId}
   [pipeline driver (in-process; T-UPLOAD-006)]:
        queued → validating:
            features/uploads.prepareChapterUpload(manifest)          [PURE — no I/O]
               magic bytes, caps, entry safety (T-08/09/10 controls)
               reject ⇒ job=failed + typed code + staging purge (24 h)
        validating → processing:
            extract: safe extraction to staging (canonicalized, caps)
            per page (≤ 4 concurrent):
               port ImageProcessorPort.normalize(bytes) → {avif, webp, jpeg, dims}
               port ObjectStoragePort.put(pages/{chapterId}/{key}.{ext}) × 3
        processing → ready:
            port UploadJobRepository.commit(chapterId, pages[], job)  [ONE PG transaction:
               ChapterPage insert 1..N, chapter.page_count, job=ready]
        (failure at any phase ⇒ job=failed + typed code; commit failure ⇒ rollback + purge)
   Admin UI polls GET /api/v1/admin/uploads/{jobId} (3 s) → publishes (T-ADMIN-005) → reader live.
```

Rules:
- Validation (T-UPLOAD-014) is pure and separate from I/O — the security-critical logic is unit-testable without infrastructure (TEST_STRATEGY UNIT-UP-*).
- Commit atomicity (FR-UPLOAD-006): "ready chapter" and "complete page set" are one transaction; there is no intermediate public state (draft chapters with pages are admin-visible only — FR-CHAPTER-002).
- Re-ingest: same flow; commit replaces the page set in-transaction; old keys GC-queued (24 h grace, T-UPLOAD-009).
- No background queue/worker in v1 (in-process driver + polling UI); the worker-extraction scale option (ARCHITECTURE §8.4) reuses the same driver as a different entrypoint.

## 4. Write Path — Auth

```
POST /api/v1/auth/login ──▶ auth.AuthService.authenticate({email, password})
   1. port UserRepository.byEmail(email) (unknown ⇒ dummy Argon2 verify, uniform timing)
   2. port PasswordHasher.verify(hash, password)        [argon2, constant-time]
      params < current ⇒ re-hash + update (background-free: same request, documented cost)
   3. port SessionRepository.create(user, ua, ip)       [256-bit token; idle 30 d; abs 90 d]
   4. cookie set (HttpOnly/Secure/SameSite=Lax) + 204
Every protected request:
   [middleware: presence only] → [route guard: authoritative]
      port SessionRepository.getByToken(token) + user.status check
      ⇒ Caller {userId, role} (frozen) — the only identity source (THREAT T-04)
```

## 5. Write Path — Library / Bookmarks / Preferences

Identical shape: web guard → feature service (scoped to Caller.userId) → repository port → PG. No new rules; IDOR-impossible by construction (identity never from input).

## 6. Telemetry Flow (cross-cutting)

```
[web request] ──▶ span (HTTP) + log line (requestId, traceId bound)
   └──▶ service span (hot paths only)
        └──▶ port call spans: DB (auto/manual), STORAGE (manual around port)
[client reader] ──▶ beacon batch (≤ 100 events) ──▶ POST /api/v1/telemetry/beacon
        ──▶ server/telemetry ingestion → metrics (yomi_reader_*) + log
[host] ──▶ stdout logs → collector (Loki); OTLP push → Prometheus/Tempo (30 s)
```

Rules: span budget ≤ 8 on the reader hot path (OBSERVABILITY §2.4); redaction at the logger root (NFR-OBS-006); beacon never blocks the reader.

## 7. Cross-Cutting Invariants

1. **Identity flows one way:** session → guard → Caller → service. Never from request data (private ops).
2. **Bytes flow two ways only:** browser ⇄ storage (via app stream). Nothing else reads/writes storage (media delivery + upload pipeline).
3. **State writes are transactional where consistency matters:** upload commit (multi-row), account deletion (cascade list), re-ingest (replace). Single-row writes are plain upserts.
4. **Every cross-boundary call is typed** (shared/contracts) — an untyped crossing is a review failure.
