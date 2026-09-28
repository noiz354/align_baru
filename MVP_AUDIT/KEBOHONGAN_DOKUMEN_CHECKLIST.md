# Checklist Kebohongan Dokumentasi per Proyek

**Audit:** 2026-09-28 · **Base:** `8ebc15f` (main) · **Branch:** `feat/hapus_kebohongan_document`
**Ruang lingkup:** 7 dari 8 proyek. `yomi-manga-reader-arch-skeleton` **dikecualikan** (sedang dikerjakan).
**Metode:** baca dokumen vs. baca kode di commit yang sama. Semua angka di bawah dihitung ulang dari
tree, bukan disalin dari dokumen.

Legenda:

- `[ ]` belum dikerjakan · `[x]` sudah dikerjakan · `[!]` perlu keputusan manusia, bukanMechanical fix
- **Palsu** = dokumen menyatakan sesuatu yang bertentangan dengan kode
- **Kedaluwarsa** = Pernah benar, tidak pernah diperbarui setelah kode berubah
- **Melebihi** = underliesclaimexplaining lebih besar dari yang bisa dibuktikan

---

## 0. Root (memengaruhi ke-7 proyek)

- [ ] **Palsu** — `AGENTS.md:19-25` menyatakan enam folder `*-spec` berstatus **"Spec only, no
      implementation"**. Kenyataannya: `siomayops` punya 37 route + 13 page nyata, `strangerlink`
      punya matchmaking + WebSocket server, `maja` punya 5 page DB-backed, `homeops` 32 page,
      `manga` 13 page. Tabel status ini leftoverswave-1 dan tidak pernah disentuh.
- [ ] **Palsu** — `AGENTS.md:26` menyatakan `strangerlink` "TypeScript (planned)". `package.json` punya
      6 dependency runtime + 10 devDependency, terinstall, `npm test` jalan.
- [ ] **Palsu** — `AGENTS.md:15` `manga-reader-spec-skeleton-minimal` "Spec only, no implementation".
      Ada `package-lock.json`, `next.config`, 13 page, auth session, progress API.
- [ ] **Palsu** — `AGENTS.md:29` menyebut `rsi-agent-*` sebagai satu-satunya "Working prototype".
      `siomayops` punya Dockerfile + 37 route produksi dan `npm run build` hijau.
- [ ] **Melebihi** — `COMPLETION_MATRIX.md:18` "715 registered task IDs excluding RSI". Hitung ulang
      dari `TASKS.md` semua proyek: **majelishub 107 · homeops 250 · strangerlink 26 · siomayops 72 ·
      manga 39 · parking 20 (`TASK-nnn`) = 514**. Angka 715 tidak dapat direproduksi dari tree mana pun.
- [ ] **Melebihi** — `COMPLETION_MATRIX.md:18` "listed executable test passes total **755**".
      Angka ini menjumlahkan angka yang saling bertentangan dari 8 dokumen berbeda (64/66 untuk parking,
      11/147 untuk RSI, 15 untuk manga). Tidak ada satu eksekusi pun yang menghasilkan 755.
- [ ] **Melebihi** — `COMPLETION_MATRIX.md:16` majelishub "10/169 delivered". `TASKS.md` berisi **107
      ID unik** dengan pola `T-XXX-NNN` (bukan 169), dan **0** task außer 10 yang punya baris
      `**Delivered:**` — termasuk `T-ORG-002`, `T-MOSQUE-001`, `T-EVENT-003`, `T-REG-001`,
      `T-CHECKIN-001` yang kodenya sudah ada.
- [ ] **Kedaluwarsa** — `COMPLETION_MATRIX.md` menyatakan "Measured: 2026-09-27 … base `42c4621`".
      Commit itu bukan base `main` sekarang. Tabelnya 4 hari dan 7 commit tertinggal, termasuk seluruh
      wave2 + wave3.
- [ ] **Kedaluwarsa** — `README.md` root hanya berisi `# align_baru`. Tidak ada pointer ke
      `COMPLETION_MATRIX.md`, `HARNESS.md`, `MVP_AUDIT/`, atau gate yang ada. Pembaca pertama repo ini
      tidak punya peta.
- [ ] **Palsu (gate yang tidak ada)** — `.github/workflows/project-checks.yml` menjalankan
      `npm run typecheck` + `npm test` + `npm run build` untuk ketujuh proyek, tapi **tidak
      menjalankan `lint`** kecuali `yomi`. Komentarnya jujur ("added for YOMI ONLY") tapi
      `majelishub` punya **7 file yang melanggar rule `majelishub/module-boundaries` miliknya sendiri**,
      dan itu lolos ke `main` tanpa satu pun error. Gate ada, tidak dijalankan.
- [ ] **Palsu** — `.github/workflows/project-checks.yml` tidak punya job untuk
      `parking-attendant-ops-app-spec` via `unittest discover`? Ada (`python` matrix), tetapi **tidak
      ada job Database PostgreSQL untuk majelishub/homeops**, yang berarti `describeDb` degrade ke
      `skip` dan CI hijau tanpa membuktikan persistensi. Komentarnya sendiri mengakui ini untuk yomi
      lalu hanya memperbaiki yomi.
