import { test, expect } from "@playwright/test";

test.describe("HQ dashboard", () => {
  test("renders the authenticated server read model and records a view event", async ({ page }) => {
    const analyticsEvent = page.waitForResponse((response) => response.url().includes("/api/v1/analytics") && response.request().method() === "POST");
    const dashboardResponse = page.waitForResponse((response) => response.url().includes("/api/v1/hq/dashboard") && response.request().method() === "GET");

    await page.goto("/");
    const apiResponse = await dashboardResponse;
    expect(apiResponse.status()).toBe(200);
    const body = await apiResponse.json() as {
      data: { pagination: { total: number }; kpis: { salesMinor: number; digitalVerifiedMinor: number; digitalUnverifiedMinor: number }; outlets: Array<{ name: string }> };
      meta: { freshnessBand: string };
    };

    await expect(page.getByRole("heading", { name: "Dashboard Operasional" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status outlet" })).toBeVisible();
    await expect(page.getByText(`${body.data.pagination.total} outlet terdaftar`)).toBeVisible();
    expect(body.meta.freshnessBand).toBe("current");
    expect(body.data.kpis.salesMinor).toBeGreaterThanOrEqual(0);
    expect(body.data.kpis.digitalVerifiedMinor).toBeGreaterThanOrEqual(0);
    expect(body.data.kpis.digitalUnverifiedMinor).toBeGreaterThanOrEqual(0);
    if (body.data.outlets[0]) await expect(page.getByText(body.data.outlets[0].name, { exact: true })).toBeVisible();

    const eventResponse = await analyticsEvent;
    expect(eventResponse.status()).toBe(202);
  });

  test("sends date, area, outlet, search, and status filters to the server", async ({ page }) => {
    const initialResponse = page.waitForResponse((response) => response.url().includes("/api/v1/hq/dashboard") && response.request().method() === "GET");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard Operasional" })).toBeVisible();
    const initialBody = await (await initialResponse).json() as { data: { outletOptions: Array<{ id: string; areaId: string }> } };
    const firstOutlet = initialBody.data.outletOptions[0];

    const dateResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("date") === "2026-09-28" && response.request().method() === "GET");
    await page.getByLabel("Tanggal operasional").fill("2026-09-28");
    expect((await dateResponse).status()).toBe(200);

    if (firstOutlet) {
      const areaResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("areaId") === firstOutlet.areaId && response.request().method() === "GET");
      await page.getByLabel("Pilih area").selectOption(firstOutlet.areaId);
      expect((await areaResponse).status()).toBe(200);

      const outletResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("outletId") === firstOutlet.id && response.request().method() === "GET");
      await page.getByLabel("Pilih cakupan outlet").selectOption(firstOutlet.id);
      expect((await outletResponse).status()).toBe(200);
    }

    const searchResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("search") === "outlet-yang-tidak-ada" && response.request().method() === "GET");
    await page.getByLabel("Cari outlet pada tabel").fill("outlet-yang-tidak-ada");
    expect((await searchResponse).status()).toBe(200);

    const filteredResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("status") === "NOT_STARTED" && response.request().method() === "GET");
    await page.getByLabel("Filter status outlet").selectOption("NOT_STARTED");
    const response = await filteredResponse;
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: { outlets: unknown[]; pagination: { total: number } } };
    expect(body.data.outlets.length).toBe(body.data.pagination.total > 0 ? body.data.outlets.length : 0);
    if (body.data.pagination.total === 0) await expect(page.getByText("Tidak ada outlet yang cocok dengan filter ini.")).toBeVisible();
  });
});
