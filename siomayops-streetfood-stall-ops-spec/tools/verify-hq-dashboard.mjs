#!/usr/bin/env node
/**
 * tools/verify-hq-dashboard.mjs — runtime proof for the read-only HQ dashboard.
 *
 * Documented in `docs/integration/04-dashboard-ui-integration.md`.
 *
 * What it proves, in order:
 *   1. `GET /api/v1/hq/dashboard` answers for the current business day;
 *   2. real records created through the app's own APIs (POS sale → cash payment, second sale →
 *      unverified digital payment, one expense) move the read model by exactly the recorded
 *      amounts — no more, no less;
 *   3. the browser renders those figures at 1440 / 768 / 390 px, with the trend bucket, alert
 *      mapping, activity mapping and both URL filters behaving, and with a clean console;
 *   4. the previous dashboard's sample values appear nowhere in the rendered page.
 *
 * Expected figures are derived from the API before/after delta, so this script carries no fixture
 * data of its own and cannot "pass" against hardcoded numbers.
 *
 * Browser: `puppeteer-core` + `@sparticuz/chromium` are NOT dependencies of this project (see
 * `HARNESS.md` §3 for why the browser comes from the npm registry and unpacks to /tmp). If they are
 * unavailable the script reports SKIPPED with the reason and exits 2 — a skip is never a pass.
 *
 * Usage: node tools/verify-hq-dashboard.mjs [--base http://localhost:3000]
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : process.env.HQ_BASE ?? "http://localhost:3000";
const OUT_DIR = process.env.VERIFY_OUT ?? "/tmp/verify-out";
const RUN_ID = `verify-${Date.now().toString(36)}`;

const checks = [];
let failed = 0;

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) failed += 1;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name, reason) {
  checks.push({ name, passed: false, skipped: true, detail: reason });
  console.log(`SKIP  ${name} — ${reason}`);
}

const DEP_DIRS = [process.cwd(), "/tmp/verifier", process.env.VERIFY_DEPS_DIR].filter(Boolean);

function loadDependency(name) {
  for (const dir of DEP_DIRS) {
    try {
      return require(require.resolve(name, { paths: [dir] }));
    } catch {
      continue;
    }
  }
  return null;
}

function resolveDependencyPath(name) {
  for (const dir of DEP_DIRS) {
    try {
      return require.resolve(name, { paths: [dir] });
    } catch {
      continue;
    }
  }
  return null;
}

async function api(method, urlPath, body, idempotencyKey) {
  const headers = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function readDashboard(date) {
  const query = date ? `?date=${date}` : "";
  const { status, json } = await api("GET", `/api/v1/hq/dashboard${query}`);
  if (status !== 200 || !json?.data) throw new Error(`dashboard query failed: HTTP ${status}`);
  return json.data;
}

/** Seed ids the pilot store guarantees (`ensureSeed` in src/server/db/memory-store.ts). */
const SEED = {
  shiftId: "00000000-0000-7000-0000-000000000001",
  menuItemSiomayAyam: "00000000-0000-7000-0000-000000000101",
  menuItemSiomayCampur: "00000000-0000-7000-0000-000000000102",
  orStallId: process.env.VERIFY_STALL_ID ?? null,
};

function uuid(prefix) {
  const tail = `${prefix}${Date.now().toString(16)}`;
  return `0192f3a0-0000-7000-8000-${tail.padStart(12, "0").slice(-12)}`;
}

