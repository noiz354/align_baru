/** Presentation helpers for the operations map (Asia/Jakarta, Bahasa Indonesia). */

const TZ = "Asia/Jakarta";

/** "09:47" in WIB regardless of the browser's zone. */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh === "24" ? "00" : hh}:${mm}`;
}

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;

/** "29 Sep 2026" for a business-day string (YYYY-MM-DD). */
export function fmtBusinessDay(day: string): string {
  const [y, m, d] = day.split("-").map((v) => Number(v));
  if (!y || !m || !d) return day;
  return `${d} ${MONTHS_ID[m - 1] ?? ""} ${y}`;
}

/** Relative age against the snapshot moment: "18 detik lalu", "36 menit lalu", "2 jam lalu". */
export function fmtRelative(iso: string, asOf: string): string {
  const diffS = Math.max(0, Math.round((new Date(asOf).getTime() - new Date(iso).getTime()) / 1000));
  if (diffS < 60) return `${diffS} detik lalu`;
  const m = Math.floor(diffS / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam ${m % 60 ? `${m % 60} menit ` : ""}lalu`;
}

/** Integer rupiah with dot grouping and the "Rp " prefix used across HQ cards. */
export function fmtRupiah(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const digits = Math.abs(Math.trunc(amountMinor)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}Rp ${grouped}`;
}

export function fmtDistanceM(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`;
}
