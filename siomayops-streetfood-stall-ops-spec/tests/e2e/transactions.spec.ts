import { expect, test } from "@playwright/test";

test("operator records a cash transaction, reloads it, and opens its real detail", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Transaksi", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Riwayat transaksi" })).toBeVisible();

  await page.getByRole("button", { name: "Catat transaksi" }).click();
  await expect(page.getByRole("dialog", { name: "Catat transaksi" })).toBeVisible();
  const addButtons = page.getByRole("button", { name: /^Tambah / });
  await expect(addButtons.first()).toBeVisible();
  await addButtons.first().click();
  await page.getByLabel("Tunai diterima (Rp)").fill("100000");
  await page.getByRole("button", { name: "Simpan transaksi" }).click();

  await expect(page.getByRole("status")).toContainText("Transaksi tersimpan", { timeout: 10000 });
  const transactionLink = page.locator("tbody a[href^='/transactions/']").first();
  await expect(transactionLink).toBeVisible();
  const detailHref = await transactionLink.getAttribute("href");
  expect(detailHref).toBeTruthy();

  await page.reload();
  await expect(page.locator("tbody a[href^='/transactions/']").first()).toBeVisible();
  await page.locator("tbody a[href^='/transactions/']").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("#");
  await expect(page.getByText("Tunai · Dibayar")).toBeVisible();
});