- [ ] **Menyesatkan** — `scripts/check-claims.mjs` dijalankan CI dan **lulus** (`OK — no contradicted
      package-presence claim`), padahal tool ini hanya memeriksa klaim kehadiran *package* dan
      *file landmark*. Ia tidak memeriksa klaim status, angka, atau hasil audit. Repo punya "gate
      kebenaran" yang tidak mencakup kebohongan yang paling merusak.
- [!] **Melebihi** — `MVP_AUDIT/screenshots/` berisi PNG untuk 8 proyek, tapi
      `MVP_AUDIT/wave3/majelishub.../RUNTIME_PROOF.md` menyatakan *"no actual browser screenshots were
      captured"* dan *"previous placeholder images were removed"*. Dua dokumen berbeda tentang
      apakah bukti visual itu ada. Perlu diputuskan: hapus screenshot yang tidak bisa direproduksi,
      atau revert klaim "removed".

---

## 1. majelishub-pengajian-event-platform-spec

- [ ] **Palsu** — `README.md:27` "**49 page shells** + 26 API route shells". Tree: **49 page total, 44
      di antaranya `ROUTE SHELL`, hanya 5 yang nyata** (`dasbor`, `kajian`, `kajian/[slug]`, `masjid`,
      `masjid/[slug]`). Dan route: **30, bukan 26**. Angka 49 dipakai untuk route juga di
      `README.md:55`.
- [ ] **Palsu** — `README.md:29` "four reviewed SQL migrations in `drizzle/`". Ada **6**:
      `0000`–`0005`. `0004`/`0005` tidak pernah didokumentasikan di README.
- [ ] **Palsu** — `README.md:35-36` "the lint rule checks **all 53**" stub. `grep 'throw new Error
      ("Not implemented: T-…")' src` → **80 throw site, 52 ID unik**. 53 tidak cocok dengan yang
      mana pun.
- [ ] **Palsu** — `README.md:41` "`npm run verify:vs0`". **Script `verify:vs0` tidak ada di
      `package.json`.** File `ops/verify-vs0.mjs` ada, tapi tidak pernah bisa dipanggil lewat npm
      run yang didokumentasikan. `TASKS.md:127` mengulang klaim yang sama.
- [ ] **Palsu** — `README.md:41` "`npm run lint` → exit 0". Lint **pasti gagal**: 8 file di `src/app`
      meng-import `@/server/db/schema` (`kajian/page.tsx`, `masjid/page.tsx`, `kajian/[slug]`,
      `masjid/[slug]`, `checkin/validate`, `checkin/summary`, `registrations`), sedangkan
      `ops/eslint/module-boundaries.mjs:148` melarang persis itu di luar `src/server`. Nol
      `eslint-disable` ada di `src/app`. Perlu dijalankan sungguhan untuk konfirmasi, tapi aturannya
      eksplisit.
- [ ] **Kedaluwarsa** — `README.md:12-15` "**exactly ten tasks** are implemented". Wave2/wave3
      menempelkan `T-ORG-002`(org+membership), `T-MOSQUE-001`, `T-EVENT-003`, `T-REG-001`,
      `T-CHECKIN-001` sebagai kode nyata. `TASKS.md` masih menulis semuanya `Planned / VS-1` atau
      `Planned / VS-3`. Register dan kode tidak pernah disinkronkan setelah `5f52802`.
- [ ] **Palsu** — `README.md:12` "Still prohibited everywhere: fake implementations, **production
      UI**". `majelishub-client.tsx` adalah UI produksi penuh: `<select>` user, form create event,
      panel hijau "RLS proof / Audit proof / Persistence". `layout.tsx` sendiri menulis
      "No visual design … Components read tokens, never literals" — sedangkan 5 page itu full
      `style={{}}` inline.
- [ ] **Palsu** — `MVP_AUDIT/progress/.../AFTER.md` **"Result: ACHIEVED — 13-step flow"**. Step 2
      adalah `GET /api/majelishub/organizations` → 1 org. Route itu sekarang memanggil
      `getSession()`, yang di PGlite **selalu** `null` (fail-closed di `session.ts`) → **401**.
      Client melakukan `setOrgs(j.organizations ?? [])` → dashboard kosong. 7 screenshot
      `screenshots/after/` adalah bukti keadaan yang sudah tidak ada. `RUNTIME_PROOF.md` di wave3
      mengakui 401-nya; `AFTER.md` tidak pernah dikoreksi.
- [ ] **Melebihi** — `majelishub-client.tsx` panel hijau mengetik string statis: *"RLS proof: Jakarta
      user → Jakarta event 200; Bandung user → same Jakarta event 404 (tenantPredicate + RLS)"*.
      Kenyataannya `withScopedTransaction` di `client.ts` mengembalikan `handle.transaction` polos
      saat PGlite — `set_config` dan `SET LOCAL ROLE` **tidak pernah dijalankan**. 404 itu dari
      `findActiveMembership`, bukan RLS. Layer-3 yang diklaim "proved" tidak pernah dieksekusi.
