/**
 * Ban enforcement tests — SKELETON.
 *
 * See:
 * - ADR-012
 * - SAFETY.md §13
 * - RUNBOOK RB-04
 */

import { describe } from 'vitest';

describe('ban enforcement', () => {
  describe.todo('refuses a banned identity at every entry point');
  describe.todo('fails closed when the ban store is unreachable');
  describe.todo('still allows a banned identity to submit a report');
  describe.todo('expires a bounded ban at its expiry time');
});
