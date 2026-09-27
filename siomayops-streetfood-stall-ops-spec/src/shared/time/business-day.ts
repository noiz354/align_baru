/**
 * Business day is server-derived in Asia/Jakarta with configurable cut hour (default 04:00).
 * Jakarta is UTC+7, no DST. So we convert UTC instant to Jakarta local time, then apply cut.
 */

export type BusinessDay = string; // YYYY-MM-DD
export type TimezoneId = "Asia/Jakarta";

export interface BusinessDayConfig {
  readonly timezone: TimezoneId;
  readonly cutHour: number; // 0..23
}

export const DEFAULT_BUSINESS_DAY_CONFIG: BusinessDayConfig = {
  timezone: "Asia/Jakarta",
  cutHour: 4,
};

function jakartaLocalDateParts(instant: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  // Jakarta UTC+7
  const utcMs = instant.getTime();
  const jakartaMs = utcMs + 7 * 60 * 60 * 1000;
  const d = new Date(jakartaMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function toBusinessDayFromJakartaParts(parts: { year: number; month: number; day: number; hour: number }, cutHour: number): BusinessDay {
  let y = parts.year;
  let m = parts.month;
  let d = parts.day;
  if (parts.hour < cutHour) {
    // previous business day
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    y = date.getUTCFullYear();
    m = date.getUTCMonth() + 1;
    d = date.getUTCDate();
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function toBusinessDay(instant: Date, config: BusinessDayConfig): BusinessDay {
  const parts = jakartaLocalDateParts(instant);
  return toBusinessDayFromJakartaParts(parts, config.cutHour);
}

export function businessDayRange(day: BusinessDay, config: BusinessDayConfig): { start: Date; end: Date } {
  // Parse day YYYY-MM-DD as Jakarta date starting at cutHour
  const [yStr, mStr, dStr] = day.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  // Start: day at cutHour in Jakarta -> convert to UTC
  // Jakarta local cutHour on that day => UTC = Jakarta -7h
  const jakartaStartLocal = new Date(Date.UTC(y, m - 1, d, config.cutHour, 0, 0, 0));
  const utcStart = new Date(jakartaStartLocal.getTime() - 7 * 60 * 60 * 1000);
  // End: next day at cutHour in Jakarta
  const jakartaNext = new Date(Date.UTC(y, m - 1, d + 1, config.cutHour, 0, 0, 0));
  const utcEnd = new Date(jakartaNext.getTime() - 7 * 60 * 60 * 1000);
  return { start: utcStart, end: utcEnd };
}
