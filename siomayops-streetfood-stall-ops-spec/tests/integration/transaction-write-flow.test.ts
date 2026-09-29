import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NextRequest } from "next/server";
import { memoryStore } from "@/server/db/memory-store";
import { recordTransaction, getAuthorizedOutlets } from "@/features/sales";
import { getDashboardReadModel } from "@/features/hq";
import { POST as postTransactionRoute, GET as getTransactionsRoute } from "@/app/api/v1/transactions/route";
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

describe("Catat Transaksi End-to-End Write Flow", () => {
  beforeEach(() => {
    delete process.env.SIOMAYOPS_DB_PATH;
    memoryStore.resetToSeed();
  });

  afterEach(() => {
    delete process.env.SIOMAYOPS_DB_PATH;
  });

  describe("1. Authorized Creation & Mass-Assignment Protection", () => {
    it("creates a completed cash transaction, updates store, writes audit events, and ignores forged fields", async () => {
      const beforeSalesCount = memoryStore.sales.size;
      const beforeAuditCount = memoryStore.auditEvents.length;

      const forgedPayload = {
        outletId: STALL_1_ID,
        amount: 85137,
        paymentMethod: "CASH",
        note: "Pesanan makan siang kantor",
        clientTransactionId: "client-tx-85137-001",
        // Forged fields that must be stripped/ignored:
        organizationId: "00000000-0000-7000-0000-000000000099",
        operatorId: "00000000-0000-7000-0000-000000000999",
        status: "VOIDED",
        createdAt: "1999-01-01T00:00:00.000Z",
      };

      const result = await recordTransaction(hqSession, forgedPayload, {
        idempotencyKey: forgedPayload.clientTransactionId,
      });

      expect(result.replayed).toBe(false);
      expect(result.outletId).toBe(STALL_1_ID);
      expect(result.outletName).toContain("ST-001");
      expect(result.amount).toMatchObject({ amountMinor: 85137, currency: "IDR" });
      expect(result.paymentMethod).toBe("CASH");
      expect(result.paymentStatus).toBe("PAID");
      expect(result.status).toBe("COMPLETED");
      expect(result.note).toBe("Pesanan makan siang kantor");

      // Verify persisted sale record has server-derived fields, not forged ones
      expect(memoryStore.sales.size).toBe(beforeSalesCount + 1);
      const savedSale = memoryStore.sales.get(result.saleId);
      expect(savedSale).toBeDefined();
      expect(savedSale?.organizationId).toBe(ORG_ID);
      expect(savedSale?.operatorId).toBe(OPERATOR_1_ID);
      expect(savedSale?.status).toBe("COMPLETED");
      expect(savedSale?.totalMinor).toBe(85137);
      expect(savedSale?.createdAt.getUTCFullYear()).toBeGreaterThanOrEqual(2025);

      // Verify payment record
      const savedPayment = memoryStore.payments.get(result.paymentId);
      expect(savedPayment).toBeDefined();
      expect(savedPayment?.amountMinor).toBe(85137);
      expect(savedPayment?.status).toBe("PAID");
      expect(savedPayment?.method).toBe("CASH");

      // Verify append-only audit trail
      expect(memoryStore.auditEvents.length).toBeGreaterThan(beforeAuditCount);
      const latestAudits = memoryStore.auditEvents.slice(beforeAuditCount);
      expect(latestAudits.map(a => a.action)).toEqual([
        "sale.created",
        "payment.recorded",
      ]);
    });
  });

  describe("2. Unauthorized Outlet & Scope Enforcement", () => {
    it("rejects transaction targeting an outlet belonging to another organization (403 FORBIDDEN)", async () => {
      await expect(
        recordTransaction(hqSession, {
          outletId: EXTERNAL_STALL_ID,
          amount: 50000,
          paymentMethod: "CASH",
          clientTransactionId: "tx-unauth-org-001",
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
      });
    });

    it("rejects stall-scoped operator attempting to record transaction on another stall in the same org (403 FORBIDDEN)", async () => {
      // Budi is scoped to ST-001; attempting to write to ST-002 must fail
      await expect(
        recordTransaction(stall1OperatorSession, {
          outletId: STALL_2_ID,
          amount: 45000,
          paymentMethod: "CASH",
          clientTransactionId: "tx-unauth-stall-002",
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
      });

      // Authorized stall ST-001 succeeds for Budi
      const allowed = await recordTransaction(stall1OperatorSession, {
        outletId: STALL_1_ID,
        amount: 45000,
        paymentMethod: "CASH",
        clientTransactionId: "tx-auth-stall-001",
      });
      expect(allowed.outletId).toBe(STALL_1_ID);
      expect(allowed.amount.amountMinor).toBe(45000);
    });

    it("rejects non-existent outlet UUID with 404 NOT_FOUND", async () => {
      await expect(
        recordTransaction(hqSession, {
          outletId: "00000000-0000-7000-0000-000000000999",
          amount: 25000,
          paymentMethod: "CASH",
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("lists only authorized outlets for session scope", async () => {
      const hqOutlets = await getAuthorizedOutlets(hqSession);
      expect(hqOutlets.map(o => o.stallCode)).toEqual(["ST-001", "ST-002"]);

      const stall1Outlets = await getAuthorizedOutlets(stall1OperatorSession);
      expect(stall1Outlets.map(o => o.stallCode)).toEqual(["ST-001"]);
    });
  });

  describe("3. Input Validation & Edge Cases", () => {
    it("rejects zero, negative, decimal, NaN, Infinity, and over-limit amounts", async () => {
      const invalidAmounts = [0, -1, -85137, 123.45, Number.NaN, Number.POSITIVE_INFINITY, 100_000_001];

      for (const badAmount of invalidAmounts) {
        await expect(
          recordTransaction(hqSession, {
            outletId: STALL_1_ID,
            amount: badAmount,
            paymentMethod: "CASH",
          })
        ).rejects.toMatchObject({
          code: "VALIDATION_FAILED",
          status: 400,
        });
      }
    });

    it("rejects missing outletId, invalid timestamps, future timestamps, and overly long notes", async () => {
      await expect(
        recordTransaction(hqSession, {
          outletId: "",
          amount: 30000,
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });

      await expect(
        recordTransaction(hqSession, {
          outletId: STALL_1_ID,
          amount: 30000,
          occurredAt: "not-a-valid-timestamp",
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });

      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await expect(
        recordTransaction(hqSession, {
          outletId: STALL_1_ID,
          amount: 30000,
          occurredAt: futureDate,
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });

      await expect(
        recordTransaction(hqSession, {
          outletId: STALL_1_ID,
          amount: 30000,
          note: "x".repeat(301),
        })
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });
    });
  });

  describe("4. Dashboard Read Model, Per-Outlet Aggregation, and Activity Feed", () => {
    it("updates total sales, transaction count, expected cash, target outlet row, and recent activity after write", async () => {
      const beforeModel = await getDashboardReadModel(hqSession);
      expect(beforeModel.sales.totalSales.amountMinor).toBe(60000);
      expect(beforeModel.sales.count).toBe(2);
      expect(beforeModel.cashPosition.expectedCash.amountMinor).toBe(160000);

      const st1Before = beforeModel.outlets.find(o => o.outletId === STALL_1_ID)!;
      const st2Before = beforeModel.outlets.find(o => o.outletId === STALL_2_ID)!;
      expect(st1Before.totalSales.amountMinor).toBe(60000);
      expect(st1Before.transactionCount).toBe(2);
      expect(st2Before.totalSales.amountMinor).toBe(0);
      expect(st2Before.transactionCount).toBe(0);

      // Record distinctive Rp 85.137 transaction on ST-001
      const tx = await recordTransaction(
        hqSession,
        {
          outletId: STALL_1_ID,
          amount: 85137,
          paymentMethod: "CASH",
          note: "Bukti runtime Rp 85.137",
          clientTransactionId: "tx-proof-85137-001",
        },
        { idempotencyKey: "tx-proof-85137-001" }
      );

      const afterModel = await getDashboardReadModel(hqSession);

      // KPIs updated accurately without floating point drift
      expect(afterModel.sales.totalSales.amountMinor).toBe(60000 + 85137); // 145137
      expect(afterModel.sales.count).toBe(3);
      expect(afterModel.sales.grossByMethod.CASH.amountMinor).toBe(145137);
      expect(afterModel.cashPosition.expectedCash.amountMinor).toBe(160000 + 85137); // 245137

      // Target outlet ST-001 updated; ST-002 untouched
      const st1After = afterModel.outlets.find(o => o.outletId === STALL_1_ID)!;
      const st2After = afterModel.outlets.find(o => o.outletId === STALL_2_ID)!;
      expect(st1After.totalSales.amountMinor).toBe(145137);
      expect(st1After.transactionCount).toBe(3);
      expect(st2After.totalSales.amountMinor).toBe(0);
      expect(st2After.transactionCount).toBe(0);

      // Recent activity has the new transaction at index 0
      expect(afterModel.recentActivity.length).toBeGreaterThanOrEqual(3);
      const latestActivity = afterModel.recentActivity[0]!;
      expect(latestActivity.id).toBe(tx.saleId);
      expect(latestActivity.amount.amountMinor).toBe(85137);
      expect(latestActivity.outletId).toBe(STALL_1_ID);
      expect(latestActivity.note).toBe("Bukti runtime Rp 85.137");
      expect(latestActivity.paymentStatus).toBe("PAID");
    });
  });

  describe("5. Idempotency & Duplicate Submission Protection", () => {
    it("deduplicates sequential retries with the same Idempotency-Key and returns replayed: true", async () => {
      const payload = {
        outletId: STALL_1_ID,
        amount: 85137,
        paymentMethod: "CASH" as const,
        note: "Tes klik ganda",
        clientTransactionId: "idem-key-double-click-001",
      };

      const first = await recordTransaction(hqSession, payload, {
        idempotencyKey: payload.clientTransactionId,
      });
      const second = await recordTransaction(hqSession, payload, {
        idempotencyKey: payload.clientTransactionId,
      });

      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.saleId).toBe(first.saleId);
      expect(second.paymentId).toBe(first.paymentId);

      // Total transaction count increased by only 1 (from 2 to 3)
      const dashboard = await getDashboardReadModel(hqSession);
      expect(dashboard.sales.count).toBe(3);
      expect(dashboard.sales.totalSales.amountMinor).toBe(145137);
    });

    it("deduplicates concurrent in-flight requests with the same Idempotency-Key", async () => {
      const payload = {
        outletId: STALL_2_ID,
        amount: 72500,
        paymentMethod: "CASH" as const,
        note: "Tes paralel",
        clientTransactionId: "idem-key-concurrent-001",
      };

      const [resA, resB] = await Promise.all([
        recordTransaction(hqSession, payload, { idempotencyKey: payload.clientTransactionId }),
        recordTransaction(hqSession, payload, { idempotencyKey: payload.clientTransactionId }),
      ]);

      expect(resA.saleId).toBe(resB.saleId);
      expect(resA.paymentId).toBe(resB.paymentId);

      const dashboard = await getDashboardReadModel(hqSession);
      const st2 = dashboard.outlets.find(o => o.outletId === STALL_2_ID)!;
      expect(st2.transactionCount).toBe(1);
      expect(st2.totalSales.amountMinor).toBe(72500);
    });

    it("rejects reusing the same Idempotency-Key with a different payload (422 IDEMPOTENCY_MISMATCH)", async () => {
      const key = "idem-key-mismatch-001";
      await recordTransaction(
        hqSession,
        {
          outletId: STALL_1_ID,
          amount: 85137,
          paymentMethod: "CASH",
          clientTransactionId: key,
        },
        { idempotencyKey: key }
      );

      await expect(
        recordTransaction(
          hqSession,
          {
            outletId: STALL_1_ID,
            amount: 99999,
            paymentMethod: "CASH",
            clientTransactionId: key,
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
    it("persists transaction to disk and restores state after memory wipe / restart", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siomayops-db-test-"));
      const dbFile = path.join(tmpDir, "db.json");
      process.env.SIOMAYOPS_DB_PATH = dbFile;

      try {
        memoryStore.resetToSeed();
        expect(fs.existsSync(dbFile)).toBe(true);

        const created = await recordTransaction(
          hqSession,
          {
            outletId: STALL_1_ID,
            amount: 85137,
            paymentMethod: "CASH",
            note: "Persisted across restart",
            clientTransactionId: "persist-restart-key-001",
          },
          { idempotencyKey: "persist-restart-key-001" }
        );

        // Verify disk file contains the saleId and 85137
        const rawJson = fs.readFileSync(dbFile, "utf-8");
        expect(rawJson).toContain(created.saleId);
        expect(rawJson).toContain("85137");

        // Simulate process restart by reloading store from disk
        const reloaded = memoryStore.reloadFromDisk();
        expect(reloaded).toBe(true);

        const dashboardAfterRestart = await getDashboardReadModel(hqSession);
        expect(dashboardAfterRestart.sales.totalSales.amountMinor).toBe(145137);
        expect(dashboardAfterRestart.sales.count).toBe(3);
        expect(dashboardAfterRestart.recentActivity[0]?.id).toBe(created.saleId);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("7. Route Handlers (/api/v1/transactions and /api/v1/hq/dashboard)", () => {
    it("handles POST /api/v1/transactions, idempotent replay header, and GET /api/v1/hq/dashboard", async () => {
      const body = {
        outletId: STALL_2_ID,
        amount: 85137,
        paymentMethod: "CASH",
        note: "Via HTTP route handler",
        clientTransactionId: "http-route-tx-85137",
      };

      const req1 = new NextRequest("http://localhost:3000/api/v1/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "http-route-tx-85137",
        },
        body: JSON.stringify(body),
      });

      const res1 = await postTransactionRoute(req1);
      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      expect(json1.replayed).toBe(false);
      expect(json1.data.amount.amountMinor).toBe(85137);

      // Replay same request
      const req2 = new NextRequest("http://localhost:3000/api/v1/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "http-route-tx-85137",
        },
        body: JSON.stringify(body),
      });
      const res2 = await postTransactionRoute(req2);
      expect(res2.status).toBe(200);
      expect(res2.headers.get("X-Idempotent-Replayed")).toBe("true");
      const json2 = await res2.json();
      expect(json2.replayed).toBe(true);
      expect(json2.data.saleId).toBe(json1.data.saleId);

      // Verify GET /api/v1/hq/dashboard reflects the new transaction
      const dashReq = new NextRequest("http://localhost:3000/api/v1/hq/dashboard");
      const dashRes = await getDashboardRoute(dashReq);
      expect(dashRes.status).toBe(200);
      const dashJson = await dashRes.json();
      expect(dashJson.data.sales.totalSales.amountMinor).toBe(145137);
      expect(dashJson.data.sales.count).toBe(3);

      // Verify GET /api/v1/transactions lists the new transaction
      const listReq = new NextRequest(`http://localhost:3000/api/v1/transactions?outletId=${STALL_2_ID}`);
      const listRes = await getTransactionsRoute(listReq);
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.data.length).toBe(1);
      expect(listJson.data[0].id).toBe(json1.data.saleId);
    });
  });
});
