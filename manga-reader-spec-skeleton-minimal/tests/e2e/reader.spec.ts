import { test, expect } from "@playwright/test";

// T-READER-001: smoke-test the actual route, not a synthetic page fixture.
test("opens a chapter and exposes the reader", async ({ page }) => {
  await page.goto("/manga/sample-manga/chapter/1");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("button").first()).toBeVisible();
});

// T-ACCESS-001: this test checks one keyboard-reachable control. Full axe
// and device matrix from the spec are not yet verified.
test("reader exposes a keyboard-focusable control", async ({ page }) => {
  await page.goto("/manga/sample-manga/chapter/1");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
