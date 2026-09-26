/**
 * Reports tests — SKELETON.
 *
 * See:
 * - docs/safety/REPORTING.md
 * - TESTING.md §1.5
 *
 * These are `describe.todo` placeholders.
 */

import { describe } from 'vitest';

describe('report submission', () => {
  describe.todo('accepts a report against a terminal session');
  describe.todo('rejects an unknown category');
  describe.todo('captures exactly the documented fields');
  describe.todo('does not collect name, email, or phone');
  describe.todo('collapses a duplicate report');
  describe.todo('rate limits report submission');
  describe.todo(
    'returns acknowledgement without moderation reasoning',
  );
  describe.todo('accepts a report from a banned identity');
});

describe('report routing', () => {
  describe.todo('routes a minor-safety report to the P0 queue');
  describe.todo('assigns P1 to harassment');
  describe.todo('assigns P2 to spam');
});

describe('report credibility', () => {
  describe.todo(
    'down-weights reports from an identity reporting many peers',
  );
  describe.todo('never auto-actions a report into a ban');
});
