/**
 * Authenticated dashboard boundary tests (Step 22 of the dashboard integration brief).
 *
 * These cover the door the Server Component actually goes through:
 *   authentication → authorization → filter validation → scoped read model → failure kinds.
 *
 * They deliberately observe the *result type* (`ok` / `kind`) rather than thrown errors, because
 * "no stack trace reaches the operator" is part of the contract.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadHqDashboard } from "@/server/dashboard/boundary";
import { memoryStore } from "@/server/db/memory-store";
import type { Role, SessionContext } from "@/server/auth/port";

import {
  BUSINESS_DAY,
  FIXTURE_NOW,
  ORG_ID,
  OTHER_ORG_ID,
  STALL_A,
  STALL_B,
  STALL_C_OTHER_ORG,
  seedDashboardFixture,
} from "../ui/_fixtures/hq-dashboard-fixture";

function sessionFor(role: Role): SessionContext {
  return {
    organizationId: ORG_ID,
    userId: "00000000-0000-7000-0000-0000000000d1",
    roles: [role],
    scope: { kind: "org", organizationId: ORG_ID },
    sessionIssuedAt: FIXTURE_NOW,
  };
}

const resolveAs = (session: SessionContext | null) => async () => session;
const now = () => FIXTURE_NOW;

describe("dashboard boundary — authentication and authorization", () => {
  beforeEach(() => {
    seedDashboardFixture();
  });

  it("returns UNAUTHENTICATED (no model, no data) when there is no session", async () => {
    const result = await loadHqDashboard({}, { resolveSession: resolveAs(null), now });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("UNAUTHENTICATED");
      expect(result.requestId).toBeTruthy();
    }
  });

  it("returns FORBIDDEN for a role without hq:view instead of an empty dashboard", async () => {
    const operator: SessionContext = {
      organizationId: ORG_ID,
      userId: "00000000-0000-7000-0000-0000000000d2",
      operatorId: "00000000-0000-7000-0000-0000000000b1",
      roles: ["OPERATOR"],
      scope: { kind: "self", organizationId: ORG_ID, operatorId: "00000000-0000-7000-0000-0000000000b1" },
      sessionIssuedAt: FIXTURE_NOW,
    };
    const result = await loadHqDashboard({}, { resolveSession: resolveAs(operator), now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for scopes the reader cannot resolve, instead of falling back to the organization", async () => {
    const owner = (scope: SessionContext["scope"]): SessionContext => ({
      organizationId: ORG_ID,
      userId: "00000000-0000-7000-0000-0000000000d3",
      roles: ["OWNER"],
      scope,
      sessionIssuedAt: FIXTURE_NOW,
    });

    // `region` has no persisted data, and an area/stall scope without its id is ambiguous.
    // (A scope naming another organization is a different guard: the boundary always queries with
    // `session.organizationId`, and `authorizeHqScope` rejects the mismatch for the `/` dashboard
    // and the route handlers — see tests/integration/hq-dashboard-scope-isolation.test.ts.)
    const unresolvable: SessionContext["scope"][] = [
      { kind: "region", organizationId: ORG_ID, regionId: "region-1" },
      { kind: "area", organizationId: ORG_ID },
      { kind: "stall", organizationId: ORG_ID },
    ];

    for (const scope of unresolvable) {
      const result = await loadHqDashboard({}, { resolveSession: resolveAs(owner(scope)), now });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("FORBIDDEN");
    }
  });

  it("returns UNAVAILABLE when the auth port itself fails, without leaking the reason", async () => {
    const result = await loadHqDashboard(
      {},
      {
        resolveSession: async () => {
          throw new Error("pg://user:secret@db.internal/connection refused");
        },
        now,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("UNAVAILABLE");
      expect(JSON.stringify(result)).not.toContain("secret");
    }
  });

  it("loads the dashboard for an authorized role", async () => {
    const result = await loadHqDashboard({}, { resolveSession: resolveAs(sessionFor("HQ_OPS")), now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.businessDay).toBe(BUSINESS_DAY);
      expect(result.model.kpis.value.salesToday.amountMinor).toBe(35000);
    }
  });

  it("defaults to the server-derived business day when no date is requested", async () => {
    // FIXTURE_NOW is 2026-09-29T06:26Z = 13:26 Jakarta, i.e. inside the 2026-09-29 business day.
    const result = await loadHqDashboard({}, { resolveSession: resolveAs(sessionFor("HQ_OPS")), now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.model.businessDay).toBe("2026-09-29");
  });
});

describe("dashboard boundary — filters reach the server query", () => {
  beforeEach(() => {
    seedDashboardFixture();
  });

  it("passes the selected date into the query and returns that day's persisted figures", async () => {
    const result = await loadHqDashboard(
      { date: "2026-09-01" },
      { resolveSession: resolveAs(sessionFor("OWNER")), now },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.businessDay).toBe("2026-09-01");
      expect(result.model.kpis.value.salesToday.amountMinor).toBe(0);
      expect(result.model.kpis.value.transactionCount).toBe(0);
      expect(result.model.recentActivity.value).toHaveLength(0);
    }
  });

  it("passes the selected authorized outlet into the query and returns only that outlet", async () => {
    const result = await loadHqDashboard(
      { outletId: STALL_A },
      { resolveSession: resolveAs(sessionFor("HQ_OPS")), now },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.scope.outletId).toBe(STALL_A);
      expect(result.model.outlets.value.map((outlet) => outlet.outletId)).toEqual([STALL_A]);
    }
  });

  it("rejects an outlet outside the authorized scope rather than falling back to organization-wide data", async () => {
    const result = await loadHqDashboard(
      { outletId: STALL_C_OTHER_ORG },
      { resolveSession: resolveAs(sessionFor("HQ_OPS")), now },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("INVALID_FILTER");
  });

  it("rejects a malformed or impossible date", async () => {
    for (const date of ["not-a-date", "2026-02-30", "2026-9-1", "20260929"]) {
      const result = await loadHqDashboard({ date }, { resolveSession: resolveAs(sessionFor("HQ_OPS")), now });
      expect(result.ok, `date ${date} should be rejected`).toBe(false);
      if (!result.ok) expect(result.kind).toBe("INVALID_FILTER");
    }
  });

  it("pins a stall-scoped viewer to their own outlet", async () => {
    const stallSession: SessionContext = {
      organizationId: ORG_ID,
      userId: "00000000-0000-7000-0000-0000000000d3",
      roles: ["HQ_OPS"],
      scope: { kind: "stall", organizationId: ORG_ID, stallId: STALL_A },
      sessionIssuedAt: FIXTURE_NOW,
    };
    const own = await loadHqDashboard({ outletId: STALL_A }, { resolveSession: resolveAs(stallSession), now });
    expect(own.ok).toBe(true);

    const other = await loadHqDashboard({ outletId: STALL_B }, { resolveSession: resolveAs(stallSession), now });
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.kind).toBe("INVALID_FILTER");
  });

  it("narrows an area-scoped viewer to their area", async () => {
    const areaSession: SessionContext = {
      organizationId: ORG_ID,
      userId: "00000000-0000-7000-0000-0000000000d4",
      roles: ["AREA_SUPERVISOR"],
      scope: { kind: "area", organizationId: ORG_ID, areaId: "some-other-area" },
      sessionIssuedAt: FIXTURE_NOW,
    };
    const result = await loadHqDashboard({}, { resolveSession: resolveAs(areaSession), now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.scope.areaId).toBe("some-other-area");
      expect(result.model.outlets.value).toHaveLength(0);
    }
  });
});

describe("dashboard boundary — scope isolation and honesty", () => {
  beforeEach(() => {
    seedDashboardFixture();
  });

  it("never returns another organization's rows", async () => {
    const result = await loadHqDashboard({}, { resolveSession: resolveAs(sessionFor("HQ_OPS")), now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.model.outlets.value.map((outlet) => outlet.outletId);
      expect(ids).toContain(STALL_A);
      expect(ids).not.toContain(STALL_C_OTHER_ORG);
      expect(JSON.stringify(result.model)).not.toContain(OTHER_ORG_ID);
    }
  });

  it("reports the unverified digital amount without adding it to verified revenue", async () => {
    const result = await loadHqDashboard({}, { resolveSession: resolveAs(sessionFor("HQ_FINANCE")), now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const { salesToday, grossByMethod } = result.model.kpis.value;
      expect(salesToday.amountMinor).toBe(35000);
      expect(grossByMethod.cash.amountMinor).toBe(35000);
      expect(grossByMethod.digitalVerified.amountMinor).toBe(0);
      expect(grossByMethod.digitalUnverified.amountMinor).toBe(18000);
      expect(salesToday.amountMinor).not.toBe(
        grossByMethod.cash.amountMinor + grossByMethod.digitalVerified.amountMinor + grossByMethod.digitalUnverified.amountMinor,
      );
    }
  });

  it("returns an empty but usable dashboard on a valid day with no activity", async () => {
    const result = await loadHqDashboard(
      { date: "2026-09-01" },
      { resolveSession: resolveAs(sessionFor("HQ_OPS")), now },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const { kpis, outlets, alerts, recentActivity } = result.model;
      expect(kpis.value.salesToday.amountMinor).toBe(0);
      expect(kpis.value.transactionCount).toBe(0);
      expect(kpis.value.averageTransaction).toBeNull();
      expect(kpis.value.expenseRatioPercent).toBeNull();
      expect(kpis.value.expenses.amountMinor).toBe(0);
      // Outlet state is still valid — every authorized outlet reports "not started".
      expect(outlets.value).toHaveLength(2);
      expect(outlets.value.every((outlet) => outlet.status === "NOT_STARTED")).toBe(true);
      expect(alerts.value.every((alert) => alert.type === "OUTLET_NOT_STARTED")).toBe(true);
      expect(recentActivity.value).toHaveLength(0);
    }
  });

  describe("data failure", () => {
    const originalStalls = memoryStore.stalls;

    afterEach(() => {
      Object.defineProperty(memoryStore, "stalls", { value: originalStalls, configurable: true, writable: true });
    });

    function breakPersistence() {
      Object.defineProperty(memoryStore, "stalls", {
        value: {
          values() {
            throw new Error("read ECONNREFUSED 10.0.0.5:5432 — internal detail");
          },
        },
        configurable: true,
        writable: true,
      });
    }

    it("returns UNAVAILABLE (no partial model, no internal detail) when the read fails", async () => {
      breakPersistence();
      const result = await loadHqDashboard({}, { resolveSession: resolveAs(sessionFor("HQ_OPS")), now });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("UNAVAILABLE");
      expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
    });

    it("returns UNAVAILABLE even when a filter forces a read during validation", async () => {
      breakPersistence();
      const result = await loadHqDashboard({ outletId: STALL_A }, { resolveSession: resolveAs(sessionFor("HQ_OPS")), now });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("UNAVAILABLE");
    });
  });
});
