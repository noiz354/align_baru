import { describe, it } from 'vitest';

// Upload hardening: the file is judged by content, and metadata never survives (SECURITY.md section 9).

describe.todo('upload validation');
//   it.todo('T-ISSUE-006 FR-ISSUE-001: JPEG, PNG, and WebP under 5 MB are accepted');
//   it.todo('T-ISSUE-006 NFR-SEC-008: a text file renamed .jpg and an SVG carrying script are rejected');
//   it.todo('T-ISSUE-006 NFR-SEC-008: EXIF including GPS is absent from the stored bytes');
//   it.todo('T-ISSUE-006 NFR-PRIV-006: serving requires a session and household scope, and sets nosniff plus Content-Disposition');
//   it.todo('T-ISSUE-006 NFR-PRIV-006: soft-deleted attachments stop serving and are purged after 30 days');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
