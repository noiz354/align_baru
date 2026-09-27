// HomeOps — structured logger with a typed allow-list (T-OBS-001, ADR-015, PRIVACY.md §5, OBSERVABILITY.md §2).
//
// The type is the control: there is no overload accepting an arbitrary object, so member names,
// titles, notes, payloads, and SQL text cannot be logged by accident. A runtime check backs the type
// because a cast at an I/O boundary would otherwise defeat it (`tests/unit/telemetry/redaction.test.ts`).
//
// Allowed fields: code, operation, outcome, durationMs, job, count, requestId, traceId, errorClass.
// Never: name, title, note, body, email, endpoint, payload (T-09 mitigation).

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = {
  readonly level: LogLevel;
  readonly message: string; // a fixed, code-owned string; never interpolated user content
  readonly code?: string;
  readonly operation?: string;
  readonly outcome?: 'ok' | 'denied' | 'failed';
  readonly durationMs?: number;
  readonly job?: string;
  readonly count?: number;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly errorClass?: string;
  readonly householdIdHash?: string;
};

/** Field names that must never appear in a log line, whatever the caller claims (PRIVACY.md §5). */
export const FORBIDDEN_FIELDS = [
  'name',
  'displayName',
  'title',
  'note',
  'notes',
  'body',
  'email',
  'endpoint',
  'payload',
  'password',
  'token',
  'secret',
  'sql',
  'query',
  'ip',
  'ipAddress',
  'userAgent',
  'description',
  'comment',
  'summary',
  'householdId',
  'memberId',
  'userId',
] as const;

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'level',
  'message',
  'code',
  'operation',
  'outcome',
  'durationMs',
  'job',
  'count',
  'requestId',
  'traceId',
  'errorClass',
  'householdIdHash',
  'timestamp',
]);

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): number {
  const raw = process.env.LOG_LEVEL;
  return LEVEL_ORDER[(raw ?? 'info') as LogLevel] ?? LEVEL_ORDER.info;
}

/** JSON-lines to stdout: the container log driver is the collector (OBSERVABILITY.md §2). */
export function log(fields: LogFields): void {
  if (LEVEL_ORDER[fields.level] < configuredLevel()) return;
  const line: Record<string, unknown> = { timestamp: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!ALLOWED_FIELDS.has(key)) {
      // Drop and say so: a silently dropped field would hide a bug, a logged field would leak PII.
      line.droppedField = key;
      continue;
    }
    line[key] = value;
  }
  const serialized = JSON.stringify(line);
  if (fields.level === 'error') process.stderr.write(`${serialized}\n`);
  else process.stdout.write(`${serialized}\n`);
}

export const logger = {
  debug: (message: string, fields?: Omit<LogFields, 'level' | 'message'>) =>
    log({ level: 'debug', message, ...fields }),
  info: (message: string, fields?: Omit<LogFields, 'level' | 'message'>) =>
    log({ level: 'info', message, ...fields }),
  warn: (message: string, fields?: Omit<LogFields, 'level' | 'message'>) =>
    log({ level: 'warn', message, ...fields }),
  error: (message: string, fields?: Omit<LogFields, 'level' | 'message'>) =>
    log({ level: 'error', message, ...fields }),
};

/** True when a key would be refused by the allow-list — used by the redaction test (T-PRIV-002). */
export function isForbiddenField(key: string): boolean {
  return (FORBIDDEN_FIELDS as readonly string[]).includes(key);
}
