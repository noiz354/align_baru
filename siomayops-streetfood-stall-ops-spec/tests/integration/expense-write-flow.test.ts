import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NextRequest } from "next/server";
import { memoryStore } from "@/server/db/memory-store";
import { recordExpense } from "@/features/expenses";
import { getDashboardReadModel } from "@/features/hq";
import { POST as postExpenseRoute, GET as getExpensesRoute } from "@/app/api/v1/expenses/route";
import { GET as getExpenseReviewRoute } from "@/app/api/v1/hq/expense-review/route";
import { GET as getDashboardRoute } from "@/app/api/v1/hq/dashboard/route";
import type { SessionContext } from "@/server/auth/port";

const ORG_ID = "00000000-0000-7000-0000-000000000001";
const AREA_ID = "00000000-0000-7000-0000-000000000003";
const STALL_1_ID = "00000000-0000-7000-0000-000000000020"; // ST-001
const STALL_2_ID = "00000000-0000-7000-0000-000000000021"; // ST-002
const EXTERNAL_STALL_ID = "00000000-0000-7000-0000-000000000098"; // ST-EXT-99 (org ...0099)
const OPERATOR_1_ID = "00000000-0000-7000-0000-000000000010"; // Budi

const hqSession: SessionContext = {
  userId: OPERATOR_1_ID,
  operatorId: OPERATOR_1_ID,
  organizationId: ORG_ID,
  roles: ["HQ_OPS"],
  scope: { kind: "org", organizationId: ORG_ID },
  sessionIssuedAt: new Date(),
};

const stall1OperatorSession: SessionContext = {
  userId: OPERATOR_1_ID,
  operatorId: OPERATOR_1_ID,
  organizationId: ORG_ID,
  roles: ["OPERATOR"],
  scope: {
    kind: "stall",
    organizationId: ORG_ID,
    areaId: AREA_ID,
    stallId: STALL_1_ID,
    operatorId: OPERATOR_1_ID,
  },
  sessionIssuedAt: new Date(),
};

