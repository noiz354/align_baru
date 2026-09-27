// HomeOps — member-facing time and priority formatting (T-TIME-002, DESIGN.md §17).
//
// Copy rules enforced here: T-2 (no blame), T-4 (numbers only when known), T-5 (household-local,
// relative first, absolute on demand). Every string is produced server-side with the household
// timezone; the client never reformats into a different meaning.

import type { AlertPriority, Instant, LocalDate } from '../types';
import { compareLocalDates, daysBetween, parseLocalDate } from './civil-date';
import { localDateOf, zonedPartsOf } from './timezone';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** '2 h ago' / 'in 3 d' — relative first (T-5). Neutral wording: never "you missed" (T-2). */
export function formatRelative(instant: Instant, now: Instant, timezone: string): string {
  const deltaMs = Date.parse(instant) - Date.parse(now);
  const absMs = Math.abs(deltaMs);
  const suffix = deltaMs < 0 ? 'ago' : 'from now';
  const minutes = Math.round(absMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ${suffix}`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} wk ${suffix}`;
  // Beyond a month, relative time stops being useful: fall back to the local date.
  return formatLocalDate(localDateOf(instant, timezone), now, timezone);
}

/** 'today' / 'tomorrow' / 'yesterday' / 'Tue 3 Oct' in household terms (T-5). */
export function formatLocalDate(date: LocalDate, now: Instant, timezone: string): string {
  const today = localDateOf(now, timezone);
  const diff = daysBetween(today, date);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return formatShortDate(date);
}

/** 'Tue 3 Oct' — the absolute form shown on demand or when relative time is not useful. */
export function formatShortDate(date: LocalDate): string {
  const parts = parseLocalDate(date);
  if (!parts) return date;
  const weekday = WEEKDAYS[weekdayIndex(date)] ?? '';
  const month = MONTHS[parts.month - 1] ?? '';
  return `${weekday} ${parts.day} ${month}`.trim();
}

/** '3 Oct 2026' — used in history sections where the year matters. */
export function formatLongDate(date: LocalDate): string {
  const parts = parseLocalDate(date);
  if (!parts) return date;
  const month = MONTHS[parts.month - 1] ?? '';
  return `${parts.day} ${month} ${parts.year}`;
}

/** '14:05' — household-local wall clock, 24 h (no am/pm ambiguity across locales). */
export function formatLocalTime(instant: Instant, timezone: string): string {
  const parts = zonedPartsOf(Date.parse(instant), timezone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/**
 * Priority as a word a person would say out loud (DESIGN.md §13: word + shape + colour, never a
 * bare colour or icon, never a numeric score).
 */
export function formatPriority(priority: AlertPriority): string {
  switch (priority) {
    case 'INFO':
      return 'Info';
    case 'ATTENTION':
      return 'Needs attention';
    case 'IMPORTANT':
      return 'Important';
    case 'URGENT':
      return 'Urgent';
  }
}

/** Neutral overdue copy: states the fact, never the person (T-2, DESIGN.md §17). */
export function formatOverdue(dueDate: LocalDate, now: Instant, timezone: string): string {
  const today = localDateOf(now, timezone);
  if (compareLocalDates(dueDate, today) >= 0) return 'Not due yet';
  const days = daysBetween(dueDate, today);
  if (days === 1) return '1 day overdue';
  return `${days} days overdue`;
}

function weekdayIndex(date: LocalDate): number {
  const parts = parseLocalDate(date);
  if (!parts) return 0;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}
