---
doc_id: yomi.user-guide
title: 'Yomi — panduan pengguna'
language: id
source_language: en
counterpart: ./USER_GUIDE.md
implementation_status: current
document_status: stable
translation_status: synced
last_verified: 2026-09-29
---

# Yomi — panduan pengguna

> **Satu pertanyaan yang dijawab di sini:** Yomi sudah berjalan — apa yang
> sebenarnya bisa dilakukan, dan bagaimana cara memasukkan manga sendiri?
> **Jawaban singkat:** jelajahi katalog, cari judul, baca bab, dan simpan
> rak bacaan yang ingat sampai halaman berapa. Konten masuk lewat skrip
> seed untuk saat ini; alur unggah sudah dirancang, dijabarkan di bawah,
> dan belum bisa dipakai.

## Apa itu Yomi

Yomi adalah aplikasi baca manga dan komik yang di-hosting sendiri: berkas
milikmu, basis data milikmu, server milikmu, tanpa akun di cloud orang lain.
Satu putaran bacanya sederhana — **cari judul, buka bab, balik halaman,
kembali lagi nanti dan lanjut dari halaman yang sama.** Semua bagian panduan
ini melayani putaran itu.

## Menjalankannya

**Saat ini.** Tiga perintah, berurutan. Aplikasi menolak menyala tanpa
variabel environment yang lengkap (disengaja — pembaca yang setengah
dikonfigurasi akan gagal saat dibaca, bukan saat dinyalakan), jadi siapkan
dulu variabelnya; yang penting `DATABASE_URL`, `APP_ORIGIN`,
`SESSION_SECRET`, kelompok `S3_*`, dan `STORAGE_DIR`. Definisi lengkap ada
di `DEPLOYMENT.md` — panduan ini menautkannya, bukan menyalinnya.

```bash
docker compose -f docker/docker-compose.dev.yml up -d   # Postgres + penyimpanan S3-compatible
npm run db:migrate                                        # skema dulu, selalu
npm run seed -- --env dev --manga 10 --load-titles 200   # isi katalog
npm run dev                                               # aplikasinya
```

Seed menulis dua belas judul asli dengan bab dan halamannya, plus dua akun
(`seed-admin@seed.invalid`, `seed-reader@seed.invalid`, kata sandi dari
`SEED_ADMIN_PASSWORD` / `SEED_READER_PASSWORD`).

**Satu jebakan yang menghabiskan waktu:** buka aplikasi di
`http://localhost:PORT`, jangan `http://127.0.0.1:PORT`. Server dev menolak
jabat tangan live-reload dari host IP, dan klien yang tidak pernah
menyelesaikan jabat tangan itu tidak pernah menjadi interaktif — semua
halaman tampil, tidak ada tombol yang berfungsi, dan tidak ada yang memberi
tahu kenapa. Sudah diamati dan diverifikasi; lihat
`docs/journeys/JOURNEYS.md`.

## Sesi pertamamu

**Saat ini.** Tanpa akun. Halaman utama jujur bahwa ia belum dibangun dan
menunjuk ke satu pintu yang terbuka:

1. **Jelajahi katalog** (`/discover`) — 22 judul dengan status dan jumlah
   bab, chip genre (maksimal 5, `Escape` membersihkan), filter status, dan
   pengurutan. Setiap judul adalah tautan.
   ![Katalog](docs/journeys/01-discovery/02-catalog.png)
2. **Saring berdasar genre** — chip menempel dalam keadaan aktif dan daftar
   menyempit.
   ![Filter genre](docs/journeys/01-discovery/03-discovery-filters-by-genre-fantasy.png)
3. **Buka judul** — alias, status, arah baca, kreator, genre, tag, sinopsis,
   “Read Chapter 1” / “Latest”, dan tabel bab.
   ![Detail judul](docs/journeys/01-discovery/04-discovery-opens-a-title.png)
4. **Cari** (`/search`) — bisa dipakai anonim, sesuai kontrak. Kueri tinggal
   di URL, jadi sebuah pencarian adalah tautan yang bisa dibagikan; hasil
   berlabel jenis, pita peringkat, dan kolom yang cocok.
   ![Hasil pencarian](docs/journeys/04-search/02-search-types-resume.png)
