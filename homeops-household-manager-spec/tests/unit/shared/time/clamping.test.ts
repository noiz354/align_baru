import { describe, it } from 'vitest';

// Clamping is shared by chore recurrence and maintenance frequency (I-MNT-005).

describe.todo('month and year clamping');
//   it.todo('T-CHORE-024 FR-CHORE-016: the 31st clamps to 30 in a 30-day month and returns to the 31st afterwards');
//   it.todo('T-CHORE-024 FR-CHORE-016: February clamps to 28 or 29 and never drifts the rule');
//   it.todo('T-CHORE-024 FR-CHORE-016: 29 February annual rules clamp to 28 in non-leap years');
//   it.todo('T-CHORE-024 FR-CHORE-016: EVERY_N_MONTHS keeps its original day as the anchor across clampings');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
