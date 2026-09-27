import { describe } from 'vitest';

// Recipient resolution: assigned -> role -> owner, never a broadcast (I-ALERT-006, ADR-009).

describe.todo('recipient resolution');
//   it.todo('T-ALERT-020 FR-NOTIF-010: the assigned member wins, and the reason is ASSIGNED');
//   it.todo('T-ALERT-020 FR-NOTIF-010: without an assignee, household-level alerts go to OWNER then ADMIN');
//   it.todo('T-ALERT-020 FR-MEM-009: an away member is skipped for ATTENTION but not for URGENT');
//   it.todo('T-ALERT-020 FR-NOTIF-010: a removed member is never selected');
//   it.todo('T-ALERT-020 FR-NOTIF-010: ties break deterministically (earliest joined) so runs are reproducible');
//   it.todo('T-ALERT-020 FR-NOTIF-010: no code path returns more than one recipient');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
