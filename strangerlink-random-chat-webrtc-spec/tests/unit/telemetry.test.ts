/**
 * Telemetry allowlist tests — SKELETON.
 *
 * See:
 * - OBSERVABILITY.md
 * - ADR-015
 * - THREAT_MODEL.md T-21, T-32
 */

import { describe } from 'vitest';

describe('span attribute allowlist', () => {
  describe.todo('the tracing helper rejects disallowed keys');
  describe.todo('the allowlist contains no content key');
  describe.todo('the allowlist contains no address key');
});

describe('log field allowlist', () => {
  describe.todo('the logging helper rejects disallowed keys');
  describe.todo('never logs a message body, note, IP, credential, or token');
});

describe('metric labels', () => {
  describe.todo('metric labels are enumerations only');
  describe.todo('identifiers never appear as metric labels');
});
