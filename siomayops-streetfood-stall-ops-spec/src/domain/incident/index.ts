export const INCIDENT_CATEGORIES = [
  { code: "UNOFFICIAL_PAYMENT_REPORTED", label: "Permintaan atau pembayaran tidak resmi dilaporkan", help: "Catatan operator; bukan penetapan legalitas atau kesalahan siapa pun." },
  { code: "SECURITY_CONCERN_REPORTED", label: "Kekhawatiran keamanan dilaporkan", help: "Gunakan uraian netral tentang kejadian yang Anda alami atau amati." },
  { code: "FORCED_RELOCATION", label: "Diminta atau dipaksa pindah lokasi", help: "Catat kejadian tanpa menyimpulkan alasan atau pihak yang bersalah." },
  { code: "THEFT", label: "Barang atau uang dilaporkan hilang/diambil", help: "Catatan laporan, bukan kesimpulan tentang pelaku." },
  { code: "HEALTH_SAFETY_ISSUE", label: "Risiko kesehatan atau keselamatan", help: "Jika ada bahaya segera, hubungi bantuan manusia terlebih dahulu." },
  { code: "ACCIDENT", label: "Kecelakaan", help: "Jelaskan waktu dan dampak yang diketahui." },
  { code: "LOCATION_DISPUTE", label: "Perselisihan lokasi", help: "Catat kondisi lokasi secara faktual." },
  { code: "PAYMENT_PROBLEM", label: "Masalah pembayaran", help: "Jangan masukkan nomor akun, PIN, atau kredensial." },
  { code: "CASH_DISCREPANCY", label: "Selisih uang tunai", help: "Catat nilai yang Anda laporkan; laporan bukan hasil pemeriksaan." },
  { code: "CUSTOMER_DISPUTE", label: "Perselisihan dengan pelanggan", help: "Hindari nama atau data identitas pihak lain." },
  { code: "MISSING_STOCK", label: "Stok tidak ditemukan", help: "Jangan menyimpulkan pencurian atau menyebut tersangka." },
  { code: "EQUIPMENT_DAMAGE", label: "Kerusakan peralatan", help: "Catat dampak operasional yang terlihat." },
  { code: "OTHER", label: "Lainnya", help: "Tuliskan ringkasan netral tentang kejadian." },
] as const;

export type IncidentCategoryCode = typeof INCIDENT_CATEGORIES[number]["code"];
export type IncidentSeverityHint = "P1" | "P2" | "P3";
export type IncidentAmountContext = "REQUESTED" | "PAID" | "UNCLEAR";

export const INCIDENT_SEVERITY_HINTS: readonly { code: IncidentSeverityHint; label: string }[] = [
  { code: "P1", label: "P1 — perlu bantuan manusia segera" },
  { code: "P2", label: "P2 — perlu tindak lanjut hari ini" },
  { code: "P3", label: "P3 — dapat ditinjau pada alur normal" },
];

export function validateIncidentOccurredAt(occurredAt: Date, now = new Date()): boolean {
  return Number.isFinite(occurredAt.getTime()) && occurredAt.getTime() <= now.getTime() + 5 * 60 * 1000;
}
