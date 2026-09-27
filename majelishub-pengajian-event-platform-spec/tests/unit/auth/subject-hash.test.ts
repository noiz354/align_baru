/**
 * UNIT TEST - auth/subject-hash.test.ts
 * Layer: unit (no I/O) · Owning task: T-ORG-001 · Requirement(s): NFR-PRIV-006, NFR-SEC-004
 * Specification: PRIVACY.md §Minimisation, OBSERVABILITY.md §7, THREAT_MODEL T-07
 *
 * Why these behaviours: the rate-limit counter table is the one place an email could silently end up
 * in the clear. A plain SHA-256 of an email is trivially reversible by anyone holding a mailing list,
 * so the digest has to be keyed — and it has to change when the key changes.
 */
import { afterEach, describe, expect, test } from "vitest";

import { hashSubject } from "@/server/crypto/subject-hash";

const SECRET = "test-only-value-never-a-deployment-secret";
const SUBJECT = "panitia@masjid-alfalah.example";
const PURPOSE = "majelishub.rate-limit.v1";

afterEach(() => {
  process.env.BETTER_AUTH_SECRET = SECRET;
});

describe("hashSubject (T-ORG-001)", () => {
  test("is deterministic for the same key, purpose and subject", () => {
    expect(hashSubject(PURPOSE, SUBJECT)).toBe(hashSubject(PURPOSE, SUBJECT));
  });

  test("never contains the subject", () => {
    const digest = hashSubject(PURPOSE, SUBJECT);

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain("panitia");
    expect(digest).not.toContain("masjid-alfalah");
  });

  test("changes when the deployment secret changes, so a leaked digest cannot be replayed", () => {
    const withFirstSecret = hashSubject(PURPOSE, SUBJECT);

    process.env.BETTER_AUTH_SECRET = `${SECRET}-rotated`;
    const withRotatedSecret = hashSubject(PURPOSE, SUBJECT);

    expect(withRotatedSecret).not.toBe(withFirstSecret);
  });

  test("separates purposes, so the same subject hashes differently for another use", () => {
    expect(hashSubject(PURPOSE, SUBJECT)).not.toBe(hashSubject("majelishub.contact.v1", SUBJECT));
  });

  test("distinguishes near-identical subjects", () => {
    expect(hashSubject(PURPOSE, SUBJECT)).not.toBe(hashSubject(PURPOSE, `${SUBJECT}.`));
  });

  test("refuses an empty subject instead of collapsing every such caller into one bucket", () => {
    expect(() => hashSubject(PURPOSE, "")).toThrow(/must not be empty/);
  });

  test("refuses to run without the deployment secret", () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => hashSubject(PURPOSE, SUBJECT)).toThrow(/BETTER_AUTH_SECRET/);
  });
});