describe("Catat Pengeluaran End-to-End Write Flow", () => {
  beforeEach(() => {
    delete process.env.SIOMAYOPS_DB_PATH;
    memoryStore.resetToSeed();
  });

  afterEach(() => {
    delete process.env.SIOMAYOPS_DB_PATH;
  });

  describe("1. Authorized Creation & Mass-Assignment Protection", () => {
    it("creates a persisted operational expense, writes append-only audit event, and ignores forged fields", async () => {
      const beforeExpensesCount = memoryStore.expenses.size;
      const beforeAuditCount = memoryStore.auditEvents.length;

      const forgedPayload = {
        outletId: STALL_1_ID,
        categoryCode: "CONSUMABLE",
        amount: 37450,
        description: "Pembelian gas LPG 3kg & plastik kemasan",
        paidFrom: "CASH_BOX",
        note: "Nota fisik di laci gerobak",
        clientExpenseId: "client-exp-37450-001",
        // Forged fields that must be stripped/ignored:
        organizationId: "00000000-0000-7000-0000-000000000099",
        operatorId: "00000000-0000-7000-0000-000000000999",
        reviewStatus: "REVIEWED",
        reviewedBy: "hacker",
        createdAt: "1999-01-01T00:00:00.000Z",
      };

      const result = await recordExpense(hqSession, forgedPayload, {
        idempotencyKey: forgedPayload.clientExpenseId,
      });

      expect(result.replayed).toBe(false);
      expect(result.outletId).toBe(STALL_1_ID);
      expect(result.outletName).toContain("ST-001");
      expect(result.categoryCode).toBe("CONSUMABLE");
      expect(result.amount).toMatchObject({ amountMinor: 37450, currency: "IDR" });
      expect(result.paidFrom).toBe("CASH_BOX");
      expect(result.reviewStatus).toBe("SUBMITTED");
      expect(result.description).toBe("Pembelian gas LPG 3kg & plastik kemasan");
      expect(result.note).toBe("Nota fisik di laci gerobak");

      // Verify persisted expense record has server-derived fields
      expect(memoryStore.expenses.size).toBe(beforeExpensesCount + 1);
      const savedExp = memoryStore.expenses.get(result.expenseId);
      expect(savedExp).toBeDefined();
      expect(savedExp?.organizationId).toBe(ORG_ID);
      expect(savedExp?.operatorId).toBe(OPERATOR_1_ID);
      expect(savedExp?.stallId).toBe(STALL_1_ID);
      expect(savedExp?.reviewStatus).toBe("SUBMITTED");
      expect(savedExp?.reviewedBy).toBeUndefined();
      expect(savedExp?.amountMinor).toBe(37450);

      // Verify append-only audit trail
      expect(memoryStore.auditEvents.length).toBeGreaterThan(beforeAuditCount);
      const latestAudits = memoryStore.auditEvents.slice(beforeAuditCount);
      expect(latestAudits.map(a => a.action)).toContain("expense.submitted");
    });

    it("flags record-level pattern (e.g. ROUND_AMOUNT >= 50000) to REVIEW_REQUIRED without rejecting", async () => {
      const result = await recordExpense(hqSession, {
        outletId: STALL_1_ID,
        categoryCode: "TRANSPORT",
        amount: 50000,
        description: "Sewa angkut logistik gerobak",
        paidFrom: "CASH_BOX",
        clientExpenseId: "client-exp-flag-50000",
      });

      expect(result.reviewStatus).toBe("REVIEW_REQUIRED");
      expect(result.flaggedReason).toBe("ROUND_AMOUNT");
    });
  });

  describe("2. Unauthorized Outlet & Scope Enforcement", () => {
    it("rejects expense targeting an outlet belonging to another organization (403 FORBIDDEN)", async () => {
      await expect(
        recordExpense(hqSession, {
          outletId: EXTERNAL_STALL_ID,
          categoryCode: "PARKING",
          amount: 15000,
          description: "Parkir harian",
          paidFrom: "CASH_BOX",
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
      });
    });

    it("rejects stall-scoped operator attempting to record an expense on another stall in the same org (403 FORBIDDEN)", async () => {
      await expect(
        recordExpense(stall1OperatorSession, {
          outletId: STALL_2_ID,
          categoryCode: "CLEANING",
          amount: 12000,
          description: "Sabun cuci piring",
          paidFrom: "CASH_BOX",
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
      });

      // Authorized stall ST-001 succeeds for Budi
      const allowed = await recordExpense(stall1OperatorSession, {
        outletId: STALL_1_ID,
        categoryCode: "CLEANING",
        amount: 12000,
        description: "Sabun cuci piring",
        paidFrom: "CASH_BOX",
        clientExpenseId: "exp-auth-stall-001",
      });
      expect(allowed.outletId).toBe(STALL_1_ID);
      expect(allowed.amount.amountMinor).toBe(12000);
    });

    it("rejects non-existent outlet UUID with 404 NOT_FOUND", async () => {
      await expect(
        recordExpense(hqSession, {
          outletId: "00000000-0000-7000-0000-000000000999",
          categoryCode: "PARKING",
          amount: 10000,
          description: "Parkir lokasi",
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });
  });

  describe("3. Input Validation & Edge Cases", () => {
    it("rejects zero, negative, decimal, NaN, Infinity, and over-limit amounts", async () => {
      const invalidAmounts = [0, -1, -37450, 125.5, Number.NaN, Number.POSITIVE_INFINITY, 50_000_001];

      for (const badAmount of invalidAmounts) {
        await expect(
          recordExpense(hqSession, {
            outletId: STALL_1_ID,
            categoryCode: "PARKING",
            amount: badAmount,
            description: "Parkir gerobak",
          })
        ).rejects.toMatchObject({
          code: "VALIDATION_FAILED",
          status: 400,
        });
      }
    });

    it("rejects invalid category, short description, invalid/future timestamp, and overly long note", async () => {
      await expect(
        recordExpense(hqSession, {
          outletId: STALL_1_ID,
          categoryCode: "INVALID_CATEGORY",
          amount: 15000,
          description: "Parkir resmi",
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });

      await expect(
        recordExpense(hqSession, {
          outletId: STALL_1_ID,
          categoryCode: "PARKING",
          amount: 15000,
          description: "ab", // < 3 chars
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });

      await expect(
        recordExpense(hqSession, {
          outletId: STALL_1_ID,
          categoryCode: "PARKING",
          amount: 15000,
          description: "Parkir resmi",
          incurredAt: "not-a-valid-date",
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });

      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await expect(
        recordExpense(hqSession, {
          outletId: STALL_1_ID,
          categoryCode: "PARKING",
          amount: 15000,
          description: "Parkir resmi",
          incurredAt: futureDate,
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });

      await expect(
        recordExpense(hqSession, {
          outletId: STALL_1_ID,
          categoryCode: "PARKING",
          amount: 15000,
          description: "Parkir resmi",
          note: "x".repeat(301),
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });
    });
  });

  describe("4. Dashboard Read Model, Per-Outlet Expense Aggregation, Cash Position, and Activity Feed", () => {
    it("updates expense KPI, expected cash, target outlet expense row, and recent activity after write", async () => {
      const beforeModel = await getDashboardReadModel(hqSession);
      expect(beforeModel.expenses.totalExpenses.amountMinor).toBe(0);
      expect(beforeModel.expenses.count).toBe(0);
      expect(beforeModel.cashPosition.cashExpenses.amountMinor).toBe(0);
      expect(beforeModel.cashPosition.expectedCash.amountMinor).toBe(160000);

      const st1Before = beforeModel.outlets.find(o => o.outletId === STALL_1_ID)!;
      const st2Before = beforeModel.outlets.find(o => o.outletId === STALL_2_ID)!;
      expect(st1Before.totalExpenses.amountMinor).toBe(0);
      expect(st1Before.expenseCount).toBe(0);
      expect(st2Before.totalExpenses.amountMinor).toBe(0);
      expect(st2Before.expenseCount).toBe(0);

      // Record distinctive Rp 37.450 expense on ST-001 from CASH_BOX
      const exp = await recordExpense(
        hqSession,
        {
          outletId: STALL_1_ID,
          categoryCode: "CONSUMABLE",
          amount: 37450,
          description: "Gas LPG 3kg & kemasan mika",
          paidFrom: "CASH_BOX",
          note: "Bukti runtime Rp 37.450",
          clientExpenseId: "exp-proof-37450-001",
        },
        { idempotencyKey: "exp-proof-37450-001" }
      );

      const afterModel = await getDashboardReadModel(hqSession);

      // Expense KPIs updated accurately
      expect(afterModel.expenses.totalExpenses.amountMinor).toBe(37450);
      expect(afterModel.expenses.cashBoxExpenses.amountMinor).toBe(37450);
      expect(afterModel.expenses.count).toBe(1);
      expect(afterModel.expenses.pendingReviewCount).toBe(1);

      // Cash position reflects cash box expense deduction
      expect(afterModel.cashPosition.cashExpenses.amountMinor).toBe(37450);
      expect(afterModel.cashPosition.expectedCash.amountMinor).toBe(160000 - 37450); // 122550

      // Target outlet ST-001 updated; ST-002 untouched
      const st1After = afterModel.outlets.find(o => o.outletId === STALL_1_ID)!;
      const st2After = afterModel.outlets.find(o => o.outletId === STALL_2_ID)!;
      expect(st1After.totalExpenses.amountMinor).toBe(37450);
      expect(st1After.expenseCount).toBe(1);
      expect(st2After.totalExpenses.amountMinor).toBe(0);
      expect(st2After.expenseCount).toBe(0);

      // Recent activity has the new expense at index 0
      const latestActivity = afterModel.recentActivity[0]!;
      expect(latestActivity.kind).toBe("EXPENSE");
      expect(latestActivity.id).toBe(exp.expenseId);
      expect(latestActivity.amount.amountMinor).toBe(37450);
      expect(latestActivity.categoryCode).toBe("CONSUMABLE");
      expect(latestActivity.outletId).toBe(STALL_1_ID);
      expect(latestActivity.note).toContain("Gas LPG 3kg & kemasan mika");
    });
  });

  describe("5. Idempotency & Duplicate Submission Protection", () => {
    it("deduplicates sequential retries with the same Idempotency-Key and returns replayed: true", async () => {
      const payload = {
        outletId: STALL_1_ID,
        categoryCode: "PARKING" as const,
        amount: 37450,
        description: "Retribusi parkir harian",
        paidFrom: "CASH_BOX" as const,
        clientExpenseId: "idem-exp-double-click-001",
      };

      const first = await recordExpense(hqSession, payload, {
        idempotencyKey: payload.clientExpenseId,
      });
      const second = await recordExpense(hqSession, payload, {
        idempotencyKey: payload.clientExpenseId,
      });

      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.expenseId).toBe(first.expenseId);

      const dashboard = await getDashboardReadModel(hqSession);
      expect(dashboard.expenses.count).toBe(1);
      expect(dashboard.expenses.totalExpenses.amountMinor).toBe(37450);
    });

    it("deduplicates concurrent in-flight requests with the same Idempotency-Key", async () => {
      const payload = {
        outletId: STALL_2_ID,
        categoryCode: "CLEANING" as const,
        amount: 24300,
        description: "Sabun & tisu gerobak Dago",
        paidFrom: "CASH_BOX" as const,
        clientExpenseId: "idem-exp-concurrent-001",
      };

      const [resA, resB] = await Promise.all([
        recordExpense(hqSession, payload, { idempotencyKey: payload.clientExpenseId }),
        recordExpense(hqSession, payload, { idempotencyKey: payload.clientExpenseId }),
      ]);

      expect(resA.expenseId).toBe(resB.expenseId);

      const dashboard = await getDashboardReadModel(hqSession);
      const st2 = dashboard.outlets.find(o => o.outletId === STALL_2_ID)!;
      expect(st2.expenseCount).toBe(1);
      expect(st2.totalExpenses.amountMinor).toBe(24300);
    });

    it("rejects reusing the same Idempotency-Key with a different payload (422 IDEMPOTENCY_MISMATCH)", async () => {
      const key = "idem-exp-mismatch-001";
      await recordExpense(
        hqSession,
        {
          outletId: STALL_1_ID,
          categoryCode: "PARKING",
          amount: 37450,
          description: "Parkir pagi",
          paidFrom: "CASH_BOX",
          clientExpenseId: key,
        },
        { idempotencyKey: key }
      );

      await expect(
        recordExpense(
          hqSession,
          {
            outletId: STALL_1_ID,
            categoryCode: "PARKING",
            amount: 19000,
            description: "Parkir pagi",
            paidFrom: "CASH_BOX",
            clientExpenseId: key,
          },
          { idempotencyKey: key }
        )
      ).rejects.toMatchObject({
        code: "IDEMPOTENCY_MISMATCH",
        status: 422,
      });
    });
  });

  describe("6. File-Backed Persistence & Simulated Server Restart", () => {
    it("persists expense to disk and restores state after memory wipe / restart", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siomayops-exp-db-test-"));
      const dbFile = path.join(tmpDir, "db.json");
      process.env.SIOMAYOPS_DB_PATH = dbFile;

      try {
        memoryStore.resetToSeed();
        expect(fs.existsSync(dbFile)).toBe(true);

        const created = await recordExpense(
          hqSession,
          {
            outletId: STALL_1_ID,
            categoryCode: "CONSUMABLE",
            amount: 37450,
            description: "Persisted expense across restart",
            paidFrom: "CASH_BOX",
            clientExpenseId: "persist-exp-restart-key-001",
          },
          { idempotencyKey: "persist-exp-restart-key-001" }
        );

        const rawJson = fs.readFileSync(dbFile, "utf-8");
        expect(rawJson).toContain(created.expenseId);
        expect(rawJson).toContain("37450");

        const reloaded = memoryStore.reloadFromDisk();
        expect(reloaded).toBe(true);

        const dashboardAfterRestart = await getDashboardReadModel(hqSession);
        expect(dashboardAfterRestart.expenses.totalExpenses.amountMinor).toBe(37450);
        expect(dashboardAfterRestart.expenses.count).toBe(1);
        expect(dashboardAfterRestart.recentActivity[0]?.id).toBe(created.expenseId);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("7. Route Handlers (/api/v1/expenses, /api/v1/hq/expense-review, /api/v1/hq/dashboard)", () => {
    it("handles POST /api/v1/expenses, idempotent replay header, and GET /api/v1/hq/expense-review", async () => {
      const body = {
        outletId: STALL_2_ID,
        categoryCode: "CONSUMABLE",
        amount: 37450,
        description: "Gas LPG & kemasan cabang Dago",
        paidFrom: "CASH_BOX",
        clientExpenseId: "http-route-exp-37450",
      };

      const req1 = new NextRequest("http://localhost:3000/api/v1/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "http-route-exp-37450",
        },
        body: JSON.stringify(body),
      });

      const res1 = await postExpenseRoute(req1);
      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      expect(json1.replayed).toBe(false);
      expect(json1.data.amount.amountMinor).toBe(37450);

      // Replay same request
      const req2 = new NextRequest("http://localhost:3000/api/v1/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "http-route-exp-37450",
        },
        body: JSON.stringify(body),
      });
      const res2 = await postExpenseRoute(req2);
      expect(res2.status).toBe(200);
      expect(res2.headers.get("X-Idempotent-Replayed")).toBe("true");
      const json2 = await res2.json();
      expect(json2.replayed).toBe(true);
      expect(json2.data.expenseId).toBe(json1.data.expenseId);

      // Verify GET /api/v1/hq/expense-review reflects the new expense
      const revReq = new NextRequest("http://localhost:3000/api/v1/hq/expense-review");
      const revRes = await getExpenseReviewRoute(revReq);
      expect(revRes.status).toBe(200);
      const revJson = await revRes.json();
      expect(revJson.data.totalExpenses.amountMinor).toBe(37450);
      expect(revJson.data.total).toBe(1);

      // Verify GET /api/v1/hq/dashboard reflects the new expense
      const dashReq = new NextRequest("http://localhost:3000/api/v1/hq/dashboard");
      const dashRes = await getDashboardRoute(dashReq);
      expect(dashRes.status).toBe(200);
      const dashJson = await dashRes.json();
      expect(dashJson.data.kpis.value.expenses.amountMinor).toBe(37450);
      expect(dashJson.data.expenseReview.value.pending).toBe(1);

      // Verify GET /api/v1/expenses lists the new expense
      const listReq = new NextRequest(`http://localhost:3000/api/v1/expenses?outletId=${STALL_2_ID}`);
      const listRes = await getExpensesRoute(listReq);
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.data.length).toBe(1);
      expect(listJson.data[0].id).toBe(json1.data.expenseId);
    });
  });
});
