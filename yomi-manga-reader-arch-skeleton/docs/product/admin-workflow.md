# Admin Workflow Specification

Status: Authoritative for T-ADMIN-* and T-UPLOAD-* product behavior. The admin (curator) is persona P1; this document is the source for the curator loop (journeys J-4/J-5).

## 1. Roles & Access

- `admin` role required for everything under `/admin` (FR-AUTH-008); enforced at page (SSR guard) and API (handler guard) — middleware is UX-only (ADR-006).
- Non-admin authenticated users get a 403 permission page (not a login redirect).
- Every admin **mutation** writes an audit event (FR-ADMIN-007); reads do not.
- Last-admin guard: the final active admin cannot be demoted or disabled (409 ADMIN_LAST_ADMIN) — prevents lockout (EC-ADM-04).

## 2. First-Admin Onboarding (J-4 step 1)

A fresh instance has no admins: the first registered account is bootstrapped via an **operator procedure** (documented in RUNBOOK — not a product surface): the operator sets `role=admin` on the first user via the maintenance role (one SQL statement, audited as `user.role.bootstrap` by the operator, not the app). The product then shows the empty-state onboarding: "No manga yet — create your first title."

Documented alternative (future, not v1): an env-flag `BOOTSTRAP_ADMIN_EMAIL` that auto-assigns admin on that account's first registration (REJECTED for v1 — implicit privilege is a smell; the operator procedure is explicit and auditable).

## 3. Manga Management (FR-ADMIN-001/002/003)

**Create:** title (required, ≤ 200), aliases (list), synopsis (plain text, ≤ 10k), status (ongoing/completed/hiatus), reading direction (rtl default/ltr), genres (vocab, create-on-type), tags (freeform, normalized lower), creators (name + role: author/artist/other, vocab-shared), slug (auto from title; editable once, **immutable after first publish** — EC-ADM-07).

**Edit:** all fields except slug (post-publish). Cover: upload (single image ≤ 10 MB; normalized WebP+JPEG ≤ 1200 px by the media pipeline) or auto (FR-UPLOAD-010).

**Soft-delete:** one flag; effect (immediate, modulo 60 s API cache — documented): hidden from catalog/search/detail/chapter-reading (all 404 public); user library entries retained (private; reading 404); chapters cascade-hidden via the manga flag (no chapter-level cascade delete); restore re-shows everything (T-ADMIN-003). Hard purge: ops procedure only (RUNBOOK), never UI.

**Publish:** manga-level flag; visibility rule = `published(manga) ∧ published(chapter) ∧ ¬deleted` (the single unit-tested function, features/manga). Unpublish = immediate hide, no data change.

## 4. Chapter Management (FR-ADMIN-004/005)

- Create under a manga: number (numeric, decimals allowed, unique per manga), title, notes. `reading_order` assigned on create (max+1); renumbering is not a v1 feature (manual `reading_order` edits are P2, out of PRD scope).
- Edit: number (re-checks uniqueness), title, notes.
- Soft-delete: hidden; progress/history rows orphan-preserved (FK rules, DATA_MODEL §9/§13); pages GC-queued.
- Publish/unpublish: chapter-level; **publish requires ≥ 1 page** (409 CHAPTER_NOT_READY) — a chapter with no pages is unreadable and un-publishable (integrity rule, DATA_MODEL §21.3).
- Bulk publish (manga publish) publishes all draft chapters that have pages; chapters without pages stay draft (counted in the response `{ affected }`).

## 5. Upload Workflow (J-4/J-5 core)

The curator's main loop, per chapter:

1. **Open the chapter** (admin chapter view) → "Upload pages" (or re-ingest).
2. **Choose input:** one ZIP archive **or** a set of image files (drag-drop + file picker; advisory client pre-checks: size/count/format hints — the server is authoritative, NFR-SEC-007).
3. **Submit** → 202 + job id → UI shows the job (state machine below) with progress; for > 100 MB the client uses multipart/presigned parts (FR-UPLOAD-008) with part-level progress.
4. **Watch** (poll 3 s): states render exactly as the machine defines them (§6); failure shows the typed human message + cause code + "Try again" (re-upload; or re-ingest).
5. **Ready** → UI links: "View chapter" (reader preview, admin can see drafts) + "Publish" (one click → FR-CHAPTER-002 live).
6. **Verify** (J-4 final step): open the published chapter in the reader (normal reader path), confirm first/last page render.

