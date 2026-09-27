// HomeOps — cross-process single-flight via Postgres advisory locks (T-PLAT-010, ADR-013).
//
// A second datastore (Redis) is not justified at this scale: the simplicity budget in
// ARCHITECTURE.md §3 is the reason. Advisory locks are session-scoped, so the lock is taken on a
// *reserved* connection and released on the same one — otherwise a pooled connection could return
// to the pool still holding the lock and block every later tick.

import { createHash } from 'node:crypto';
import { getSql } from '../db/client';
import { logger } from '../telemetry/logger';

export type AdvisoryLock = {
  readonly acquired: boolean;
  release: () => Promise<void>;
};

const NO_LOCK: AdvisoryLock = { acquired: false, release: async () => {} };

/** Map a readable key to a signed 64-bit integer (pg_try_advisory_lock takes bigint). */
export function advisoryKey(key: string): bigint {
  const digest = createHash('sha256').update(`homeops:${key}`).digest();
  let value = 0n;
  for (let i = 0; i < 8; i += 1) value = (value << 8n) | BigInt(digest[i] ?? 0);
  // Clear the sign bit: Postgres bigint is signed and a negative key is legal but confusing.
  return value & 0x7fff_ffff_ffff_ffffn;
}

/**
 * Try to take the lock without waiting. A tick that finds the lock held exits immediately rather
 * than queueing: overlapping ticks must not stack (ARCHITECTURE.md §11).
 */
export async function tryAdvisoryLock(input: {
  readonly key: string;
  readonly timeoutMs?: number;
}): Promise<AdvisoryLock> {
  const key = advisoryKey(input.key);
  const sql = getSql();
  const reserved = await sql.reserve();
  try {
    const rows = await reserved`select pg_try_advisory_lock(${key.toString()}) as acquired`;
    const acquired = rows[0]?.acquired === true;
    if (!acquired) {
      reserved.release();
      return NO_LOCK;
    }
    let released = false;
    return {
      acquired: true,
      release: async () => {
        if (released) return;
        released = true;
        try {
          await reserved`select pg_advisory_unlock(${key.toString()})`;
        } catch (error) {
          // A dropped connection releases the lock server-side; log the class, never the message.
          logger.warn('advisory unlock failed', { job: input.key, errorClass: errorClassOf(error) });
        } finally {
          reserved.release();
        }
      },
    };
  } catch (error) {
    try {
      reserved.release();
    } catch {
      // The connection is already gone; the server drops its session locks with it.
    }
    logger.error('advisory lock failed', {
      job: input.key,
      outcome: 'failed',
      errorClass: errorClassOf(error),
    });
    return NO_LOCK;
  }
}

/** Transaction-scoped variant: the lock is released when the transaction ends (no reserved connection). */
export async function withAdvisoryXactLock<T>(
  sql: { unsafe: (query: string, params?: unknown[]) => Promise<unknown> },
  key: string,
  fn: () => Promise<T>,
): Promise<{ readonly ran: boolean; readonly result?: T }> {
  const bigintKey = advisoryKey(key).toString();
  const rows = (await sql.unsafe('select pg_try_advisory_xact_lock($1) as acquired', [bigintKey])) as {
    acquired: boolean;
  }[];
  if (rows[0]?.acquired !== true) return { ran: false };
  const result = await fn();
  return { ran: true, result };
}

export function errorClassOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return error instanceof Error ? error.constructor.name : 'UnknownError';
}
