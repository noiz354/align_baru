// HomeOps — request correlation (T-PLAT-027, OBSERVABILITY.md §3).
//
// The id is generated in `src/proxy.ts` and forwarded as a request header. A client-supplied id is
// never trusted: it is replaced, not merged, so a member cannot collide or forge correlation.

import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { REQUEST_ID_HEADER, isRequestIdShape, newRequestId } from '../../shared/contracts/request-id';

export { REQUEST_ID_HEADER, newRequestId };

/** The correlation id for the current request, or a fresh one outside a request scope (jobs, scripts). */
export async function getRequestId(): Promise<string> {
  try {
    const store = await headers();
    const fromHeader = store.get(REQUEST_ID_HEADER);
    if (isRequestIdShape(fromHeader)) return fromHeader;
  } catch {
    // Called outside a request scope (scheduler tick, CLI): fall through to a generated id.
  }
  return newRequestId();
}

/**
 * A stable, non-reversible household label for logs and metrics (PRIVACY.md §5): the raw id is never
 * written, but two lines about the same household can still be correlated by an operator.
 */
export function hashHouseholdId(householdId: string): string {
  return createHash('sha256').update(`homeops:household:${householdId}`).digest('hex').slice(0, 12);
}

/** Truncated, hashed network identifier for audit rows — never a full IP (PRIVACY.md §5). */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`homeops:ip:${ip}`).digest('hex').slice(0, 16);
}