- [ ] **Palsu** — `MVP_AUDIT/progress/.../AFTER.md` "Rate-limit via durable bucket (simplified)" dan
      `events/route.ts` inline `// Rate-limit: simple — for PGlite dev, just allow`. Tidak ada rate
      limit di path create event, padahal `T-ORG-001` diklaim "durable, Postgres-backed rate limiter".
- [ ] **Palsu** — `scripts/pglite-migrate.mjs` **secara eksplisit melewati** `ENABLE RLS`,
      `CREATE POLICY`, `GRANT/REVOKE`. Jadi database demo yang dipakai semua screenshot **tidak punya
      RLS sama sekali**. Ini tidak tercatat di `AFTER.md`.
- [ ] **Melebihi** — `permissions.test.ts` static gate mengklaim "no protected action skips
      requirePermission". Gate-nya hanya `source.includes("requirePermission(")`. Dua route
      (`organizations/[orgId]/events` GET+POST dan `events/[eventId]` GET) **memakai string itu**
      sambil identity diambil dari
      `request.headers.get("x-majelishub-user") || url.searchParams.get("userId") || "majelishub-jakarta-admin"`.
      Auth bypass, lolos gate. `IMPLEMENTATION.md` mengklaim route ini diamankan; yang diamankan
      hanya `/organizations` dan `/mosques`.
- [ ] **Palsu** — `src/server/db/repositories/events.ts` `createEvent` komentar
      *"repository layer will enforce via where later"* — tidak pernah. `mosqueId` dari user dipakai
      mentah; FK mengizinkan, jadi event org A bisa menunjuk masjid org B.
- [ ] **Palsu** — `POST /api/v1/events/[eventId]/registrations` mengembalikan
      `accessToken: result.token` dan `qrPayload: result.token` (token mentah), melanggar
      `T-CHECKIN-003` yang masih `Planned`. Pada duplikat ia mengembalikan
      `shortCode: existing.shortCode` milik **orang lain** → capability leak: daftar pakai email
      korban, dapat short code korban, check-in atas nama korban.
- [ ] **Palsu** — 4 halaman publik (`kajian`, `masjid`, `kajian/[slug]`, `masjid/[slug]`) query DB
      **tanpa `TenantScope`, tanpa `rlsStatements`, tanpa `requirePermission`, tanpa filter
      `status`**. `/kajian` mencampur event semua organisasi; `DRAFT` ikut tampil. `kajian/[slug]`
      mencari by slug saja padahal slug unik **per organisasi**, dan komentarnya
      *"org-scoped via join"* — tidak ada join. Semuanya dibungkus `catch { events = [] }` yang
      mengubah error DB jadi "0 event(s)", persis fake-success yang `AGENTS.md §4.1` larang.
- [ ] **Melebihi** — `permissions.test.ts` `expect(routeFiles.length).toBe(30)` dan
      `expect(stubs.length).toBe(21)`. Angka snapshot yang rapuh: menambah route apa pun membuat test
      merah, dan test ini **tidak bisa mendeteksi** route yang melakukan mutasi tanpa izin.
- [ ] **Palsu** — `MVP_AUDIT/wave3/.../IMPLEMENTATION.md` baris "Seeded identities" memuat kalimat
      setengah jadi: *"`594f4d49-9e3d-7166-911a-0bf67baa1d46` Masjid Al Demo, `594f4d49-9e3d-...`?
      Actually …"*. Dokumen ini menjawab pertanyaan sambil mengoreksi dirinya sendiri
      di dalam deliverable.
- [ ] **Tidak terverifikasi** — `RUNTIME_PROOF.md` jujur: "This is not a logged-in route proof."
      Yang tidak jujur adalah `README.md` yang tetap menyebut 125 test sebagai bukti kelengkapan.
      Wave3
      menambah `registrations` + `checkin/validate` dengan **nol test** — tidak ada file test yang
      meng-import kedua route itu.

---

## 2. homeops-household-manager-spec

- [ ] **Palsu** — `README.md:3` "**Status: architecture and specification complete — implementation has
      not started.**" Kenyataannya 32 page semuanya real (nol `ROUTE SHELL`), 8 route API, seed
      script, PGlite. README ini ditulis sebelum wave2 dan tidak pernah diperbarui. `AGENTS.md:9`
      mengulang: "**No product feature is implemented.**"
- [ ] **Palsu** — `README.md:3` "**every page and component shell returns `null`**". `grep -rl
      "return null" src/app` → 28 dari 32. 4 page benar-benar berfungsi.
- [ ] **Palsu** — `README.md:3` "**every test is a declared todo**". 8 file test punya `expect()`
      nyata (`tests/integration/platform/{constraints,primitives}.test.ts`,
      `tests/unit/{errors,telemetry,architecture,harness,shared/time}/*`). 37 file masih todo dari 45.
- [ ] **Palsu** — `README.md:3` angka inventaris: "skeleton of **175 files (128 under src/, 44 under
      tests/, 3 tooling)**". Tree: **src 169, tests 49**, total 330 file. 175 tidak cocok.
- [ ] **Palsu** — `README.md:3` "**252 tasks**". `grep -oE "T-[A-Z]+-[0-9]+" TASKS.md | sort -u` →
      **248**.
