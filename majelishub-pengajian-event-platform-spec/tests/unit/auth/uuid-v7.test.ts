/**
 * UNIT TEST - auth/uuid-v7.test.ts
 * Layer: unit (no I/O) · Owning task: T-ORG-001 · Requirement(s): NFR-OPS-001
 * Specification: DATA_MODEL.md §Global conventions — primary keys are UUIDv7, stored as `uuid`.
 *
 * Why these behaviours: the id generator is the one piece of the schema that every future table
 * depends on, and a wrong version nibble or a broken timestamp prefix would only surface later as
 * mysteriously unordered rows.
 */
import { describe, expect, test } from "vitest";

import { uuidV7 } from "@/server/crypto/uuid";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidV7 (T-ORG-001)", () => {
  test("produces a well-formed UUIDv7: version nibble 7, variant 10xx", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(uuidV7()).toMatch(UUID_V7);
    }
  });

  test("encodes the millisecond timestamp in the leading 48 bits", () => {
    const instant = Date.UTC(2026, 8, 27, 2, 0, 0);
    const id = uuidV7(instant);

    const hex = id.replaceAll("-", "");
    const encoded = Number.parseInt(hex.slice(0, 12), 16);

    expect(encoded).toBe(instant);
  });

  test("never repeats an id within the same millisecond", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uuidV7(1_800_000_000_000)));

    expect(ids.size).toBe(500);
  });

  test("sorts lexicographically in the order the ids were minted", () => {
    const earlier = uuidV7(1_800_000_000_000);
    const later = uuidV7(1_800_000_060_000);

    expect(earlier < later).toBe(true);
  });
});
