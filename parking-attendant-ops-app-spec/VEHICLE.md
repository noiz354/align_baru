# Vehicle Module Specification (VEHICLE.md)
## Identitas, Klasifikasi, Sanitasi Plat, & Watchlist

---

### 1. Klasifikasi Kendaraan Lapangan
Sistem mendukung 4 kategori utama kendaraan:
1. `MOTORCYCLE`: Motor roda dua, skuter, moped, moge (membutuhkan dimensi slot standar 1m x 2m).
2. `CAR`: Mobil penumpang roda empat, SUV, sedan, minibus (dimensi slot 2.5m x 5m).
3. `BICYCLE`: Sepeda manual atau sepeda listrik.
4. `TRUCK_HEAVY`: Truk boks, bus pariwisata, kendaraan komersial besar.

---

### 2. Aturan Sanitasi Plat Nomor (Indonesian License Plate Standard)
Plat nomor kendaraan di Indonesia memiliki format variatif:
- Standar: `[Kode Wilayah: 1-2 Huruf] [Nomor Polisi: 1-4 Angka] [Sub-Wilayah: 1-3 Huruf]`
- Contoh: `B 1234 ABC`, `D 999 Z`, `BK 8812 TAA`, `RI 1`.

#### Normalisasi Input:
1. Konversi ke huruf kapital (*Uppercase*).
2. Penghapusan spasi ganda, tanda hubung (`-`), dan titik (`.`).
3. Format Canonical di database: String seragam tanpa pemisah untuk indeks pencarian cepat (`B1234ABC`), tetapi diformat cantik saat ditampilkan di UI (`B 1234 ABC`).
4. Ekstraksi Komponen Regex:
   ```regex
   ^([A-Z]{1,2})\s*([0-9]{1,4})\s*([A-Z]{0,3})$
   ```

---

### 3. Observasi Fisik & Atribut Kendaraan
- **Warna Utama**: Hitam, Putih, Perak/Abu-abu, Merah, Biru, Hijau, Kuning, Cokelat/Emas, Oranye.
- **Merek / Model Populer (Opsional Cepat)**: Beat, Vario, Scoopy, NMAX, PCX, Avanza, Innova, Brio, Xpander.
- **Arah Kendaraan (Direction / Orientation)**:
  - `NOSE_IN`: Kepala menghadap ke dalam slot.
  - `NOSE_OUT`: Pantat menghadap ke dalam slot (siap keluar). Berguna bagi juru parkir saat mencari mobil yang diparkir mundur.

---

### 4. Kebijakan Watchlist / Blacklist Terbatas
Sistem **tidak melakukan profiling ilegal** atau diskriminasi ras/sosial. Watchlist dibatasi murni untuk alasan operasional & keamanan:
1. **Pernah Terlibat Insiden Kabur Tanpa Bayar (Gate Crashing)**: Plat nomor yang memiliki riwayat sesi belum lunas di shift sebelumnya.
2. **Laporan Kepolisian Resmi (Curranmor)**: Plat yang didaftarkan pihak berwajib sebagai motor/mobil hilang (dengan melampirkan nomor LP kepolisian).
3. **VIP / Bebas Biaya Resmi**: Tamu resmi kantor/toko atau mobil operasional pengelola.
- *Security Rule*: Setiap penambahan atau pemeriksaan plat di watchlist dicatat di audit log untuk menghindari penyalahgunaan wewenang juru parkir.
