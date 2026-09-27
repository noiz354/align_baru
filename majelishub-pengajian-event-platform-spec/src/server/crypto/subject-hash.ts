/**
 * Keyed hashing of a rate-limit or abuse-detection subject.
 *
 * Where this belongs: server/crypto, next to `contact-hash.ts`.
 *
 * Why: rate limiting needs to count "the same caller" without storing who the caller is. A plain
 * SHA-256 of an email is reversible by anyone with a copy of the email list (the search space is
 * small), so the digest is keyed with a deployment secret — the same argument that makes
 * `contact-hash.ts` keyed (T-REG-011, THREAT_MODEL T-07).
 *
 * Invariants:
 *   1. The output is only ever used as a bucket key. It is never an identifier in the domain, never
 *      exposed in an API response, and never used to join records.
 *   2. The `purpose` argument is a domain separator, so the same secret yields unrelated digests for
 *      the contact table and for the rate-limit counters.
 *   3. Comparison is by equality of digests; no timing property is claimed, because the digest is a
 *      lookup key and not a credential that a caller presents.
 *
 * Task ownership: T-ORG-001 (introduced for the durable auth rate limiter).
 */
import { createHmac } from "node:crypto";

import { requiredEnv } from "@/server/bootstrap/env";

/**
 * @param purpose a stable, namespaced label, e.g. `majelishub.rate-limit.v1`
 * @param value the subject to hash (an email, a device id, an IP). Never stored afterwards.
 * @returns a hex digest; stable for the same (secret, purpose, value) triple.
 */
export function hashSubject(purpose: string, value: string): string {
  if (!value) {
    // An empty subject would collapse every such caller into one bucket, which is both a wrong
    // limit and a silent failure. Refuse instead.
    throw new Error("rate-limit subject must not be empty");
  }
  const secret = requiredEnv("BETTER_AUTH_SECRET");
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}
