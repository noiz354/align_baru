// HomeOps — correlation id contract (T-PLAT-027, OBSERVABILITY.md §3).
//
// Declared in `shared` because both the request-shaping layer (`src/proxy.ts`) and the server
// telemetry adapters need it, and `shared` is the only leaf both may import (MODULE-MAP.md §1).

import { randomBytes } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-homeops-request-id';

/** Opaque and short enough to read aloud during a support call (DESIGN.md §11 E-5/E-7). */
export function newRequestId(): string {
  return randomBytes(9).toString('base64url');
}

/** A client may not smuggle an arbitrary value in: only our own shape is accepted. */
export function isRequestIdShape(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(value);
}
