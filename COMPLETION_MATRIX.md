# COMPLETION MATRIX — 8 proyek di monorepo `align_baru`

> Diukur: 2026-09-27 · commit `9f10618` (merge PR #5) · branch kerja `arena/01a0e0ef-align-baru`
> Lingkungan pengukuran: Node **v22.22.3**, Python **3.11.2**, tanpa Postgres, tanpa browser Playwright.
> Semua angka di bawah **hasil jalankan nyata** di sandbox ini, bukan kutipan dari commit message.

---

## 1. Matrix utama

| Proyek | Milestone terakhir tercapai | Tugas selesai /total | **Tugas %** (acuan) | Uji dijalankan (lulus/total) | Uji % | Berkas kode non-shell /total | Kode % | Estimasi gabungan\* |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `strangerlink-random-chat-webrtc-spec` | VS-0…VS-15 selesai | 33 / 33 | **100%** | 85 / 85 | 100% | 52 / 52 | 100% | **100%** |
| `parking-attendant-ops-app-spec` | Epic 1–6 (register MVP) selesai | 20 / 20 | **100%** | 61 / 61 | 100% | 31 / 32 | 97% | **99%** |
| `rsi-agent-recursive-self-improvement-prototype` | prototipe runnable (tanpa register tugas) | n/a | **100%\*\*** | 10 / 10 | 100% | 12 / 12 | 100% | **100%** |
| `siomayops-streetfood-stall-ops-spec` | VS-0…VS-19, 2 tugas terblokir eksternal | 68 / 70 | **97%** | 101 / 101 | 100% | 140 / 140 | 100% | **98%** |
| `manga-reader-spec-skeleton-minimal` | minimal reader + kontrak (subset T-READER) | 7 / 26 | **27%** | 15 / 15 | 100% | 30 / 30 | 100% | **49%** |
| `homeops-household-manager-spec` | VS-0 selesai (VS-1 belum mulai) | 32 / 252 | **13%** | 49 / 64 | 77% | 111 / 159 | 70% | **31%** |
| `yomi-manga-reader-arch-skeleton` | VS-0 selesai (12 tugas, VS-1…VS-11 belum) | 12 / 145 | **8%** | 251 / 283 | 89% | 45 / 104 | 43% | **26%** |
| `majelishub-pengajian-event-platform-spec` | VS-0 exit gate lulus, VS-1 baru mulai | 10 / 169 | **6%** | 125 / 406 | 31% | 51 / 185 | 28% | **13%** |

\* `Estimasi gabungan = 0.70 × Tugas% + 0.15 × Uji% + 0.15 × Kode%` — heuristik, bukan definisi resmi.
Kolom **Tugas %** adalah yang paling bisa dipertanggungjawabkan: register tugas (`TASKS.md`) adalah kontrak kerja tiap proyek.
\*\* RSI tidak punya `TASKS.md`; deliverable-nya adalah prototipe itu sendiri (README: "prototipe kerja"), jadi dihitung 100% terhadap lingkupnya.

### Agregat monorepo

| Metrik | Nilai | Catatan |
|---|---:|---|
| Tugas selesai / total (7 proyek ber-register) | **182 / 715 = 25%** | berbobot jumlah tugas, jadi proyek besar (majelishub 169, homeops 252) menekan angka |
| Rata-rata sederhana `Estimasi gabungan` 8 proyek | **64%** | dua proyek ~100%, empat proyek < 50% → spread sangat lebar |
| Proyek ≥ 90% selesai | **3 dari 8** (strangerlink, parking, rsi) + siomayops 98% | — |
| Proyek tahap spesifikasi/fondasi (< 50%) | **4 dari 8** (manga, homeops, yomi, majelishub) | sesuai AGENTS.md: 6 folder `*-spec` sengaja stub |

---

## 2. Rincian bukti uji (perintah yang dijalankan)

| Proyek | Perintah | Hasil terukur | Tier yang **belum** terverifikasi |
|---|---|---|---|
| strangerlink | `npm ci` + `npx vitest run` | 10 file, **85 lulus, 0 gagal, 0 todo** | e2e Playwright (2 spec, 20 `test.todo`) |
| parking-attendant | `python3 -m unittest discover -s tests` | **61 lulus, 0 gagal** | — |
| rsi | `python3 -m unittest discover -s tests` | **10 lulus, 0 gagal** | — |
| siomayops | `npm install --legacy-peer-deps` + `npx vitest run` | 19 file, **101 lulus** (51 unit + 37 integrasi + 13 browser) | e2e Playwright (7 tes, runner diblokir sandbox — lihat IMPLEMENTATION_STATUS.md) |
| manga-reader | `npm test` | **15 lulus** (reader-core + kontrak API) | `describe.todo` progress (4), e2e Playwright, `next build` |
| homeops | `npm ci` + `npx vitest run` | **49 lulus, 15 skip** (integrasi butuh Postgres) | tier integrasi (Postgres), e2e Playwright (10 spec skeleton), `next build` |
| yomi | `npm ci` + `npx vitest run` | **251 lulus, 32 skip**; 15 file tes terdaftar tapi **0 tes** (fitur produk) | integrasi ber-DB, e2e Playwright, `next build` |
| majelishub | `npm ci` + `npx vitest run` | **125 lulus, 281 todo**; 77 file skip (belum ada implementasi) | integrasi ber-DB, browser, e2e Playwright |

Catatan penting: `npm test`/`vitest run` hanya menjalankan tier yang terpasang. Angka "lulus 100%" pada proyek yang sudah jadi berarti **seluruh tier yang bisa dijalankan lulus**, bukan "seluruh PRD teruji".

---

## 3. Angka kunci per proyek

### `strangerlink-random-chat-webrtc-spec` — 33/33 tugas, 85/85 tes
- Commit `8324124`: VS-0…VS-15, seluruh register berstatus `DONE` di `TASKS.md` (33 baris, 0 `NOT_STARTED`).
- Implementasi nyata: identity uuidv7, queue/matchmaking atomik, chat ephemeral, report/block, ban enforcement fail-closed, signaling Zod, media coordinator, TURN time-limited, rate-limit per identity, moderasi, retensi, a11y.
- Sisa: e2e Playwright 20 `test.todo` (baru kerangka), stub `TURN_STATIC_AUTH_SECRET` produksi (didokumentasikan).

### `parking-attendant-ops-app-spec` — 20/20 tugas register, 61/61 tes
- Register `TASKS.md` hanya memuat 20 tiket (Epic 1–6) dan **semuanya ada di kode** (`src/core`, `src/infra`, `src/modules`), 61 tes stdlib lulus, ada `demo.py`.
- Sisa: 1 `NotImplementedError` = adapter OCR mock (by design), dan **register-nya lebih sempit dari PRD** (UI/offline hardening tidak punya tiket) → 100% di sini berarti "register MVP selesai", bukan "PRD selesai".

### `rsi-agent-recursive-self-improvement-prototype` — prototipe jalan, 10/10 tes
- 14 berkas Python stdlib, tanpa dependensi, `rsi/` (curriculum, actor, verifier, jev, memory, routing) + `demo.py`, 10 tes lulus.
- Tidak ada `TASKS.md`/`ROADMAP.md` → tidak ada register untuk dihitung.

### `siomayops-streetfood-stall-ops-spec` — 68/70 tugas, 101/101 tes
- `IMPLEMENTATION_STATUS.md`: 68 selesai, **2 terblokir eksternal**: (1) adapter QRIS produksi butuh kredensial merchant, (2) binary Playwright gagal diunduh di sandbox (tesnya sendiri sudah nyata).
- 101 tes lulus (unit 51, integrasi 37, browser 13); `next build` dilaporkan hijau di commit `c925346` (tidak diulang di sini).

### `manga-reader-spec-skeleton-minimal` — 7/26 tugas, 15/15 tes
- Commit `5199a50` mengimplementasikan "minimal reader + kontrak": `reader-core.ts`, `ports.ts`, `ReaderView.tsx`, `sample-data.ts`, `server/db/{schema,store}.ts`, 4 route API, 13 halaman, 2 file tes (15 tes lulus).
- **Register-nya basi**: 26 tugas masih bertanda `NOT PART OF CURRENT PHASE` padahal kodenya ada → numerator di sini berasal dari bukti commit (T-FOUND-001, T-CAT-001, T-READER-001/002/031, T-UPLOAD-014/015), jadi angkanya berkisar 6–9 tugas, dipakai 7.

### `homeops-household-manager-spec` — 32/252 tugas, VS-0 selesai
- Commit `ad7af82` (VS-0: T-PLAT-001…T-PLAT-028) + T-TIME-001…004 → 32 dari 252 tugas (status board sendiri masih menulis "0 of 252 started": **basi**).
- 49 tes unit lulus; tier integrasi (15 tes) di-skip karena tidak ada Postgres; CI/deploy **tidak pernah jalan** di monorepo ini (dicatat di `DECISIONS.md` 2026-09-27).
- Sisa 16 slice (VS-1…VS-16) berarti mayoritas produk belum ada: 48/159 berkas src masih stub.

### `yomi-manga-reader-arch-skeleton` — 12/145 tugas, VS-0 selesai
- 5 commit foundation: T-FOUND-001…T-FOUND-012 (toolchain + boundary lint, env bertipe, route shell, UI foundation, DB + migrasi `0000_initial_schema.sql`, `/healthz`, logging, error contract, compose, CI, seed harness).
- 251 tes lulus / 32 skip; **15 file tes terdaftar tanpa satu pun tes** → fitur produk (catalog, reader, auth, library, search, upload) belum diimplementasi; 59/104 berkas src masih shell.
- README masih menyebut "ARCHITECTURE PHASE … no product feature is implemented" — perlu diperbarui untuk mencerminkan VS-0 yang sudah selesai.

### `majelishub-pengajian-event-platform-spec` — 10/169 tugas, VS-0 lulus
- 10 tugas terkirim: T-ORG-001, T-SEC-001/002/004/007, T-OBS-002, T-DOCS-001/003, T-ARCH-002/003 + app shell. VS-0 exit gate lulus (`verify:vs0`: 6 pass / 1 warn / 0 fail).
- 125 tes lulus; **281 todo** dan 134/185 berkas src masih stub → registrasi, check-in QR, audio, transkripsi, konten, feedback belum mulai.
- Proyek paling belakang menurut ukuran register karena register-nya paling besar (169 tugas) dan baru menyelesaikan fondasi keamanan/dokumentasi.

---

## 4. Cara mereproduksi

```bash
# TS/Next (butuh npm; Node di sandbox ini 22.x, proyek minta >=24 — tidak menghalangi tes)
cd strangerlink-random-chat-webrtc-spec && npm ci && npx vitest run
cd siomayops-streetfood-stall-ops-spec && npm install --legacy-peer-deps && npx vitest run
cd manga-reader-spec-skeleton-minimal && npm test
cd homeops-household-manager-spec && npm ci && npx vitest run
cd yomi-manga-reader-arch-skeleton && npm ci && npx vitest run
cd majelishub-pengajian-event-platform-spec && npm ci && npx vitest run

# Python stdlib (tanpa dependensi)
cd parking-attendant-ops-app-spec && python3 -m unittest discover -s tests
cd rsi-agent-recursive-self-improvement-prototype && python3 -m unittest discover -s tests
```

Denominator tugas diambil dari register masing-masing: `parking` 20 (`TASK-1xx…6xx`), `strangerlink` 33, `siomayops` 70, `manga` 26, `homeops` 252 (status board), `majelishub` 169, `yomi` 145.

## 5. Kaveat yang harus dibaca bersama angka ini

1. **Tier integrasi ber-Postgres di-skip** (homeops, yomi, majelishub) → "lulus" tidak sama dengan "terverifikasi"; skip harus dibaca "belum diverifikasi".
2. **Tier e2e Playwright tidak dijalankan** di sandbox ini (binary browser tidak bisa diunduh) untuk semua proyek.
3. **Versi Node berbeda** (22 vs syarat 24 pada homeops/majelishub/yomi) — hasil bisa berbeda sedikit di CI Node 24.
4. **GitHub Actions tidak aktif** untuk folder-folder proyek (workflow ada di dalam folder, bukan di root repo) → tidak ada tier yang pernah jalan otomatis; satu-satunya verifikasi adalah jalankan manual seperti di atas.
5. **Dua register basi**: `manga-reader` (masih "NOT PART OF CURRENT PHASE") dan `homeops` (status board "0 of 252"), serta README `yomi` yang masih menyebut fase arsitektur.
6. **Kolom Kode %** hanya mengukur berkas src yang memuat penanda stub (`Not implemented` / `NotImplementedError` / `TODO(`), bukan kualitas implementasi; berkas kecil non-stub tetap dihitung 100%.
