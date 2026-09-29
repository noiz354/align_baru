import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/hq/dashboard/route";
import { dashboardResponseSchema } from "@/shared/contracts/dashboard";

const originalRole = process.env.FAKE_AUTH_ROLE;

afterEach(() => {
  if (originalRole === undefined) delete process.env.FAKE_AUTH_ROLE;
  else process.env.FAKE_AUTH_ROLE = originalRole;
});

describe("dashboard HTTP boundary", () => {
  it("returns the shared read model for an authorized session", async () => {
    process.env.FAKE_AUTH_ROLE = "HQ_OPS";
    const response = await GET(new NextRequest("http://localhost/api/v1/hq/dashboard?date=2026-09-29&status=ALL&limit=6"));
    expect(response.status).toBe(200);
    const parsed = dashboardResponseSchema.safeParse(await response.json());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.scope.businessDay).toBe("2026-09-29");
      expect(parsed.data.meta.requestId.length).toBeGreaterThan(0);
    }
  });

  it("rejects malformed filters before reading the model", async () => {
    process.env.FAKE_AUTH_ROLE = "HQ_OPS";
    const response = await GET(new NextRequest("http://localhost/api/v1/hq/dashboard?date=not-a-day&limit=0"));
    expect(response.status).toBe(400);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("fails closed for an unauthenticated session", async () => {
    process.env.FAKE_AUTH_ROLE = "NOT_A_ROLE";
    const response = await GET(new NextRequest("http://localhost/api/v1/hq/dashboard?date=2026-09-29"));
    expect(response.status).toBe(401);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});
