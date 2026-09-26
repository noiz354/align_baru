import { describe, it } from 'vitest';

// Lifecycle legality and the safety rule that keeps urgent problems visible (I-ISSUE-002).

describe.todo('transitions');
//   it.todo('T-ISSUE-001 FR-ISSUE-003: illegal transitions return ISSUE_INVALID_TRANSITION');
//   it.todo('T-ISSUE-001 FR-ISSUE-004: every accepted transition appends exactly one audit row');
//   it.todo('T-ISSUE-007 FR-ISSUE-003: closing requires the reporter, OWNER, or ADMIN');
//   it.todo('T-ISSUE-008 FR-ISSUE-008: closed issues reject new comments (I-ISSUE-006)');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
