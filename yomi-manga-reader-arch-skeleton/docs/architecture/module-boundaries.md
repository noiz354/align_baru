# Module Boundaries

Authoritative boundary specification. The module map in ARCHITECTURE.md §3 is the summary; this document defines what each module may contain, what it owns, and what it must not do.

## 1. Layer Model

```
web (src/app)          — routes, RSC pages, route handlers, middleware, error boundary
domain (src/features)  — business rules, state machines, port definitions (interfaces live here or in shared/contracts)
shared (src/shared)    — contracts (types, ports, errors), validation, types, ui primitives  [leaf layer]
infra (src/server)     — port implementations: db, storage, media, auth stores, telemetry, composition
```

Dependency direction: web → domain → shared; infra → shared; web → infra **only through composition** (the composition root wires ports to implementations; route handlers receive services via the composition root, never construct infra directly in product code — documented exception: server/media's delivery route may call the media service it receives from composition).

## 2. Module Charters

### features/auth
- **Owns:** authentication/authorization domain rules: password policy, session lifecycle rules, role model, reset-token rules, account-deletion cascade ordering.
- **Defines ports:** `UserRepository`, `SessionRepository`, `PasswordHasher`, `MailPort` (VS-9 impl).
- **Must not:** touch HTTP cookies directly (cookie mechanics = server/auth), read the DB, send email itself.
- **Key invariants:** identity always from the verified session (THREAT T-04); uniform auth failures (T-03); last-admin guard.

### features/catalog
- **Owns:** catalog query rules: filters, sorts, cursor composition, detail assembly, resume resolution (with progress port).
- **Depends on (ports):** `MangaRepository`, `ChapterRepository`, `ProgressReader`.
- **Must not:** define entities (shared/contracts), hit the DB.

### features/manga
- **Owns:** manga aggregate rules: slug generation/uniqueness, aliases, metadata constraints, soft-delete semantics, visibility rule (`published ∧ !deleted` — the single function used everywhere, unit-tested).
- **Defines ports:** `MangaRepository`.

### features/chapters
- **Owns:** chapter aggregate rules: numbering (decimal), order (reading_order), publish state, page-list assembly, draft visibility.
- **Defines ports:** `ChapterRepository`, `ChapterPageSource`.

### features/reader
- **Owns:** the reader state machine (`ReaderState` + reducer), page-index invariants, windowing contract (`calculateReaderWindow`), pairing (double-page), mode/direction transition table, completion rule, preferences domain.
- **Depends on (ports):** `ProgressReader`, `ProgressWriter`, `ChapterPageSource`.
- **Must not:** issue HTTP requests, know about `<img>` internals beyond the window/residency contract, hold I/O in the reducer (pure).
- **Key invariants:** indices always 1..M (T-READER-032); window ≤ 12 (NFR-PERF-011); reducer pure.

### features/progress
- **Owns:** progress + history domain rules: idempotent save semantics (LWW, sticky completed), restore/merge rules, session boundary (history), resume resolution service (shared with catalog).
- **Defines ports:** `ProgressRepository`, `HistoryRepository`.
- **Must not:** decide UI debounce (client concern, documented in reader-behavior.md) — it defines the *server* semantics only.

### features/library
- **Owns:** library membership, bookmarks, read-status derivation, unread counts.
- **Depends on (ports):** `LibraryRepository`, `BookmarkRepository`, `ProgressReader`.

### features/search
- **Owns:** query parsing, ranking weights, result assembly.
- **Defines ports:** `SearchRepository` (the trigram query lives behind it; SQL in server/db).

### features/admin
- **Owns:** admin operations: content CRUD orchestration, publish orchestration, user management (with auth guard port), audit emission (via `AuditSink` port), stats assembly.
- **Depends on (ports):** manga/chapter/user repositories, `AuditSink`, auth guards (requireUser/requireAdmin from features/auth).
- **Must not:** duplicate domain rules (delegates to manga/chapters features), touch storage.

### features/uploads
- **Owns:** the upload job state machine, validation orchestration (`prepareChapterUpload` — pure core), extraction/normalization pipeline orchestration, commit orchestration (atomicity rules), GC queue rules, re-ingest rules, limits (via shared limits module).
- **Depends on (ports):** `ObjectStoragePort`, `ImageProcessorPort`, `UploadJobRepository`, `ChapterRepository`, `MangaRepository`, `AuditSink`.
- **Must not:** decode images itself (delegates to media port), write SQL.
- **Key invariants:** commit is atomic (no ready-without-pages); failures terminal with typed codes; staging always purged (24 h).

### server/db
- **Owns:** Drizzle schema (mirrors DATA_MODEL.md), connection lifecycle, all repository implementations, migrations.
- **May import:** drizzle, the driver, shared/contracts, (read-only) feature port definitions.
- **Must not:** contain business rules beyond query correctness (rules live in features); expose drizzle types to features (map at the boundary).

### server/auth
- **Owns:** session store implementation (PostgreSQL), cookie issuance/reading mechanics, the guard implementations (requireUser/requireAdmin), sweep job.
- **Must not:** contain password logic (delegates to PasswordHasher impl here? — no: the argon2 impl lives in server/auth as the PasswordHasher implementation; policy validation stays in features/auth).

### server/storage
- **Owns:** the `ObjectStoragePort` implementation (S3 SDK), multipart/presign mechanics, canary, staging lifecycle.
- **Must not:** know about pages/covers semantics (keys are opaque to it).

### server/media
- **Owns:** the `ImageProcessorPort` implementation (sharp pipeline per ADR-005), page/cover delivery (streaming, headers, format selection), normalization params.
- **Must not:** own page ordering (chapters feature), own keys' meaning.

### server/telemetry
- **Owns:** OTel init (API + SDK modules), pino root logger + redaction, beacon ingestion, alert rule file, dashboards.
- **Must not:** be imported by features (features emit through the `TelemetryPort`/logger facade in shared — or via injected services; no direct OTel imports outside server/telemetry).

### server/composition.ts
- **Owns:** the wiring: env → infrastructure → port implementations → service instances. The only place all layers meet.
- **Rule:** adding a new port without registering it here is a broken skeleton (typecheck enforces).

### shared/*
- **Owns:** the vocabulary: contracts (domain types, DTOs, ports, errors), branded IDs, validation schemas (env, limits), UI primitives + tokens.
- **Depends on:** nothing internal (leaf). May import: zod (validation), react (ui primitives only).
- **Must not:** import from features/server/web; contain behavior beyond pure helpers (the UI primitives are the exception: presentational, no data logic).

### src/app (web)
- **Owns:** routes, RSC pages, route handlers, middleware, error/not-found, the route→service call sites.
- **Rule:** route handlers are thin: parse/validate (Zod) → call a service (from composition) → map result/error to the contract. No business logic in route files (the lint "thin handlers" review rule).
- **Must not:** import server/* directly (except via composition exports), import drizzle.

## 3. Port Naming Convention

`<Thing>Repository` for persistence reads/writes; `<Thing>Port`/`<Thing>Service` for non-DB capabilities (ObjectStoragePort, ImageProcessorPort, PasswordHasher, MailPort, AuditSink, TelemetryPort). Port interfaces live in `src/shared/contracts/` (or the owning feature's public file, re-exported) — **implementation classes live only in server/**.

## 4. Boundary Enforcement

- ESLint `import` rules (T-FOUND-011): the four rules in AGENTS.md §4.1 as machine checks.
- Review rule: any PR that adds an import crossing a boundary is auto-flagged (CI + checklist).
- The composition root is the *only* sanctioned crossing point for web → infra.
