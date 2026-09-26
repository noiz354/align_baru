import { describe, it } from 'vitest';

// Threshold defaults and the crossing rule that prevents supply-list nagging (I-RES-005).

describe.todo('defaults');
//   it.todo('T-RES-003 FR-RES-005: EXACT defaults to max(25% of target, 3) and criticalAt = 1');
//   it.todo('T-RES-003 FR-RES-005: APPROXIMATE and binary modes derive no numeric thresholds');
//   it.todo('T-RES-003 FR-RES-005: a target below 4 still yields a sane, non-zero threshold');

describe.todo('classification and crossings');
//   it.todo('T-RES-005 FR-RES-007: binary UNAVAILABLE always classifies as CRITICAL');
//   it.todo('T-RES-005 FR-RES-007: ten consecutive level updates in one day emit at most one crossing event');
//   it.todo('T-RES-005 FR-RES-007: descending then ascending within the same day emits one event per direction');
//   it.todo('T-RES-005 FR-RES-007: restocking to target emits LEFT_CRITICAL and LEFT_LOW in order');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
