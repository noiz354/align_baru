# Pricing Engine Specification (PRICING.md)
## Skema Tarif, Formula, Grace Period, & Batas Harian

---

### 1. Prinsip Utama: Bukti Waktu vs Waktu Kalkulasi
Sesuai **ADR-002**, kalkulasi tarif dilakukan murni menggunakan selisih waktu sistem terverifikasi (*System Timestamp*), dengan resolusi per detik yang dibulatkan sesuai aturan bisnis:
- **Foto Masuk/Keluar**: Berfungsi sebagai *Evidence / Bukti Fisik*, tidak pernah menjadi acuan perhitungan detik tarif untuk menghindari disparitas metadata EXIF.

---

### 2. Atribut Konfigurasi Skema Tarif
Setiap skema tarif parkir didefinisikan oleh komponen:
- `scheme_type`: `FLAT`, `HOURLY`, `PROGRESSIVE`, `EVENT`, `NIGHT`.
- `grace_period_minutes`: Menit toleransi awal tanpa biaya (contoh: 5 menit bebas biaya untuk *drop-off*).
- `initial_rate`: Biaya untuk jam/periode pertama.
- `subsequent_rate`: Biaya untuk jam-jam berikutnya.
- `rounding_rule`: Pembulatan menit ke atas (`CEIL_HOUR`, misal 65 menit = dihitung 2 jam).
- `daily_max_cap`: Batas nominal maksimum tarif harian (24 jam) untuk mencegah tagihan membengkak tidak masuk akal bagi pengguna wajar.
- `overnight_penalty`: Biaya tambahan jika kendaraan melintasi pukul 00:00 (parkir menginap).
- `lost_ticket_fine`: Denda administrasi kehilangan tiket.

---

### 3. Matriks Tarif Default (Contoh Standar Operasional)

| Tipe Kendaraan | Grace Period | 1 Jam Pertama | Jam Berikutnya | Batas Maks. 24 Jam | Denda Tiket Hilang |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MOTORCYCLE** | 5 Menit | Rp 2.000 | Rp 1.000 / jam | Rp 20.000 | Rp 20.000 |
| **CAR** | 5 Menit | Rp 5.000 | Rp 3.000 / jam | Rp 50.000 | Rp 50.000 |
| **BICYCLE** | 10 Menit | Rp 1.000 | Rp 500 / jam | Rp 5.000 | Rp 10.000 |
| **TRUCK_HEAVY** | 5 Menit | Rp 10.000 | Rp 8.000 / jam | Rp 100.000 | Rp 100.000 |

---

### 4. Algoritma Kalkulasi Tarif Progresif

```python
def calculate_parking_fee(
    entry_time: datetime,
    exit_time: datetime,
    vehicle_type: str,
    rate_config: RateConfig,
    is_lost_ticket: bool = False,
    is_waived: bool = False
) -> PricingBreakdown:
    if is_waived:
        return PricingBreakdown(total=0, reason="OVERRIDE_WAIVED")

    duration_seconds = max(0, (exit_time - entry_time).total_seconds())
    duration_minutes = duration_seconds / 60.0

    # 1. Cek Grace Period
    if duration_minutes <= rate_config.grace_period_minutes and not is_lost_ticket:
        return PricingBreakdown(
            duration_minutes=duration_minutes,
            billable_hours=0,
            base_fee=0,
            lost_ticket_fee=0,
            total_fee=0,
            is_grace_period=True
        )

    # 2. Hitung Jam Terhitung (Pembulatan ke Atas)
    billable_hours = math.ceil(duration_minutes / 60.0)

    # 3. Hitung Tarif Dasar
    if billable_hours <= 1:
        base_fee = rate_config.initial_rate
    else:
        base_fee = rate_config.initial_rate + ((billable_hours - 1) * rate_config.subsequent_rate)

    # 4. Terapkan Cap Batas Maksimal Harian
    days = max(1, math.ceil(billable_hours / 24.0))
    max_allowable_fee = days * rate_config.daily_max_cap
    capped_fee = min(base_fee, max_allowable_fee)

    # 5. Denda Tiket Hilang
    lost_fee = rate_config.lost_ticket_fine if is_lost_ticket else 0

    total_amount = capped_fee + lost_fee

    return PricingBreakdown(
        duration_minutes=duration_minutes,
        billable_hours=billable_hours,
        base_fee=capped_fee,
        lost_ticket_fee=lost_fee,
        total_fee=total_amount,
        is_grace_period=False
    )
```
