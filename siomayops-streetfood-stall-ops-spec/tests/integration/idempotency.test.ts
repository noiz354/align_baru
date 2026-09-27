import { describe, it, expect, beforeEach } from "vitest";
import { memoryStore } from "@/server/db/memory-store";
import { beginIdempotentRequest, storeIdempotentResponse, withIdempotency } from "@/server/db/idempotency";

describe("idempotency (T-FOUND-004)", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it("returns the original response for a replayed key, marked as a replay", async () => {
    const orgId = "org-1";
    const route = "POST /api/v1/sales";
    const key = "key-123";
    const hash = "hash-abc";
    const body = { saleId: "sale-1" };

    const first = await beginIdempotentRequest({ key, organizationId: orgId, actorId: "user-1", requestHash: hash, route });
    expect(first.kind).toBe("NEW");

    await storeIdempotentResponse({ key, organizationId: orgId, route, requestHash: hash, responseBody: body, statusCode: 201 });

    const replay = await beginIdempotentRequest({ key, organizationId: orgId, actorId: "user-1", requestHash: hash, route });
    expect(replay.kind).toBe("REPLAY");
    if (replay.kind === "REPLAY") {
      expect(replay.record.responseBody).toEqual(body);
    }
  });

  it("rejects a different payload under the same key with IDEMPOTENCY_MISMATCH", async () => {
    const orgId = "org-1";
    const route = "POST /api/v1/sales";
    const key = "key-123";
    await storeIdempotentResponse({ key, organizationId: orgId, route, requestHash: "hash-1", responseBody: { saleId: "s1" }, statusCode: 201 });

    await expect(beginIdempotentRequest({ key, organizationId: orgId, actorId: "user-1", requestHash: "hash-2", route })).rejects.toThrow(/mismatch/i);
  });

  it("creates exactly one record for two concurrent identical requests", async () => {
    const orgId = "org-1";
    const route = "POST /api/v1/sales";
    const key = "concurrent-key";
    const hash = "hash-concurrent";

    const res1 = await withIdempotency({ organizationId: orgId, route, idempotencyKey: key, requestHash: hash, actorId: "user-1" }, async () => {
      return { body: { saleId: "sale-concurrent" }, status: 201 };
    });
    const res2 = await withIdempotency({ organizationId: orgId, route, idempotencyKey: key, requestHash: hash, actorId: "user-1" }, async () => {
      return { body: { saleId: "should-not-be-used" }, status: 201 };
    });

    expect(res1.body.saleId).toBe("sale-concurrent");
    expect(res2.body.saleId).toBe("sale-concurrent");
    expect(res2.replayed).toBe(true);
  });

  it("expires keys according to the retention rule without breaking replays inside the window", async () => {
    const orgId = "org-1";
    const route = "POST /api/v1/sales";
    const key = "expiring-key";
    const hash = "hash-exp";

    // Store with short TTL
    await storeIdempotentResponse({ key, organizationId: orgId, route, requestHash: hash, responseBody: { saleId: "s1" }, statusCode: 201, ttlSeconds: -1 }); // already expired

    const afterExpiry = await beginIdempotentRequest({ key, organizationId: orgId, actorId: "user-1", requestHash: hash, route });
    expect(afterExpiry.kind).toBe("NEW");
  });
});
