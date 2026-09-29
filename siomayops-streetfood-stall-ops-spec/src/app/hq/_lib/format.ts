/**
 * Formatting helpers for the HQ dashboard presentation layer.
 *
 * Jakarta is UTC+7 with no DST (`shared/time/business-day.ts`), so instants are rendered by
 * shifting to UTC+7 and reading UTC parts — the same convention the business-day derivation uses.
 * Money is always formatted by `formatMoneyForOperator` (Intl `id-ID`), never by hand.
 */

import { formatMoneyForOperator, money } from "@/shared/money/money";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function jakartaParts(iso: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const shifted = new Date(instant.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** `07:12` in Asia/Jakarta, or the established empty-state dash for a null/invalid instant. */
export function formatJakartaTime(iso: string | null): string {
  if (!iso) return "—";
  const parts = jakartaParts(iso);
  if (!parts) return "—";
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** `29 September 2026` from a business-day string (`YYYY-MM-DD`). */
export function formatBusinessDay(day: string): string {
  const [yearStr, monthStr, dayStr] = day.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const dayNumber = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(dayNumber)) return day;
  const monthName = MONTHS_ID[month - 1];
  if (!monthName) return day;
  return `${dayNumber} ${monthName} ${year}`;
}

/** `4,5 jam` / `30 menit` — keeps sub-hour ages readable without false precision. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))} menit`;
  return `${hours.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("id-ID");
}

/** `12%` or the established empty-state dash when the ratio cannot be computed. */
export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("id-ID")}%`;
}

export function formatMoney(minor: number): string {
  return formatMoneyForOperator(money(minor, "IDR"));
}

/** `04:00 – 03:59` axis caption for the trend chart window. */
export function formatHourLabel(hourLocal: number): string {
  return `${pad2(hourLocal)}:00`;
}
