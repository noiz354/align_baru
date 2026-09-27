import { describe } from 'vitest';

// The highest-value unit suite in the project (TESTING.md risk map).

describe.todo('calendar rules');
//   it.todo('T-CHORE-021 FR-CHORE-014: DAILY advances one household day');
//   it.todo('T-CHORE-021 FR-CHORE-014: WEEKDAYS skips unselected days and rejects an empty set');
//   it.todo('T-CHORE-021 FR-CHORE-014: EVERY_N_WEEKS snaps to the chosen weekday from the anchor');
//   it.todo('T-CHORE-021 FR-CHORE-014: MONTHLY and EVERY_N_MONTHS clamp per month without drifting');
//   it.todo('T-CHORE-021 FR-CHORE-015: a tick running two days late still yields the correct next date');

describe.todo('completion-anchored rules');
//   it.todo('T-CHORE-022 FR-CHORE-015: next = last completion + N days, not the previous due date');
//   it.todo('T-CHORE-007 FR-CHORE-015: a skip does not advance the series (I-CHORE-005)');
//   it.todo('T-CHORE-005 FR-CHORE-015: a reopen restores the previous anchor');
//   it.todo('T-CHORE-022 FR-CHORE-015: a never-completed chore falls back to its creation anchor');

describe.todo('timezone and DST');
//   it.todo('T-CHORE-023 FR-CHORE-016: spring-forward due times shift to the first valid instant of the same local day');
//   it.todo('T-CHORE-023 FR-CHORE-016: fall-back uses the first occurrence and ignores the repeated hour');
//   it.todo('T-CHORE-023 FR-CHORE-016: southern-hemisphere DST behaves symmetrically');

describe.todo('properties');
//   it.todo('T-CHORE-021 FR-CHORE-014: the sequence is strictly increasing for every rule family');
//   it.todo('T-CHORE-021 FR-CHORE-014: no rule yields a date before its anchor or base date');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
