import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FORBIDDEN_FIELDS,
  isForbiddenField,
  log,
  type LogFields,
} from '../../../src/server/telemetry/logger';
import {
  METRIC_NAMES,
  allowedLabelsFor,
  recordMetric,
  resetMetrics,
  snapshotMetrics,
} from '../../../src/server/telemetry/metrics';
import { toOperationResult } from '../../../src/server/errors/map-error';

// Privacy is enforced by types and asserted by tests (PRIVACY.md §5, T-PRIV-002).

/** Capture what the logger writes so an assertion is about bytes, not about intentions. */
function captureOutput() {
  const lines: string[] = [];
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    lines.push(String(chunk));
    return true;
  });
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    lines.push(String(chunk));
    return true;
  });
  return {
    lines,
    restore: () => {
      stdout.mockRestore();
      stderr.mockRestore();
    },
  };
}

describe('redaction', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
    resetMetrics();
  });

  afterEach(() => {
    output.restore();
  });

  it('T-PRIV-002 NFR-PRIV-003: the logger type rejects forbidden fields (name, title, note, email, payload)', () => {
    // Type-level control: `LogFields` has no index signature, so a forbidden key is a compile error.
    // `tsc --noEmit` fails if this expectation ever becomes unnecessary (i.e. if the type widens).
    // @ts-expect-error — `name` is not a loggable field
    const withName: LogFields = { level: 'info', message: 'member updated', name: 'Sari' };
    // @ts-expect-error — `payload` is not a loggable field
    const withPayload: LogFields = { level: 'info', message: 'mutation', payload: { note: 'bin full' } };
    expect(withName.message).toBe('member updated');
    expect(withPayload.message).toBe('mutation');
    expect(['name', 'title', 'note', 'email', 'payload'].every(isForbiddenField)).toBe(true);
  });

  it('T-PRIV-002 NFR-PRIV-003: a runtime attempt to pass a forbidden field is dropped and counted, never logged', () => {
    for (const field of FORBIDDEN_FIELDS) {
      output.lines.length = 0;
      const secret = `SECRET-${field}-VALUE`;
      // A cast is exactly the defeat-the-type case the runtime allow-list exists for.
      log({ level: 'info', message: 'operation finished', [field]: secret } as unknown as LogFields);
      const line = output.lines.join('');
      expect(line, `${field}: the value reached the log line`).not.toContain(secret);
      const parsed = JSON.parse(line.trim()) as Record<string, unknown>;
      expect(parsed[field], `${field} was not dropped`).toBeUndefined();
      expect(parsed.droppedField, `${field} was dropped silently`).toBe(field);
    }
  });

  it('T-PRIV-002 NFR-PRIV-003: allowed fields survive, and the level filter is honoured', () => {
    log({
      level: 'info',
      message: 'job finished',
      job: 'prune-activity',
      count: 12,
      outcome: 'ok',
      durationMs: 8,
    });
    const parsed = JSON.parse(output.lines.join('').trim()) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: 'info',
      message: 'job finished',
      job: 'prune-activity',
      count: 12,
      outcome: 'ok',
    });
    expect(parsed.droppedField).toBeUndefined();
    expect(typeof parsed.timestamp).toBe('string');

    output.lines.length = 0;
    const previous = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'error';
    log({ level: 'info', message: 'should be filtered' });
    expect(output.lines).toEqual([]);
    process.env.LOG_LEVEL = previous;
  });

  it('T-PRIV-002 NFR-OBS-006: metric labels reject household and member identifiers', () => {
    const identifying = ['householdId', 'memberId', 'userId', 'email', 'roomId', 'choreId', 'alertId', 'ip'];
    for (const name of METRIC_NAMES) {
      for (const label of allowedLabelsFor(name)) {
        // No label key may be an identifier, and no label may invite one (ADR-015: bounded cardinality).
        expect(identifying, `${name} has an identifying label "${label}"`).not.toContain(label);
        expect(label).toMatch(/^[a-z][a-z0-9_]*$/);
      }
      for (const label of identifying) {
        expect(
          () => recordMetric(name, 1, { [label]: 'whatever' }),
          `${name} accepted the label "${label}"`,
        ).toThrow(TypeError);
      }
    }
  });

  it('T-PRIV-002 NFR-OBS-006: an uncatalogued metric name or a non-finite value is refused', () => {
    expect(() => recordMetric('scheduler_job_duration_ms', Number.NaN, { job: 'prune-activity' })).toThrow(
      TypeError,
    );
    expect(() => recordMetric('scheduler_job_duration_ms', Number.POSITIVE_INFINITY)).toThrow(TypeError);
    // @ts-expect-error — the metric catalogue is closed
    expect(() => recordMetric('household_activity_total', 1)).toThrow();
    recordMetric('scheduler_job_duration_ms', 42, { job: 'prune-activity', outcome: 'ok' });
    const snapshot = snapshotMetrics();
    expect(snapshot['scheduler_job_duration_ms{job=prune-activity,outcome=ok}']).toMatchObject({
      count: 1,
      last: 42,
    });
  });

  it('T-PRIV-002 NFR-PRIV-003: error mapping strips payloads and SQL text from INTERNAL responses', () => {
    const leaked = new Error(
      'insert into "household_member" (display_name) values ($1) — duplicate key: "Sari" payload={"note":"bin full"}',
    );
    const result = toOperationResult<null>({ error: leaked, requestId: 'req_redaction' });
    if (result.ok) throw new Error('expected a failure result');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/insert into|display_name|payload=|Sari|bin full/i);
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.details?.reference).toBe('req_redaction');
  });
});
