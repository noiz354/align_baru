// HomeOps — id generation adapter (T-PLAT-005, ADR-002, AGENTS.md §4 "Randomness/ids").
//
// Domain code never generates ids itself: an injected generator supplies UUIDv7 values so ids stay
// opaque to members (FR-HH-012) but time-ordered for the database (ADR-002). Postgres 18 also has a
// column default of `uuidv7()` as a safety net for rows inserted outside the application.

import { randomFillSync } from 'node:crypto';
import type { Id } from '../../shared/types';

/** RFC 9562 UUIDv7: 48-bit unix-ms timestamp, version/variant bits, 74 bits of randomness. */
export function newId(): Id {
  const bytes = new Uint8Array(16);
  randomFillSync(bytes);
  const ms = Date.now();
  bytes[0] = (ms / 2 ** 40) & 0xff;
  bytes[1] = (ms / 2 ** 32) & 0xff;
  bytes[2] = (ms / 2 ** 24) & 0xff;
  bytes[3] = (ms / 2 ** 16) & 0xff;
  bytes[4] = (ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[7] = bytes[7]! & 0xff;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as Id;
}

/** The port domain services receive. One implementation, injected everywhere (I-XA-005). */
export type IdGenerator = {
  next(): Id;
};

export function createIdGenerator(): IdGenerator {
  return { next: () => newId() };
}

/**
 * Deterministic ids for tests (TESTING.md §4: "ids from a deterministic counter-based generator").
 * Still UUID-shaped, so schema validation and sorting behave like production values.
 */
export function createDeterministicIdGenerator(prefix = 'test'): IdGenerator {
  let counter = 0;
  return {
    next: () => {
      counter += 1;
      const n = counter.toString(16).padStart(12, '0');
      // A valid v7 shape with a monotonic timestamp component: ordering assertions still hold.
      const ts = (0x0190_0000_0000 + counter).toString(16).padStart(12, '0');
      return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${n.slice(0, 3)}-8${prefix.length.toString(16).padStart(3, '0')}-${n.padStart(12, '0')}` as Id;
    },
  };
}