5. **Baca** — penghitung halaman, sebelum/berikut, thumbnail, tautan bab
   berikut, dan progres yang bertahan meski dimuat ulang.
   ![Pembaca](docs/journeys/02-reading/02-reading-reader-opens-on-page-1.png)
6. **Tautkan langsung ke halaman** — `/manga/{slug}/chapter/{n}?page={p}`
   membuka tepat di sana dan mengalahkan progres tersimpan; nilai di luar
   rentang dijepit ke ujung, bukan halaman kosong.

Penelusuran lengkap, langkah demi langkah dengan tangkapan layar
masing-masing, ada di `docs/journeys/JOURNEYS.md` (journey J1–J4).

## Rak bacaanmu

**Saat ini.** Masuk (`POST /api/auth/login` untuk saat ini; formulir
masuk berstatus **Planned** sebagai F-004) dan tiga halaman menjadi hidup:

- **Library (rak)** — judul yang disimpan, dengan jumlah belum dibaca,
  posisi terakhir, dan tanggal.
- **History (riwayat)** — apa yang dibaca, dan sampai mana.
- **Bookmarks (markah)** — judul yang ditandai.
- **Lanjutkan** — tombol halaman judul berubah menjadi “Continue Chapter 1
  — page 3”, dihitung dari sesimu. Inilah hasil dari seluruh lintasan kerja:
  ![Lanjutkan membaca](docs/journeys/05-member-shelf/05-member-shelf-continue-reading.png)

Menandai bab sebagai belum dibaca juga sudah nyata (`POST
/api/library/chapters/{id}/read-status`), dan penggabungan progres memakai
aturan penulis-terakhir-menang dengan status “selesai” yang lengket — tidak
bisa terhapus oleh balik halaman berikutnya.

## Mana yang nyata, mana yang belum

| Permukaan                                                | Status                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| Katalog, filter, urutan                                  | **Saat ini**                                                      |
| Pencarian (layanan + UI)                                 | **Saat ini**                                                      |
| Pembaca, tautan langsung, penjepitan, lanjut-otomatis    | **Saat ini**                                                      |
| Rak, riwayat, markah, lanjutkan, tandai-belum-dibaca     | **Saat ini** (butuh sesi masuk)                                   |
| Penyimpanan preferensi + konsumsi lanjut-otomatis        | **Saat ini** (API saja)                                           |
| Halaman utama, formulir masuk, pengaturan, halaman admin | **Planned** — placeholder yang mengakuinya dan menyebut tugasnya  |
| Tampilan gambar                                          | **Saat ini, rusak** — lihat Masalah yang diketahui                |
| Unggah manga                                             | **Planned** — layanan ada, tidak ada yang terjangkau; lihat bawah |

## Memasukkan manga

### Hari ini: seed (**Saat ini**)

Satu-satunya jalur isi yang utuh dari ujung ke ujung adalah skrip seed:

```bash
npm run seed -- --env dev --manga 10 --load-titles 200
```

Ia menulis judul, bab, baris halaman, kosakata, dan kedua akun dalam
sekali jalan yang hanya-menulis, lalu memverifikasi hasil bacanya. Ia
pemuatan fixture, bukan pengunggah: dijalankan ulang tidak menulis yang
baru, dan ia tidak bisa menerima berkas _milikmu_.

### Alur unggah, sebagaimana dirancang (**Planned**)

Berikut ini perilaku yang ditetapkan untuk layanan ingest yang sudah ada di
`src/features/uploads/upload-pipeline.ts`. Ia **belum terjangkau** — tidak
ada route yang memanggilnya, tidak ada halaman yang menggerakkannya — dan
bagian ini ditulis untuk siapa pun yang membangun jarak terakhirnya, agar
rancangannya tercatat sebelum UI-nya ada.

**Kontrak.** Sekali panggil meng-ingest halaman-halaman satu bab:

- Masukan: id bab, gambar halaman **berurutan** (`{ bytes, sourceFormat }`
  per halaman), dan apakah langsung terbit setelah commit.
- Batas: `INGEST_MAX_PAGES = 200` halaman per panggilan (anggaran acuan
  wall-clock di `PERFORMANCE.md` §9).
