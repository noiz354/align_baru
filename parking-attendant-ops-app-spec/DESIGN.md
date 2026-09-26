# UI/UX & Field Interaction Design (DESIGN.md)

---

### 1. Prinsip Desain Lapangan (Field-First Ergonomics)
1. **One-Handed / Thumb-Zone Operation**: Aksi penting (tombol foto, tombol check-in, scan, konfirmasi bayar) diletakkan di 40% area bawah layar.
2. **High Contrast Outdoor UI**: Rasio kontras tinggi (minimal WCAG AAA untuk teks kunci) dengan dukungan Dark Mode pekat dan High-Glare Sunlight Mode agar tetap terbaca di bawah terik matahari.
3. **Large Touch Targets**: Tombol minimal 56x56 dp untuk memudahkan input juru parkir yang memakai sarung tangan atau jari basah/kotor.
4. **Haptic & Audio Feedback**: Getaran tegas dan bunyi *beep* berbeda untuk:
   - Check-in Sukses (nada tinggi ganda)
   - Mismatch / Alert (getar panjang + nada peringatan)
   - Checkout & Lunas (nada tunggal tegas)
5. **Zero-Lag Shutter**: Pengambilan foto tanpa animasi berat, kompresi background asinkron agar tidak memblokir antrean.

---

### 2. Layout & Wireframe Konsep

#### 2.1 Layar Utama Juru Parkir (Attendant Operational Hub)
```
+-------------------------------------------------------+
| Shift: Pagi (Budi) | Area: Ruko Blok A | [Online 🟢]  |
+-------------------------------------------------------+
|  KAPASITAS: 42/50 Terisi (8 Slot Kosong)              |
|  [ Motor: 35/40 ]   [ Mobil: 7/10 ]                   |
+-------------------------------------------------------+
|  [ 🔍 Cari Plat / Slot ]       [ ⚠️ Alert Overstay: 2 ]|
+-------------------------------------------------------+
|                                                       |
|   +-----------------------------------------------+   |
|   |                                               |   |
|   |         PETA / DAFTAR GRID SLOT               |   |
|   |   [A-01: B 1234 ABC]  [A-02: KOSONG]          |   |
|   |   [A-03: D 5678 XYZ]  [A-04: BLOCKED]         |   |
|   |   [A-05: KOSONG    ]  [A-06: B 9999 DEF]      |   |
|   |                                               |   |
|   +-----------------------------------------------+   |
|                                                       |
+-------------------------------------------------------+
|           TOMBOL AKSI UTAMA (THUMB ZONE)              |
|   [ 📷 CHECK-IN MASUK ]       [ 🏁 CHECK-OUT KELUAR ] |
+-------------------------------------------------------+
|  [Pindah Slot]    [Lapor Insiden]    [Tutup Shift]    |
+-------------------------------------------------------+
```

#### 2.2 Layar Quick Check-in (Mode Masuk Cepat)
```
+-------------------------------------------------------+
| < Batal                CHECK-IN               Lanjut >|
+-------------------------------------------------------+
| [ Viewfinder Kamera: Arahkan ke Plat / Kendaraan ]   |
|  [ OCR Plat Otomatis / Tap untuk Ketik Manual ]      |
+-------------------------------------------------------+
| Plat Nomor : [ B 4821 SSG                           ] |
| Tipe       : (•) Motor   ( ) Mobil   ( ) Truk/Lain    |
| Warna      : [ Hitam   ▼ ]                             |
| Slot Pilihan: [ A-02 (Rekomendasi Terdekat)        ▼ ] |
+-------------------------------------------------------+
| Foto Kondisi & Observasi Barang:                      |
| [ + Depan ]  [ + Belakang ]  [ + Barang Tertinggal ]  |
| * Tags Cepat: [Helm di Spion] [Paket di Jok] [Baret]  |
+-------------------------------------------------------+
| [ SIMPAN & CETAK TIKET QR (Enter / Tap Jempol) ]      |
+-------------------------------------------------------+
```

#### 2.3 Layar Checkout & Mismatch Alert
```
+-------------------------------------------------------+
| < Kembali              CHECK-OUT             Bantuan >|
+-------------------------------------------------------+
| Scan QR Tiket / Input Plat: [ B 4821 SSG           ]  |
+-------------------------------------------------------+
| ⚠️ PERINGATAN KECOCOKAN (MISMATCH DETECTED)!           |
| Foto Awal: Honda Beat Hitam (Helm Merah di Spion)    |
| Keluar   : Honda Vario Putih                          |
| [ Tombol: Laporkan Mismatch ]  [ Verifikasi Manual ]  |
+-------------------------------------------------------+
| Rincian Tarif:                                        |
| Masuk  : 09:15 WIB (Timestamp Sistem)                |
| Keluar : 11:45 WIB                                    |
| Durasi : 2 Jam 30 Menit (Dibulatkan 3 Jam)            |
| Total  : Rp 6.000                                     |
+-------------------------------------------------------+
| Metode Bayar: [ [💵 TUNAI] ]     [ [📱 QRIS] ]        |
| Uang Diterima: [ 10.000 ] -> Kembalian: [ 4.000 ]     |
+-------------------------------------------------------+
| [ SELESAIKAN CHECKOUT & BUKA SLOT ]                  |
+-------------------------------------------------------+
```

---

### 3. Komponen Desain & Status Warna
- **Slot Status**:
  - `EMPTY`: Hijau Emerald (`#10B981`)
  - `OCCUPIED`: Biru Slate (`#3B82F6`)
  - `RESERVED`: Kuning Amber (`#F59E0B`)
  - `BLOCKED`: Merah Coral (`#EF4444`)
- **Badge Durasi / Overstay**:
  - Normal (< 4 jam): Abu-abu netral
  - Perhatian (4 - 12 jam): Kuning Amber
  - Overstay (> 12 jam / menginap): Merah berkedip lembut dengan ikon jam pasir.

---

### 4. Pedoman Micro-Copywriting & Observasi Barang
Untuk mencegah salah paham hukum mengenai penitipan barang:
- *DO*: Tulis label sebagai **"Observasi Visual Barang Tertinggal"**.
- *DON'T*: Jangan gunakan kata "Barang Titipan Konsumen" atau "Jaminan Keamanan Barang".
- Catatan sistem default: *"Pencatatan barang/kondisi adalah dokumentasi visual awal juru parkir pada saat kendaraan masuk, bukan perjanjian penitipan barang terpisah."*
