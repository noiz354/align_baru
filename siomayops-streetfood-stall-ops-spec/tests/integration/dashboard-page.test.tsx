// @types/react-dom is not a dependency of this project; the runtime module exists and is typed by
// the minimal ambient declaration in tests/ui/_types/react-dom-server.d.ts.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const failure = vi.hoisted(() => ({ on: false }));
const seen = vi.hoisted(() => ({ inputs: [] as unknown[] }));
vi.mock("../../src/features/hq/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/features/hq/dashboard")>();
  return { ...actual, getHqDashboard: (input: Parameters<typeof actual.getHqDashboard>[0]) => { seen.inputs.push(input); if (failure.on) throw new Error("boom: /secret/path/data/db.json"); return actual.getHqDashboard(input); } };
});

import Page from "../../src/app/page";
import { memoryStore } from "../../src/server/db/memory-store";

const org = "org-page-test";
const area = "area-page-test";
const locationId = "location-page-test";
const shiftId = "shift-page-test";
const day = "2026-09-29";
const at = new Date("2026-09-29T03:00:00.000Z"); // 10:00 WIB, inside business day 2026-09-29

const render = async (params: Record<string, string> = {}) => renderToStaticMarkup((await Page({ searchParams: Promise.resolve(params) })) as ReactElement);

function seed() {
  memoryStore.operators.set("operator-page", { id: "operator-page", organizationId: org, areaId: area, name: "Dimas", phoneE164: "+620000", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", startedOn: "2026-01-01", createdAt: at, updatedAt: at, active: true } as never);
  memoryStore.stalls.set("stall-page", { id: "stall-page", organizationId: org, areaId: area, code: "ST-P", type: "MOBILE", status: "ACTIVE", createdAt: at } as never);
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: org, areaId: area, name: "Manggarai", status: "ACTIVE", createdAt: at, updatedAt: at } as never);
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: org, operatorId: "operator-page", stallId: "stall-page", businessDay: day, startedAt: at, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "c-shift", version: 1, createdAt: at, updatedAt: at } as never);
  memoryStore.sales.set("sale-page", { id: "sale-page", organizationId: org, shiftId, operatorId: "operator-page", sellingLocationId: locationId, businessDay: day, status: "COMPLETED", totalMinor: 85137, currency: "IDR", occurredAt: at, serverAcceptedAt: at, clientSaleId: "c-sale", version: 1, createdAt: at } as never);
}

beforeEach(() => {
  memoryStore.clear();
  failure.on = false; seen.inputs.length = 0;
  process.env.FAKE_ORG_ID = org;
  delete process.env.FAKE_AUTH_ROLE; delete process.env.FAKE_AUTH_AREA_ID; delete process.env.FAKE_OPERATOR_ID;
});
afterEach(() => { memoryStore.clear(); delete process.env.FAKE_ORG_ID; delete process.env.FAKE_AUTH_ROLE; });

describe("dashboard page uses the server read model", () => {
  it("renders persisted values and none of the retired sample numbers", async () => {
    seed();
    const html = await render({ date: day });
    expect(html).toContain("Rp 85.137");
    expect(html).toContain("Manggarai");
    expect(html).toContain("Dimas");
    // An open shift with no location report for 30+ minutes is a derived alert, so the row needs attention.
    expect(html).toContain("Perlu Perhatian");
    expect(html).toContain("Tanpa Lokasi");
    expect(html).toContain("Selasa, 29 September 2026");
    for (const retired of ["Rp 8.450.000", "Rp 1.275.000", "Rp 45.187", "Pasar Minggu", "Rizky Pratama", "Cikini"]) expect(html).not.toContain(retired);
  });

  it("shows an honest empty day without sample data", async () => {
    seed();
    const html = await render({ date: "2026-09-20" });
    expect(html).toContain("Belum ada aktivitas operasional pada 20 Sep 2026.");
    expect(html).toContain("Tidak ada perhatian khusus saat ini.");
    expect(html).toContain("Belum ada aktivitas operasional hari ini.");
    expect(html).not.toContain("Rp 85.137");
  });

  it("passes the selected date and outlet to the server query", async () => {
    seed();
    const html = await render({ date: day, outletId: locationId });
    expect(seen.inputs[0]).toMatchObject({ businessDay: day, outletId: locationId });
    expect(html).toContain("Ringkasan aktivitas Manggarai");
  });

  it("rejects malformed dates and unknown outlets without querying or leaking data", async () => {
    seed();
    expect(await render({ date: "2026-13-45" })).toContain("Filter tidak valid");
    expect(await render({ date: "2026-02-30" })).toContain("Filter tidak valid");
    expect(seen.inputs).toHaveLength(0);
    const missing = await render({ date: day, outletId: "someone-elses-outlet" });
    expect(missing).toContain("Outlet tidak ditemukan");
    expect(missing).not.toContain("Manggarai");
  });

  it("scopes an area supervisor to their own area", async () => {
    seed();
    memoryStore.sellingLocations.set("location-foreign", { id: "location-foreign", organizationId: org, areaId: "area-foreign", name: "Lokasi Asing", status: "ACTIVE", createdAt: at, updatedAt: at } as never);
    process.env.FAKE_AUTH_ROLE = "AREA_SUPERVISOR"; process.env.FAKE_AUTH_AREA_ID = area;
    const html = await render({ date: day });
    expect(html).toContain("Manggarai");
    expect(html).not.toContain("Lokasi Asing");
    expect(await render({ date: day, outletId: "location-foreign" })).toContain("Outlet tidak ditemukan");
  });

  it("refuses roles without hq:view and unauthenticated sessions", async () => {
    seed();
    process.env.FAKE_AUTH_ROLE = "OPERATOR"; // no operator id -> no session
    expect(await render({ date: day })).toContain("Masuk diperlukan");
    process.env.FAKE_OPERATOR_ID = "operator-page";
    expect(await render({ date: day })).toContain("Akses ditolak");
    expect(seen.inputs).toHaveLength(0);
  });

  it("shows a retryable, non-leaking error state instead of stale numbers", async () => {
    seed();
    failure.on = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = await render({ date: day });
    spy.mockRestore();
    expect(html).toContain("Data operasional tidak dapat dimuat.");
    expect(html).toContain("Coba Lagi");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("Rp 85.137");
  });
});
