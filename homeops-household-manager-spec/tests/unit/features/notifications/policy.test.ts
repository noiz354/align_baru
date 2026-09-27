import { describe } from 'vitest';

// The largest unit suite in the app: the policy layer is pure (I-NOTIF-003).

describe.todo('recipients and channels');
//   it.todo('T-NOTIF-002 FR-NOTIF-002: in-app is always available and never suppressed');
//   it.todo('T-NOTIF-002 FR-NOTIF-010: a URGENT alert bypasses quiet hours and is still counted against the cap');
//   it.todo('T-NOTIF-002 FR-NOTIF-005: a disabled channel produces CHANNEL_DISABLED, not silence');

describe.todo('quiet hours');
//   it.todo('T-NOTIF-006 FR-ALERT-012: a window crossing midnight is handled in household-local time');
//   it.todo('T-NOTIF-006 FR-ALERT-012: a suppressed delivery is queued to the next allowed window');
//   it.todo('T-NOTIF-006 FR-ALERT-012: a stale condition drops the queued intent with reason STALE');

describe.todo('caps and digests');
//   it.todo('T-NOTIF-005 FR-ALERT-013: the cap counts delivered intents, not created alerts');
//   it.todo('T-NOTIF-005 FR-ALERT-013: overflow forms exactly one digest per window');
//   it.todo('T-NOTIF-005 FR-ALERT-013: raising the cap mid-day recomputes the remaining allowance');

describe.todo('duplicates');
//   it.todo('T-NOTIF-002 FR-NOTIF-002: intents are unique per (alert, member, channel, window)');
//   it.todo('T-NOTIF-008 NFR-PRIV-008: the default push payload contains no names, notes, or entity titles');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