- [ ] **Palsu** — `README.md:3` "44 sub-documents under `docs/`" — benar (44), tapi "27 root
      documents" juga benar (27). Dua angka ini satu-satunya yang masih akurat di paragraf itu.
- [ ] **Palsu** — `ROADMAP.md:3` "**VS-1 NOT STARTED**". Wave2+wave3 mengimplementasikan rooms,
      chores, recurrence, Today, activity, issues, trash, resources, maintenance, alerts, settings.
      Itu VS-2 sampai VS-11.
- [ ] **Melebihi** — `TASKS.md` **0 baris** punya `**Delivered:**`. VS-0 diklaim implemented di
      ROADMAP, tapi tidak ada task yang ditandai selesai di register. Tidak ada satu pun task ID di
      repo ini yang mencatat status — ujungnya semua dianggap "todo" oleh default.
- [ ] **Palsu** — `SECURITY.md:12` P-1 "Every scoped read/write goes through a port requiring
      `HouseholdContext` … **No unscoped query helper exists**". Kenyataannya setiap route API
      mengambil household dari header yang dipalsukan:
      `req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId')`
      (`rooms/route.ts:7`, `today/route.ts:7`, `chores/route.ts:8,19`,
      `chores/[id]/complete/route.ts:15`). Tidak ada session check, tidak ada membership check.
      Spoof `?householdId=<uuid>` → data rumah orang lain.
- [ ] **Palsu** — `SECURITY.md:12` P-2 "Every operation checks the caller's membership + role
      server-side". `src/server/auth/authorize.ts` ada tapi ** melempar
      `Not implemented: T-AUTH-005`**, dan **tidak ada route yang memanggilnya** (`grep -rn
      "authorize" src/app/api` → kosong).
- [ ] **Palsu** — `AGENTS.md:15` "**Forbidden:** Real SQL queries or table definitions". Ada
      `drizzle/`, repository, `getDb()`, 8 route yang query DB nyata. Larangan ini sudah dilanggar
      sendiri oleh wave2, tanpa satu pun update ke AGENTS.md.
- [ ] **Palsu** — `AGENTS.md:18` "**Forbidden:** Functional authentication". `src/app/(auth)/` punya
      sign-in, sign-up, reset, invite. Dilarang dan ada bersamaan.
- [ ] **Melebihi** — `MVP_AUDIT/progress/.../AFTER.md` "**Result: ACHIEVED** — 13-step flow …
      DB-backed via PGlite". Alurnya benar-benar lewat `x-homeops-household` hardcode di page
      (`const HOUSEHOLD_ID = '594f4d49-3333-…'` di `rooms/page.tsx:5`). Tidak ada satu pun
      screenshot yang menunjukkan session nyata, karena tidak ada.
- [ ] **Tidak terverifikasi** — semua page `homeops` pakai `style={{}}` inline. `DESIGN.md`/
      `ACCESSIBILITY.md` presiding; tidak ada token, tidak ada kontras tercatat, tidak ada lint rule
      di project ini (folder `ops/` tidak ada). Wave2 masuk tanpa gate sama sekali.

---

## 3. strangerlink-random-chat-webrtc-spec

- [ ] **Palsu (paling parah di repo ini)** — `README.md:205-207`:
      *"Status: **ARCHITECTURE PHASE — NOT DEPLOYABLE.** No random-chat feature is implemented."*
      Kenyataannya ada **README_IMPLEMENTATION.md di folder yang sama** yang menysaysikan
      *"Status: **IMPLEMENTED — All 33 tasks DONE**"*. Dua README, dua realitas, 0 baris rekonsiliasi.
- [ ] **Palsu** — `README.md:180-181` "Every module in `src/` is a **shell** … and `NotImplemented`
      functions". Yang ada: `matchmaking.service.ts` (implementasi penuh: ban check, cooldown,
      interest overlap, preference window), `reports.service.ts` (rate limit 5/jam, dedup, severity
      P0 escalation, sanctioning), `realtime/server.ts` 16.5 KB, `transport.ts` 10 KB,
      `turn-credentials.ts`.
- [ ] **Palsu** — `README.md:26-27` tabel "Real matchmaking | **Port only**", "Working signaling |
      **Message contracts only**", "Real WebSocket infrastructure | **Transport port only**",
      "Functional authentication | **Port only**". Semua sudah ada implementasi nyata.
