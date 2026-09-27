// HomeOps — rate-limit contract (T-PLAT-025, SECURITY.md §8, docs/api/CONVENTIONS.md §8).
//
// Declared in `shared` because both the feature layer (which enforces at the operation boundary) and
// the server layer (which stores the buckets) need the type, and `shared` is the only leaf both may
// import (ARCHITECTURE.md §4.1 L-5).

/**
 * The abuse classes. Limits are the union of SECURITY.md §3/§8 and docs/api/CONVENTIONS.md §8; where
 * the two disagreed the tighter value won (DECISIONS.md 2026-09-27, "rate-limit table reconciliation").
 */
export const RATE_LIMIT_CLASSES = {
  AUTH_SIGN_IN_IP: { limit: 10, windowSeconds: 15 * 60 },
  AUTH_SIGN_IN_ACCOUNT: { limit: 5, windowSeconds: 15 * 60 },
  AUTH_SIGN_UP_IP: { limit: 5, windowSeconds: 60 * 60 },
  AUTH_PASSWORD_RESET_IP: { limit: 5, windowSeconds: 60 * 60 },
  INVITE_ACCEPT_IP: { limit: 10, windowSeconds: 60 * 60 },
  INVITE_CREATE_HOUSEHOLD: { limit: 20, windowSeconds: 24 * 60 * 60 },
  MUTATION_MEMBER: { limit: 120, windowSeconds: 60 },
  UPLOAD_MEMBER: { limit: 30, windowSeconds: 60 * 60 },
  TEST_NOTIFICATION_MEMBER: { limit: 3, windowSeconds: 24 * 60 * 60 },
  EXPORT_HOUSEHOLD: { limit: 2, windowSeconds: 24 * 60 * 60 },
  CRON_TRIGGER_PER_JOB: { limit: 6, windowSeconds: 60 * 60 },
} as const;

export type RateLimitClass = keyof typeof RATE_LIMIT_CLASSES;

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Present when `allowed` is false; the copy never discloses the threshold (SECURITY.md §8). */
  readonly retryAfterSeconds?: number;
};

/**
 * Durable window counter. Keys are hashed by the adapter, so an email, IP, or member id is never
 * stored in the bucket table (PRIVACY.md §5).
 */
export type RateLimitStore = {
  /** Consume one unit of the window. Returns the decision *after* the attempted consume. */
  consume(input: {
    readonly cls: RateLimitClass;
    /** Opaque scope: an ip, a member id, a household id, or a job name — hashed before storage. */
    readonly scope: string;
    readonly now: Date;
  }): Promise<RateLimitDecision>;
  /** Read without consuming — used to render "try again in N minutes" honestly. */
  peek(input: {
    readonly cls: RateLimitClass;
    readonly scope: string;
    readonly now: Date;
  }): Promise<RateLimitDecision>;
  /** Delete expired windows (T-PLAT-013 retention job). */
  pruneExpired(now: Date): Promise<number>;
};