- Pemanggil harus admin; selain itu mendapat `AUTH_FORBIDDEN` sebelum kerja
  apa pun.

**Mekanisme.** Validasi semua sebelum menyimpan apa pun: semua halaman
dinormalisasi (varian AVIF/WebP/JPEG) sebelum objek pertama mendarat di
penyimpanan, baris di-commit lewat repositori bab, dan kegagalan simpan atau
commit mana pun membersihkan yang sudah tertulis — bab tidak pernah
tertinggal setengah masuk. Satu event audit mencatat ingest. Penerbitan adalah
transisi yang dilakukan repositori admin, bukan flag yang diset pemanggil.

**Batas.** Pipeline memiliki ingest dan bersih-bersihnya sendiri; ia tidak
memiliki autentikasi (pemanggil tiba dalam keadaan sudah terpecahkan),
decoding gambar (`ImageProcessorPort`, masih stub di `T-UPLOAD-004`), atau
kelanjutan multi-bagian (driver `upload_job` multi-bagian lama sengaja
diganti panggilan sinkron ini — F-017).

**Yang harus mendarat dulu, berurutan:**

1. **Penjaga route F-005** — tidak ada permukaan admin boleh ada di route
   mana pun sebelum perlindungan level-halaman ada. Ini urutan keamanan,
   bukan selera.
2. **Route unggah** — `prepare` (`T-UPLOAD-008`), `status`
   (`T-UPLOAD-009`), dan `finalize` (`T-UPLOAD-010`) saat ini melempar
   karena dirancang begitu; merekalah kulit HTTP di atas pipeline.
3. **Formulir admin** (`T-UPLOAD-010`, `T-UPLOAD-013`) — pemilih berkas,
   progres, dan pilihan terbit yang memetakan ke `IngestInput.publish`.
4. **Pemroses gambar** (`T-UPLOAD-004`) — tanpanya tidak ada yang
   dinormalisasi, dan ingest tetap layanan tanpa tangan.

## Saat ada yang belum ada

**Saat ini.** Yomi tidak pernah jatuh ke halaman kosong. Setiap permukaan
yang belum dibangun menampilkan placeholder yang sama jujurnya: route itu
untuk apa, tugas yang memilikinya (misalnya `T-READER-018` untuk
pengaturan), dan jalan kembali ke bacaan. Alamat yang salah
(`/does-not-exist`) mendapat 404 asli dengan perlakuan yang sama.
Tangkapan layar: journey J6 di `docs/journeys/JOURNEYS.md`.

## Masalah yang diketahui

**Saat ini, terverifikasi 2026-09-29.**

- **Tidak ada gambar yang tampil (P0).** API halaman menyerahkan URL
  `/media/{key}` tanpa ekstensi sementara route delivery hanya menerima
  `/media/{key}.avif|webp|jpeg` — ekstensi adalah pemilih varian, diambil
  dari kunci, tidak pernah dinegosiasikan. Setiap gambar pembaca adalah 404
  dengan status error yang dirancang untuk itu. Grammar yang sama menolak
  kunci cover dari seed, sehingga setiap cover katalog bertuliskan “NO
  COVER”. Akar masalahnya adalah kontradiksi spec antara ADR-005 /
  `API_CONTRACT.md` §2.1 dan `src/server/media/page-delivery.ts`; perbaikannya
  milik sisi mana pun yang diputuskan ledger.
- **Host browser dev.** Pakai `localhost`, jangan `127.0.0.1` (lihat
  “Menjalankannya”).

## Peta kode dan operasi

- Journey dengan tangkapan layar: `docs/journeys/JOURNEYS.md`
- Keputusan yang membentuk perilaku ini: `docs/adr/`
- Janji API dan kode error: `API_CONTRACT.md`
- Menjalankan dan deploy: `DEPLOYMENT.md` · Insiden: `RUNBOOK.md`
- Apa yang dibuktikan test suite: `TEST_STRATEGY.md` (788 lolos di gate
  terakhir)

Detail yang dimiliki dokumen-dokumen itu ditautkan, tidak diulang, agar
panduan ini tetap benar saat mereka bergerak.
