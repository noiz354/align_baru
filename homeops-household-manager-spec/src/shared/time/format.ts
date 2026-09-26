// HomeOps — skeleton (specification phase). Contracts only.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

import type { Instant, LocalDate, AlertPriority } from '../types';

/**
 * Member-facing time formatting (DESIGN.md §17, T-2: never blame, never false precision).
 * Server-rendered with the household timezone; the client never reformats into a different meaning.
 * Implemented in T-TIME-002.
 */

/** '2 h ago' — with the absolute value available for the expanded/accessible form. */
export function formatRelative(instant: Instant, now: Instant, timezone: string): string {
  throw new Error('Not implemented: T-TIME-002');
}

/** 'Tue 3 Oct' / 'today' / 'tomorrow' in household terms. */
export function formatLocalDate(date: LocalDate, now: Instant, timezone: string): string {
  throw new Error('Not implemented: T-TIME-002');
}

/** Priority as a word a person would say out loud (never a bare colour or icon). */
export function formatPriority(priority: AlertPriority): string {
  throw new Error('Not implemented: T-TIME-002');
}
