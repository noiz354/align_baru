// HomeOps - domain skeleton (specification phase). Pure functions only.

import type { AlertContent, DetectedCondition, Alert } from './types';

/**
 * Build the five answers every alert must provide (FR-ALERT-004):
 *   1. what happened, 2. why it matters, 3. who should act (and why them),
 *   4. what action is available, 5. when action is expected.
 * Content is generated from the type plus the entity - never from free text written by another
 * module, and never including notes, comments, or photos (PRIVACY.md section 8).
 * Creation must fail validation when any answer is missing, so a malformed alert never reaches a
 * lock screen. Copy rules: DESIGN.md section 17 (T-1..T-7: no blame, no false urgency).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-024 - requirements, ADR, design, and tests are listed there.
 */
export function buildAlertContent(_input: {
  readonly condition: DetectedCondition;
  readonly recipientDisplayName: string;
  readonly householdTimezone: string;
}): AlertContent {
  throw new Error('Not implemented: T-ALERT-024');
}

/**
 * Assert that a content object answers all five questions (used by tests and by the
 * creation path). Returns the missing keys rather than throwing, so the caller can log which alert
 * type is malformed.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-024 - requirements, ADR, design, and tests are listed there.
 */
export function findMissingAnswers(_content: Partial<AlertContent>): readonly string[] {
  throw new Error('Not implemented: T-ALERT-024');
}