async function main() {
  console.log(`verifying ${BASE} (run ${RUN_ID})\n`);

  // ---- 1. baseline ------------------------------------------------------
  const before = await readDashboard();
  const beforeKpi = before.kpis.value;
  check(
    "dashboard query answers for the current business day",
    Boolean(before.businessDay),
    `businessDay=${before.businessDay}, outlets=${before.outlets.value.length}, freshness=${before.kpis.freshnessBand}`,
  );

  // ---- 2. create real records through the app's APIs --------------------
  const saleLines = [{ menuItemId: SEED.menuItemSiomayAyam, quantity: 1 }];
  const sale = await api("POST", "/api/v1/sales", {
    shiftId: SEED.shiftId,
    clientSaleId: `${RUN_ID}-sale`,
    lines: saleLines,
  }, `${RUN_ID}-sale`);
  check("POST /api/v1/sales accepted a real sale", sale.status === 201, `HTTP ${sale.status}`);
  if (sale.status !== 201) {
    console.error(sale.text.slice(0, 400));
    process.exit(1);
  }
  const saleId = sale.json.data.saleId;
  const saleTotal = sale.json.data.total.amountMinor;

  const cash = await api("POST", "/api/v1/payments/cash", {
    saleId,
    amount: { amountMinor: saleTotal, currency: "IDR" },
    cashReceived: { amountMinor: saleTotal + 5000, currency: "IDR" },
    clientPaymentId: uuid("21"),
  }, uuid("21"));
  check("cash payment completed the sale", cash.status === 201 && cash.json.status === "PAID", cash.json?.status ?? `HTTP ${cash.status}`);

  const digitalSale = await api("POST", "/api/v1/sales", {
    shiftId: SEED.shiftId,
    clientSaleId: `${RUN_ID}-sale-digital`,
    lines: [{ menuItemId: SEED.menuItemSiomayCampur, quantity: 2 }],
  }, `${RUN_ID}-sale-digital`);
  const digitalTotal = digitalSale.json.data.total.amountMinor;
  const digital = await api("POST", "/api/v1/payments/digital", {
    saleId: digitalSale.json.data.saleId,
    method: "QRIS_STATIC",
    amount: { amountMinor: digitalTotal, currency: "IDR" },
    clientPaymentId: uuid("22"),
  }, uuid("22"));
  check("digital payment lands as PENDING_VERIFICATION", digital.status === 201 && digital.json.status === "PENDING_VERIFICATION", digital.json?.status ?? `HTTP ${digital.status}`);

  const expenseAmount = 7000;
  const expense = await api("POST", "/api/v1/expenses", {
    shiftId: SEED.shiftId,
    categoryCode: "TRANSPORT",
    description: `${RUN_ID} ongkos angkut`,
    amountMinor: expenseAmount,
    currency: "IDR",
    paidFrom: "CASH_BOX",
    clientExpenseId: uuid("23"),
  }, uuid("23"));
  check("expense recorded", expense.status === 201, `HTTP ${expense.status}`);

  // ---- 3. the read model moved by exactly those amounts -----------------
  const after = await readDashboard();
  const afterKpi = after.kpis.value;
  const deltaSales = afterKpi.salesToday.amountMinor - beforeKpi.salesToday.amountMinor;
  check("sales KPI grew by exactly the recorded sale", deltaSales === saleTotal, `${beforeKpi.salesToday.amountMinor} → ${afterKpi.salesToday.amountMinor} (+${deltaSales}, expected +${saleTotal})`);
  check("transaction count grew by one", afterKpi.transactionCount === beforeKpi.transactionCount + 1, `${beforeKpi.transactionCount} → ${afterKpi.transactionCount}`);
  check(
    "expenses KPI grew by exactly the recorded expense",
    afterKpi.expenses.amountMinor - beforeKpi.expenses.amountMinor === expenseAmount,
    `+${afterKpi.expenses.amountMinor - beforeKpi.expenses.amountMinor}`,
  );
  check(
    "unverified digital grew by exactly the recorded digital payment",
    afterKpi.grossByMethod.digitalUnverified.amountMinor - beforeKpi.grossByMethod.digitalUnverified.amountMinor === digitalTotal,
    `+${afterKpi.grossByMethod.digitalUnverified.amountMinor - beforeKpi.grossByMethod.digitalUnverified.amountMinor}`,
  );
  check(
    "unverified digital is never merged into the headline figure",
    afterKpi.salesToday.amountMinor !==
      afterKpi.grossByMethod.cash.amountMinor + afterKpi.grossByMethod.digitalVerified.amountMinor + afterKpi.grossByMethod.digitalUnverified.amountMinor,
    `headline ${afterKpi.salesToday.amountMinor}, ways ${afterKpi.grossByMethod.cash.amountMinor}/${afterKpi.grossByMethod.digitalVerified.amountMinor}/${afterKpi.grossByMethod.digitalUnverified.amountMinor}`,
  );
  const trendTotal = after.salesTrend.value.points.reduce((sum, point) => sum + point.total.amountMinor, 0);
  check("trend points sum to the headline sales figure", trendTotal === afterKpi.salesToday.amountMinor, `trend ${trendTotal} vs KPI ${afterKpi.salesToday.amountMinor}`);
  check("activity feed contains the new events", after.recentActivity.value.length > before.recentActivity.value.length, `${before.recentActivity.value.length} → ${after.recentActivity.value.length}`);

  const emptyDay = await readDashboard("2026-09-01");
  check(
    "an activity-free day still answers with zeroes and valid outlet state",
    emptyDay.kpis.value.salesToday.amountMinor === 0 &&
      emptyDay.kpis.value.transactionCount === 0 &&
      emptyDay.kpis.value.averageTransaction === null &&
      emptyDay.outlets.value.length > 0,
    `outlets=${emptyDay.outlets.value.length}, sales=0`,
  );
  check("activity-free day has an empty feed", emptyDay.recentActivity.value.length === 0, `${emptyDay.recentActivity.value.length} entries`);

  const invalid = await api("GET", "/api/v1/hq/dashboard?date=2026-02-30");
  check("an impossible date is rejected, not guessed", invalid.status === 400 && invalid.json?.error?.code === "INVALID_FILTER", `HTTP ${invalid.status}`);
  const outOfScope = await api("GET", "/api/v1/hq/dashboard?outlet=00000000-0000-7000-0000-000000099");
  check("an out-of-scope outlet is rejected", outOfScope.status === 400 && outOfScope.json?.error?.code === "INVALID_FILTER", `HTTP ${outOfScope.status}`);
  check("error responses leak no internals", !/ECONNREFUSED|db\.json|\/home\/|at .*\.ts:\d/.test(invalid.text + outOfScope.text), "no stack/path/secret fragments");

  // ---- 4. browser -------------------------------------------------------
  const puppeteer = loadDependency("puppeteer-core");
  const chromium = loadDependency("@sparticuz/chromium");

  if (!puppeteer || !chromium) {
    skip("browser checks (rendering, filters, responsive, console)", "puppeteer-core/@sparticuz/chromium not installed — see HARNESS.md §3");
    return report();
  }

  extract(chromium, "al2023.tar.br", "/tmp/al2023");
  extract(chromium, "fonts.tar.br", "/tmp/fonts");
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:/tmp/al2023/lib64:${process.env.LD_LIBRARY_PATH ?? ""}`;
  process.env.FONTCONFIG_PATH = "/tmp/fonts";
  process.env.HOME = "/tmp";

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });

  const consoleMessages = [];
  const pageErrors = [];
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") consoleMessages.push(`${msg.type()}: ${msg.text().slice(0, 200)}`);
  });
  page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 200)));

  const render = async (url) => {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    return page.evaluate(() => document.body.innerText.replace(/\u00a0/g, " "));
  };
  const formatted = (minor) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(minor).replace(/\u00a0/g, " ");

  await page.setViewport({ width: 1440, height: 1000 });
  let body = await render(`${BASE}/hq`);
  check("browser renders the persisted sales KPI", body.includes(formatted(afterKpi.salesToday.amountMinor)), formatted(afterKpi.salesToday.amountMinor));
  check("browser renders the persisted expense KPI", body.includes(formatted(afterKpi.expenses.amountMinor)), formatted(afterKpi.expenses.amountMinor));
  check("browser renders the outlet row from persisted state", body.includes("ST-001"), "ST-001 present");
  check("browser renders the trend total", body.includes("Total grafik"), "trend card present");
  check("alert mapping renders Indonesian copy", body.includes("belum diverifikasi") || body.includes("Belum memulai operasional"), "alerts card present");
  check("activity mapping renders Indonesian copy", /mencatat (penjualan|pengeluaran|pembayaran)/.test(body), "activity feed present");
  const sampleValues = ["8.450.000", "1.275.000", "8 / 9", "Pending review: 0", "Lokasi aktif: 1"];
  const found = sampleValues.filter((value) => body.includes(value));
  check("no previous sample value is rendered", found.length === 0, found.join(", ") || "none");
  await page.screenshot({ path: `${OUT_DIR}/hq-1440.png` });

  // date filter round-trip
  await page.evaluate(() => {
    const input = document.querySelector('input[type="date"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "2026-09-01");
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => window.location.search.includes("date=2026-09-01"), { timeout: 30000 });
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 30000 }).catch(() => {});
  body = await page.evaluate(() => document.body.innerText.replace(/\u00a0/g, " "));
  check("date filter drives the server query", page.url().includes("date=2026-09-01"), page.url());
  check("empty day renders zeroes and empty messages", body.includes("Belum ada aktivitas operasional pada tanggal ini"), "empty states present");
  await page.screenshot({ path: `${OUT_DIR}/hq-empty-day-1440.png` });

  // outlet filter round-trip
  await render(`${BASE}/hq`);
  await page.evaluate(() => {
    const select = document.querySelector("select");
    const option = Array.from(select.options).find((o) => o.value !== "ALL");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    setter.call(select, option.value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => window.location.search.includes("outlet="), { timeout: 30000 });
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 30000 }).catch(() => {});
  body = await page.evaluate(() => document.body.innerText.replace(/\u00a0/g, " "));
  check("outlet filter drives the server query", page.url().includes("outlet="), page.url());
  check("outlet-scoped view states its scope", body.includes("outlet ST-"), "scope line present");

  // reload consistency
  const countBefore = body.split(formatted(afterKpi.salesToday.amountMinor)).length - 1;
  await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
  body = await page.evaluate(() => document.body.innerText.replace(/\u00a0/g, " "));
  const countAfter = body.split(formatted(afterKpi.salesToday.amountMinor)).length - 1;
  check("reload renders the same figures", countBefore === countAfter && countAfter > 0, `${countBefore} → ${countAfter} occurrences`);

  // responsive
  for (const width of [390, 768]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`${BASE}/hq`, { waitUntil: "networkidle2", timeout: 60000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const hasKpi = await page.evaluate(() => /penjualan hari ini/i.test(document.body.innerText));
    check(`renders at ${width}px without page overflow`, overflow <= 1 && hasKpi, `overflow=${overflow}px`);
    await page.screenshot({ path: `${OUT_DIR}/hq-${width}.png` });
  }

  check("no console errors or warnings", consoleMessages.length === 0, consoleMessages.slice(0, 3).join(" | ") || "clean");
  check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "clean");

  await browser.close();

  // persistence across a process restart is checked by the operator:
  //   stop the server, `node tools/verify-hq-dashboard.mjs` again, figures must be unchanged.
  fs.writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify({ runId: RUN_ID, base: BASE, checks }, null, 2));
  return report();
}

function extract(chromiumModule, archiveName, dest) {
  const entry = resolveDependencyPath("@sparticuz/chromium");
  const chromiumDir = entry ? path.dirname(entry) : path.dirname(require.resolve("@sparticuz/chromium"));
  const archive = path.join(chromiumDir, "bin", archiveName);
  if (!fs.existsSync(archive) || fs.existsSync(dest)) return;
  fs.mkdirSync(dest, { recursive: true });
  const tarPath = `/tmp/${archiveName}.tar`;
  fs.writeFileSync(tarPath, zlib.brotliDecompressSync(fs.readFileSync(archive)));
  execFileSync("tar", ["-xf", tarPath, "-C", dest]);
  fs.rmSync(tarPath, { force: true });
}

function report() {
  const skipped = checks.filter((c) => c.skipped).length;
  const passed = checks.filter((c) => c.passed).length;
  console.log(`\nCHECK SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped (of ${checks.length})`);
  if (skipped > 0) {
    console.log("A skipped check is not a passed check (HARNESS.md §1).");
    process.exit(2);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("verification crashed:", error);
  process.exit(2);
});
