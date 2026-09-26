// HomeOps — skeleton (specification phase). Contracts only.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

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

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  throw new Error('Not implemented: T-PLAT-021');
}
