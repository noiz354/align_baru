// HomeOps — environment contract (T-PLAT-021, DEPLOYMENT.md §2, THREAT_MODEL T-12).
//
// Parsed once at boot; a missing required value fails fast with a readable message rather than a
// stack trace later. This module is the only place `process.env` is read: no secret ever appears in
// a log line, an error surface, or a client bundle (SECURITY.md §10).

import { z } from 'zod';

/**
 * Environment contract (DEPLOYMENT.md §2). Parsed once at boot; a missing required
 * value fails fast with a readable message rather than a stack trace later.
 * Secrets never appear in logs or error surfaces (SECURITY.md §10). Implemented in T-PLAT-021.
 */
export type Env = {
  readonly DATABASE_URL: string;
  readonly APP_URL: string;
  readonly SESSION_SECRET: string;
  readonly CRON_SECRET: string;
  readonly VAPID_PUBLIC_KEY?: string;
  readonly VAPID_PRIVATE_KEY?: string;
  readonly VAPID_SUBJECT?: string;
  readonly OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  readonly LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  readonly EMAIL_PROVIDER_URL?: string;
  readonly EMAIL_FROM?: string;
  readonly ATTACHMENT_STORAGE_DRIVER?: 'local' | 's3';
  readonly ATTACHMENT_STORAGE_ROOT?: string;
};

const optionalNonEmpty = z.string().trim().min(1).optional();

const envSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .trim()
      .min(1, 'DATABASE_URL is required')
      .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
        message: 'DATABASE_URL must be a postgres:// connection string',
      }),
    APP_URL: z.string().trim().url('APP_URL must be an absolute URL'),
    // No default secret is ever substituted: a placeholder that boots is a breach waiting to happen.
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
    VAPID_PUBLIC_KEY: optionalNonEmpty,
    VAPID_PRIVATE_KEY: optionalNonEmpty,
    VAPID_SUBJECT: optionalNonEmpty,
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalNonEmpty,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    EMAIL_PROVIDER_URL: optionalNonEmpty,
    EMAIL_FROM: optionalNonEmpty,
    ATTACHMENT_STORAGE_DRIVER: z.enum(['local', 's3']).optional(),
    ATTACHMENT_STORAGE_ROOT: optionalNonEmpty,
  })
  .superRefine((value, ctx) => {
    // Web push is all-or-nothing: a public key without a private key would fail at send time.
    const vapid = [value.VAPID_PUBLIC_KEY, value.VAPID_PRIVATE_KEY];
    const provided = vapid.filter((v) => v !== undefined).length;
    if (provided > 0 && provided < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together (ADR-009)',
      });
    }
    if (value.ATTACHMENT_STORAGE_DRIVER === 'local' && !value.ATTACHMENT_STORAGE_ROOT) {
      ctx.addIssue({
        code: 'custom',
        message: 'ATTACHMENT_STORAGE_ROOT is required when ATTACHMENT_STORAGE_DRIVER=local',
      });
    }
  });

export type EnvParseResult =
  { readonly ok: true; readonly env: Env } | { readonly ok: false; readonly message: string };

/** Parse without throwing — used by tests and by `/api/health` boot diagnostics. */
export function tryParseEnv(source: NodeJS.ProcessEnv): EnvParseResult {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Field names only: never echo a value back, not even partially (SECURITY.md §10).
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    return { ok: false, message: `Invalid environment configuration:\n- ${issues.join('\n- ')}` };
  }
  return { ok: true, env: parsed.data as Env };
}

let cached: Env | null = null;

/**
 * The single accessor. Throws once, at boot, with a readable message listing the offending names.
 * `force` exists for tests that swap `process.env` between cases.
 */
export function parseEnv(
  source: NodeJS.ProcessEnv = process.env,
  options?: { readonly force?: boolean },
): Env {
  if (cached && options?.force !== true) return cached;
  const result = tryParseEnv(source);
  if (!result.ok) throw new Error(result.message);
  cached = result.env;
  return cached;
}

/**
 * True when the app can talk to a database. Used by `/api/health` to report readiness honestly and
 * by integration tests to skip when no scratch database is configured (TESTING.md §2).
 */
export function hasDatabaseUrl(source: NodeJS.ProcessEnv = process.env): boolean {
  const url = source.DATABASE_URL?.trim();
  return typeof url === 'string' && url.length > 0;
}