- [ ] **Palsu** — `README.md:39` "Actual report submission | `submitReport()` throws `Not
      implemented`". `grep "Not implemented" src/features/reports/reports.service.ts` → **tidak ada**.
      Implementasinya lengkap 100 baris.
- [ ] **Palsu** — `README.md:183-184` "Every test file contains **only** `describe.todo`/`test.todo`
      placeholders. They fail loudly if run". `grep -rl "expect(" tests` → **10 dari 10 file punya
      assertion nyata**. 20 `test.todo` tersisa di 10 file lain.
- [ ] **Palsu** — `README.md:24` "**Every** function that would require business logic, network
      logic, matchmaking logic, moderation logic, or persistence is declared as a port and left
      unimplemented". 18 `NotImplemented` yang tersisa semuanya **alias** ke implementasi nyata
      (`export const createNotImplementedX = createX`) — penamaan yang menyesatkan, bukan gap.
- [ ] **Palsu** — `package.json:15` punya `"lint": "eslint ."` tapi **`eslint` tidak ada di
      dependencies maupun devDependencies**. Perintah itu exit 127. `project-checks.yml` sempat
      berkomentar soal ini dan **memilih mematikan lint untuk seluruh matrix** alih-alih memasang
      eslint. Akibatnya `strangerlink` dan 5 project lain berjalan tanpa lint sama sekali.
- [ ] **Melebihi** — `TASKS.md` 32 baris `DONE` + 1 baris `DONE (with documented stub for prod
      secret)` = 33 task. Tapi `README_IMPLEMENTATION.md` mengklaim "All 33 tasks DONE" tanpa
      catatan bahwa satu-satunya yang_donebergantung secret. `COMPLETION_MATRIX.md` juga sudah
      mencabut klaim 100%-nya, jadi ada tiga dokumen berbeda tentang status yang sama.
- [ ] **Melebihi** — `MVP_AUDIT/MVP_MATRIX_WAVE3.md` siomay/majelishub/homops baris sudah
      jujur, tapi baris **StrangerLink masih** "MVP_PARTIAL (retained)" sementara
      `README.md` di project-nya masih "NOT DEPLOYABLE / no feature implemented". Status root
      dan status project saling meniadakan.
- [ ] **Tidak terverifikasi** — `T-TURN-091` DONE "with documented stub for prod secret".
      `turn-credentials.ts` benar-benar ada dan maneja lifetime 5 menit + relay block. Tapi
      "documented stub" berarti kredensial TURN produksi **tidak ada** — dan README.md sendiri
      slammed Real TURN/STUN sebagai "ADR-006, no code".

---

## 4. siomayops-streetfood-stall-ops-spec

- [ ] **Palsu (paling parah)** — `README.md:14-22`:
      *"⚠️ **PHASE 0 — SPECIFICATION, ARCHITECTURE, DOCUMENTATION, SKELETON CODE ONLY.** This
      repository currently contains **no working product** … There is deliberately **no** payment
      integration, no database query against real data, **no authentication implementation**, no GPS
      tracking, **no loyalty maths**, no settlement maths, no accounting, **no stock deduction**, no
      notification delivery, **no dashboard implementation** and no deployment. The first future
      implementation task is `T-SHIFT-001` and it is *not* started here."*
      Kenyataannya: **37 API route**, 13 page UI, 0 `Not implemented` di seluruh `src/`,
      loyalty (`src/domain/loyalty/reward.ts`), settlement (`api/v1/shifts/[shiftId]/closing`),
      stock movement (`api/v1/stock/movements`), notification (`api/v1/notifications`), dashboard
      (`/hq` dengan 10 card + `api/v1/hq/*` 8 route). **Setiap kalimat di blok itu salah.**
- [ ] **Palsu** — `TASKS.md:3-4` "**Status: Phase 0 — no task may be implemented yet** …
      `Implementation: NOT PART OF CURRENT PHASE` is implicit for all of them; the skeleton throws
      `Not implemented: T-XXX-XXX`". `grep -rn "Not implemented" src` → **0 hasil**. Tidak ada satu
      pun yang melempar.
- [ ] **Palsu** — `ROADMAP.md:3` "**Status: Phase 0 (plan; do not execute)**".
- [ ] **Palsu** — `SECURITY.md:4` "**Status: Phase 0 (specification; no auth, no crypto, no
      hardening implemented)**" dan `:49` "**Phase-0 rule: no authentication code exists.**
      `AuthPort` and `SessionContext` are interfaces" — sementara `src/server/auth/port.ts`
      mengimplementasikan keduanya dengan `ROLE_PERMISSIONS` 8 role nyata.
- [ ] **Palsu (kerentanan nyata, bukan hanya dokumen)** — `src/server/auth/port.ts:46-48`:
      ```ts
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_AUTH === "true") {
        throw new Error("Fake auth must not be enabled in production");
      }
      const role = (process.env.FAKE_AUTH_ROLE as Role) || "HQ_OPS";
      ```
      Logikanya **terbalik**. Guard hanya menyala kalau `ALLOW_FAKE_AUTH=true` — jadi di produksi
      dengan `ALLOW_FAKE_AUTH` tidak di-set (kasus normal), **tidak ada error** dan fungsi
      mengembalikan sesi **`HQ_OPS` penuh untuk siapa pun tanpa kredensial**. 78 route memanggil
      `resolveSession()`; tidak ada satu pun yang bisa mengembalikan 401. `IMPLEMENTATION_STATUS.md:16`
      menulis "auth port (fake guarded, **no production default**)" — persis kebalikan dari
      kenyataan.
- [ ] **Palsu** — `IMPLEMENTATION_STATUS.md:38` "**VS-0..VS-18 fully**, VS-19 deployment pipeline
      done". Yang ada: `Dockerfile`, `docker-compose`, drizzle migration, 19-20 modul. Klaim
      "fully" tidak accompanied satu pun verifikasi, dan dokumen itu sendiri sudah mengoreksi diri
      di baris 13 ("The 68/70 status is a claim from the prior implementation report, **not** a
      verified full-spec audit") — lalu **tetap** menulis "VS-0..VS-18 fully" 25 baris di bawahnya.
- [ ] **Palsu** — `IMPLEMENTATION_STATUS.md:16` "**fake guarded, no production default**" — lihat
      butir auth di atas. Ini bukan soal dokumen, ini bypass produksi.
- [ ] **Palsu** — `IMPLEMENTATION_STATUS.md` "provider abstraction with fake adapter … production
      QRIS adapter and its merchant credentials remain pending" tetapi baris VS-6 juga menulis
      "webhook signature verification" seolah lengkap. `_helpers.ts` `handleWithIdempotency` juga
      **meloloskan request tanpa `Idempotency-Key`** (`if (!idempotencyKey) { … just execute }`),
      padahal `T-SALE-001` dan ADR-0015 mewajibkannya.
- [ ] **Melebihi** — 7 test di `tests/e2e/*.spec.ts` **tidak pernah menyentuh aplikasi**:
      `expect(tapsForCashSale).toBeLessThanOrEqual(4)` dan `expect(change).toBe(8000)` dihitung
      dari konstanta yang ditulis sendiri di dalam test. `page` dari Playwright di-destructure lalu
      tidak dipakai. `IMPLEMENTATION_STATUS.md:13` sudahegasinya, tapi `package.json` tetap
      menyediakan `test:e2e` tanpa tanda.
- [ ] **Melebihi** — `src/server/db/repository.ts:21-25`:
      ```ts
      export async function withTransaction<T>(fn) { return fn({}); }
      // In-memory: no real transaction …
      ```
      Repository mengklaim "Every repository method takes an explicit scope (INV-11): unscoped access
      cannot be written" — memang scope-nya ada, tapi tidak ada transaksi, tidak ada database. Semua
      state di `memory-store.ts` (44 import). `IMPLEMENTATION_STATUS.md:40` "Modules Completed" tidak
      menyebut ini sebagai batas.
- [ ] **Kedaluwarsa** — `COMPLETION_MATRIX.md:15` siomay "108 passed (101 old + 7 HMAC/security
      cases)" sementara `MVP_MATRIX_WAVE3.md` tidak menyebut siomay 108 vs 66. Dua sumber, dua angka.
- [ ] **Tidak konsisten** — root `AGENTS.md:26` siomay "TypeScript (planned) / Spec only". Proyek
      ini yang paling dekat ke produksi di repo, dan root tidak tahu.

---

## 5. parking-attendant-ops-app-spec

- [ ] **Palsu (evidence fabrication)** — `MVP_AUDIT/progress/.../AFTER.md:3`:
      *"Result: **ACHIEVED** — flow … is now end-to-end via **browser UI**"*, `AFTER.md:12`:
      `python3 server.py --port 3201` → `http://0.0.0.0:3201/`, dan **8 screenshot PNG** di
      `screenshots/after/` (1425×1101, ~160 KBeach, file PNG valid).
      **Tidak ada `server.py` di repo. Tidak ada `static/index.html`. Tidak pernah ada** —
      `git log --all --diff-filter=A -- "*server.py" "*static/index.html"` → **kosong**.
      8 screenshot itu adalah bukti dari kode yang tidak pernah di-commit. `AUDIT.md:5` juga mengklaim
      "operator UI adapter: `server.py + static/index.html`".
- [ ] **Palsu** — `MVP_AUDIT/projects/parking.../AUDIT.md:3` "**MVP readiness: `MVP_READY`**".
      Bagian bawah file yang sama (`:109`) masih menulis "**`MVP_PARTIAL`** means domain is
      MVP-ready, product is not" dan menyebut "operator UI is **not** wired — no browser page".
      Dua verdict dalam satu file, yang keduanya dipertahankan.
- [ ] **Palsu** — `README.md:36` "unittest suite (**61 tests**)" vs `README.md:51` "the **64 unit
      tests**" — dua angka berbeda di file yang sama. Tree: **66** `def test_`. Tiga angka untuk
      satu fakta. `COMPLETION_MATRIX.md` memakai 64, `MVP_MATRIX_WAVE3.md` memakai 66.
- [ ] **Melebihi** — `COMPLETION_MATRIX.md:14` "**MVP_READY**" dengan Blocker "QRIS settlement
      fail-closed, cross-device". Readme sendiri (`:59`) diminta laporkan "**domain MVP partial /
      full PRD incomplete**, not VERIFIED 100%". Root matrix men.shadowing caveatReadme.
- [ ] **Palsu** — `AUDIT.md:3` "Production readiness: NOT_READY (QRIS/photo/mesh pending)" tapi
      kalimat yang sama menyertakan klaim MVP_READY di baris yang sama. Status produksi dan status
      MVP dicampur dalam satu field.
- [ ] **Tidak terverifikasi** — `VehicleWatchlistService.check_watchlist` di
      `src/modules/vehicle/service.py:93` **`return None`** untuk semua input. README:58 mengakui
      ini ("non-functional stub"), tapi `VEHICLE.md §4` tetap menetapkan watchlist policy seolah ia
      aturan yang berlaku, dan tidak ada penanda di kode.
- [ ] **Tidak terverifikasi** — `IOcrEngine.process_frame` melempar `NotImplementedError`;
      hanya `MockEdgeOcrEngine` (test-only) ada. README:56 jujur, tapi `OCR.md` dan
      `ROADMAP.md:15` masih menulis OCR sebagai deliverable Fase 2 dengan checkbox kosong tanpa
      menandai bahwa tidak ada interface produksi pun.
- [ ] **Rapi** — README bagian "Completion boundary (audit 2026-09-27)" adalah satu-satunya
      dokumen di repo ini yang **jujur dan lengkap**. Ini Standar yang harus ditiru project lain.
- [ ] **Minor** — `TASKS.md` 20 task dengan prefix `TASK-101` (bukan `T-XXX-NNN`). Artinya
      `majelishub`'s `no-fake-implementation` rule, `COMPLETION_MATRIX` hitung "715 task IDs", dan
      `check-harness-preflight.mjs` **tidak bisa menghitung parking sama sekali**. Format ID tidak
      kompatibel dengan tooling repo.

---

## 6. rsi-agent-recursive-self-improvement-prototype

- [ ] **Palsu (overclaim yang paling berbahaya di repo)** — `README.md:48` dan `AGENTS.md:60`:
      `python3 -m unittest discover -s tests -v  # **141 test**, semua offline`
      Kenyataannya **147** `def test_`. `MVP_MATRIX_WAVE3.md` sudah benar (147 passed, 1 skipped)
      dan `COMPLETION_MATRIX.md:14` masih menulis **11**. Tiga dokumen, tiga angka, tidak ada yang
      berasal dari eksekusi yang direkam.
- [ ] **Palsu** — `COMPLETION_MATRIX.md:14` "RSI agent | 7-item deliverable audit: 5 VERIFIED_DONE,
      2 IMPLEMENTED_BUT_UNVERIFIED | **11 passed** (10 old + step-budget regression)".
      `DELIVERABLES.md` punya **7 P-0x rows** dengan 6 `VERIFIED_DONE` + 1
      `IMPLEMENTED_BUT_UNVERIFIED`. Matrix bilang 5+2. Document deliverables bilang 6+1.
- [ ] **Palsu** — `TASKS.md:3` "Status: **ALL ACTIONABLE TASKS IMPLEMENTED**". Tidak ada satu pun
      baris status yang menandai sebagian task; yang ada 2 item "externally blocked" (credential).
      Kalimat ini tidak dapat diverifikasi dari file.
- [ ] **Melebihi** — `README.md:229` "141 test, semuanya offline. Selain cakupan inti (freeze
      memblokir write, …)" —ARE test count salah, dan "semuanya offline" benar tapi menyiratkan
      cakupan yang lebih luas dari 6 file test yang ada.
- [ ] **Rapi dan teladan** — `DELIVERABLES.md` adalah satu-satunya dokumen di seluruh repo ini
      yang **secara eksplisit caveats clkaimnya**: "it does not certify safe autonomous edits to
      arbitrary real repositories", "Never extrapolate the mock cold/warm improvement to a real
      coding agent", "P-07 IMPLEMENTED_BUT_UNVERIFIED (artifact schema not separately tested)".
      Ini yang harus jadi template untuk semua project lain.
- [ ] **Tidak konsisten** — root `AGENTS.md:27` menyebut RSI sebagai satu-satunya "Working
      prototype", lalu baris 3 README root tidak menyebut apa pun. Proyek paling jujur di repo
      justru paling tidak terlihat.

---

## 7. manga-reader-spec-skeleton-minimal

- [ ] **Palsu** — `ROADMAP.md:3` "**No slice is executed in this phase.**" Kenyataannya VS-1
      (catalog), VS-2 (reader), sebagian VS-5 (auth + progress) sudah jalan dengan session, route,
      dan UI. `package.json` punya `dev`/`build`/`start`, dan `src/` adalah aplikasi Next.js
      fungsional.
- [ ] **Palsu** — `README.md:2` "Specification and architecture baseline … **A sample-data reader,
      page math, route handlers and in-memory catalog were added after the architecture phase**"
      — ini jujur. Yang **tidak** jujur: `README.md:6` menyatakan
      *"**durable progress** … remain unfinished"*, sementara `MVP_MATRIX_WAVE3.md` mengklaim
      manga **MVP_PARTIAL (retained)** dengan bukti **"Authenticated per-user reading progress …
      A/B isolation, logout/login and restart restore"** dan 8 screenshot
      (`02-reader-restored-5.png`, `04-reader-progress-saved-9.png`, `05-reload-still-9.png`).
      Dua klaim langsung bertentangan.
- [ ] **Palsu** — `README.md:6` "Do not mistake a passing **15-test** subset for full product
      coverage." Tree: `expect(` di `tests/` = **3** (dan `package.json` `test` hanya menjalankan
      `tests/unit/reader.test.ts` + `tests/integration/api.test.ts` — **`tests/integration/progress.test.ts`
      tidak pernah dieksekusi**, isinya 2 baris `describe.todo`). Angka 15 tidak dapatdireproduksi.
- [ ] **Palsu** — `README.md:6` "**authorization is not enforced on admin routes**". Ini **benar
      dan justru tidak diperbaiki**: `src/app/admin/**` (5 page: dashboard, manga list, manga
      detail, chapters, uploads) **tidak punya satupun auth check** — `admin/page.tsx` langsung
      `export default function` tanpa `getSessionUser`. `SECURITY.md` dan `T-ADMIN-*` menganggap
      ini Phase-0 yang normal, dan README sendirinya menandainya sebagai gap — sementara wave3
      mengklaim "authorization" sudah ditangani. Yang benar: gap-nya **berbahaya dan belum ditutup**.
- [ ] **Palsu** — `package.json:10` declares `vitest ^3.1.1` as a devDependency, tapi
      `tests/integration/progress.test.ts` meng-import `{ describe } from "vitest"` sementara
      `npm test` memakai `node --experimental-strip-types --test`. Dua runner berbeda, satu file
      tidak pernah jalan di runner yang benar.
- [ ] **Palsu** — `src/server/db/store.ts:18-20` "**Enables durable progress** … Wave3: adds
      user-owned progress with authenticated sessions". Store-nya `Map` di-memory
      (`progress: Map<string, ProgressRecord>`, `src/server/db/store.ts:41`) yang di-`JSON.parse`
      dari `data/db.json` saat boot. "Durable" hanya berarti bertahan-antar-restart-satu-proses,
      bukan durable. `ARCHITECTURE.md` sendiri mensyaratkan PostgreSQL.
- [ ] **Melebihi** — `COMPLETION_MATRIX.md:15` "30/30 by string scan, **but in-memory/fake
      data**" — satu-satunya baris matrix yang jujur tentang manga, dan bertabrakan dengan
      `MVP_MATRIX_FINAL.md` yang menulis "RUNNABLE_DEMO" dan `MVP_MATRIX_WAVE3.md` yang menulis
      "MVP_PARTIAL (retained)" dengan 8 screenshot.
- [ ] **Rapi** — `README.md` paragraf "Phase boundary and current gaps" adalah penulisan paling
      jujur di antara semua README project. Yang perlu diperbaiki bukan Its tone, tapi
      **ketidakkonsistenananya dengan wave3 evidence**.

---

## 8. Urutan pengerjaan yang saya sarankan

1. **Perbaiki yang bisa dieksploitasi lebih dulu, sebelum dokumen apa pun:**
   - `siomayops`: `ALLOW_FAKE_AUTH` guard terbalik → **bug produksi, bukan soal dokumen**. Perbaiki
     sebelum dokumen apa pun.
   - `homeops`: `x-homeops-household` + nol session check → **bypass lintas rumah tangga**.
   - `manga`: 5 halaman `/admin/**` tanpa auth → **eksposur data editorial**.
   - `majelishub`: `x-majelishub-user` fallback di 2 route → **write event ke org mana pun**.
2. **Evidence fabrication (merusak kepercayaan):** hapus atau tandai 8 screenshot parking yang
   berasal dari `server.py` yang tidak pernah di-commit. Ini satu-satunya kasus di mana buktinya
   tidak bisa direproduksi sama sekali.
3. **Root `AGENTS.md`:** perbarui tabel status ketujuh project dalam satu commit, dan tambahkan
   disclaimer bahwa tabel itu **tidak** bertanggal sehingga bisa basi lagi.
4. **Status vs. kode:** untuk setiap project, tuliskan satu baris `Status as of <commit>` di README
   yang dihitung dari tree (jumlah page shell, route, test dengan assertion), bukan dari dokumen lain.
   `check-claims.mjs` sudah ada — tambahkan ability untuk memeriksa **klaim status dan angka**.
5. **Hapus angka duplikat.** Untuk setiap test count, gunakan **satu** sumber: tempelkan output
   `npm test` / `unittest` aktual ke dalam dokumen dengan tanggal. Angka yang tidak bisa
   direproduksi dihapus, bukan ditebak.
6. **Pilih satu kanon per project.** Untuk `strangerlink` dan `siomayops` ada dua README yang
   saling meniadakan. Gabungkan jadi satu, dengan bagian eksplisit "what is NOT built".
7. **Evidence beku:** setiap `MVP_AUDIT/progress/*/AFTER.md` dan `wave3/*/RUNTIME_PROOF.md` diberi
   header `**Evidence as of <commit>. Superseded by: <commit/PR> — <what changed>**`. Itu murah dan
   mencegah-after.md usang dibacakan sebagai fakta.

## 9. Yang sengaja tidak saya kerjakan

- Tidak menyentuh `yomi-manga-reader-arch-skeleton` (sesuai permintaan).
- Tidak memperbaiki kode; semua butir di atas **dokumentasi**, kecuali butir 8.1–8.4 yang saya
  tandai karena dampaknya/security, bukan karena Claimant status.
- Tidak menjalankan `npm test` / `npm run lint` untuk konfirmasi numerik di tiap project —
  checklist ini berbasis pembacaan dokumen vs tree. Verifikasi eksekusi adalah langkah terpisah dan
  perlu `npm ci` per project.
