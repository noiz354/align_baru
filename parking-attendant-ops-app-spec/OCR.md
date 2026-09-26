# OCR & Plate Recognition Strategy (OCR.md)
## Pipeline Edge-OCR, Fallback Manual, & Toleransi Lapangan

---

### 1. Karakteristik Plat Nomor di Indonesia
- Berlatar belakang hitam (tulisan putih) untuk kendaraan lama/pribadi tertentu, berlatar belakang putih (tulisan hitam) untuk standar registrasi terbaru sejak 2022, atau plat kuning (angkutan umum) dan merah (dinas).
- Kondisi fisik sering kotor, penyok, tertutup mika buram, atau berhiaskan baut/stiker aksesoris.

---

### 2. Arsitektur Pipeline OCR (On-Device Local Inference)
Sistem dirancang menggunakan pendekatan **On-Device Local LPR (License Plate Recognition)** agar tetap berjalan saat offline:

```
[ Frame Kamera / Foto ]
           │
           ▼
[ Deteksi Region Plat (YOLO-Tiny / MobileNet SSD Edge Model) ]
           │
           ▼
[ Koreksi Perspektif & Filter Binarisasi Kontras ]
           │
           ▼
[ Character Recognition (CRNN / Tesseract-lite / Onnx Model) ]
           │
           ▼
[ Post-Processing Regex Parser (Indonesian Plate Rule) ]
           │
     ┌─────┴─────────────────────────┐
     ▼                               ▼
[ Skor Keyakinan >= 0.85 ]      [ Skor Keyakinan < 0.85 ]
     │                               │
     ▼                               ▼
Auto-fill Input Plat           Tampilkan Saran Plat + Keyboard Terbuka
                               (Juru Parkir Konfirmasi / Edit Manual)
```

---

### 3. Kebijakan Fallback (Human-in-the-Loop)
1. **Tidak Ada Pemblokiran Alur**:
   - Jika OCR gagal membaca dalam waktu > 1.5 detik, sistem **segera mengalihkan fokus ke input text keyboard numerik-alfabet besar**.
   - Juru parkir tidak boleh menunggu lama di depan layar hanya untuk proses AI.
2. **Koreksi Karakter Umum**:
   - Huruf 'O' di tengah angka -> otomatis diubah menjadi angka '0'.
   - Huruf 'I' di tengah angka -> otomatis diubah menjadi angka '1'.
   - Angka '0' atau '1' di blok kode wilayah depan -> dikoreksi ke huruf terdekat jika memungkinkan.
3. **Audit Koreksi**:
   - Jika attendant mengedit teks hasil OCR, sistem mencatat `ocr_raw_text` vs `user_corrected_text` untuk melatih model lokal di masa mendatang.