Rules:
- One active job per chapter (advisory lock, T-UPLOAD-006); a second submit for the same chapter while one is active → 409 (job busy, retry later).
- Re-ingest (FR-UPLOAD-009): replaces the page set on commit; old assets GC after 24 h grace; in-flight readers refresh once (EC-UP-05).
- A job failing is **terminal** (no auto-retry of jobs — the curator decides; auto-retry of flaky storage could mask bugs — documented choice).

## 6. Upload Job State Machine (FR-UPLOAD-007)

```
            ┌──────────┐
   submit → │  queued  │ (created; ≤ 10 pending system-wide, else 429)
            └────┬─────┘
                 ▼
           ┌───────────┐   fail    ┌────────┐
          │validating │──────────▶│ failed │ (terminal; typed code; staging 24 h)
          └─────┬─────┘           └────────┘
                ▼ fail
          ┌──────────┐           ┌────────┐
          │processing│──────────▶│ failed │ (terminal; typed code)
          └─────┬────┘  fail
                ▼ commit ok
           ┌────────┐
           │ ready  │ (terminal; chapter has pages; GC of old set if re-ingest)
           └────────┘
```

- Transitions are forward-only (DB CHECK + service guard); `failed` is always terminal.
- Every transition: audit event (admin-relevant) + log + state metric.
- Failure codes: the typed table (API_CONTRACT §6, UPLOAD_*) — each maps to a human message the curator can act on ("Archive expands beyond the safe limit — re-compress or split the chapter").
- Watchdog: processing > 15 min → killed → failed (`UPLOAD_JOB_TIMEOUT`); app restart mid-processing → job left processing; next boot sweep marks it failed `ops.timeout` (RUNBOOK 3.1) — the curator re-uploads.

## 7. User Management (FR-ADMIN-006)

- List: email, display name, role, status, last login, created (cursor; email-substring search).
- Role change: reader ↔ admin (audited; last-admin guard).
- Disable/enable: disable ⇒ sessions dead on next request (immediate effect, no waiting) + login blocked (403 AUTH_DISABLED, documented distinction); enable restores.
- No self-service role changes (admins can't promote themselves — they're already admin; they *can* demote themselves only if another admin exists — guard handles it).
- Account deletion is self-service only (FR-AUTH-005) — admins do not delete other accounts in v1 (disable is the control; documented).

## 8. Audit Log (FR-ADMIN-007, NFR-SEC-012)

- Immutable append-only (no app update/delete path; DB role restriction verified in T-SEC-005).
- Events: `manga.create/update/delete/restore/publish/unpublish`, `chapter.create/update/delete/publish/unpublish/reingest`, `user.create(implicit)/update`, `upload.intake/failed/ready` (state-relevant), `cover.set`.
- Shape: actor (id + email; post-deletion `<deleted>`), action, target kind+id, before/after summaries (capped 2 KB/field, no secrets, no full synopsys), ip, timestamp.
- UI: filterable (target kind/id), cursor list, pretty before/after JSON.
- Retention ≥ 1 year (NFR-DATA-005); no deletion UI (ops procedure only).

## 9. Stats Dashboard (FR-ADMIN-008)

- Counts: manga, chapters, pages, users, library entries (live, one query each).
- Upload health (24 h / 30 d): ready/failed counts, p50/p95 job duration, top failure codes (drives curator self-service: "your ZIPs fail on X").
- Refresh: manual button + 5 min cache (no live ticking — cost).

## 10. Admin UX Rules (cross-cutting)

- Destructive actions (delete, unpublish, disable) require a confirmation dialog (a11y: focus trap, labeled) — UX protection, not security (the API is the security boundary).
- Every admin page: no-store (private context), admin-nav landmark, keyboard-operable (NFR-A11Y-002).
- Admin pages are *dense but not dark-patterned*: state is always visible (job states, publish states, validation errors) — the curator must never have to guess whether an action landed (the audit log is the appeal path).
