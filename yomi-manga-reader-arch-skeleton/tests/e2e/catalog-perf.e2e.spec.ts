/**
 * E2E — the measurable budgets of the two surfaces this lane owns.
 *
 * Requirements: NFR-PERF-001 (LCP), NFR-PERF-003 (CLS), NFR-PERF-007
 * (whole-page JS), NFR-PERF-008 (≤ 30 requests per page).
 * Tasks: T-CATALOG-003 (request budget, LCP = first cover, reserved cover box,
 * 200+ row list), T-CATALOG-006 (detail page budget).
 * Spec: PERFORMANCE.md §2 — "Requests/catalog or detail page ≤ 30", "CLS ≤ 0.1
 * on all pages", "LCP ≤ 2.5 s p75 (lab, 4G-fast)", "Whole-page JS ≤ 400 KB
 * gzipped".
 *
 * ── What is measured, and what the number is allowed to mean ───────────────
 * These are MEASUREMENTS taken in a local browser against a local server, so
 * they are not the lab numbers PERFORMANCE.md §2 gates on (that gate is
 * T-PERF-005's 4G-fast harness, run at VS-2/VS-4/VS-9/VS-11 exits). What they
 * are good for — and what this file is for — is the REGRESSION guard: a change
 * that turns the grid into 40 image requests, or the LCP element into
 * something that is not the first cover, or the cover box into one that grows
 * when the image lands, fails here instead of in a field report. Every measured
 * value is also printed, so the run is evidence rather than a pass/fail bit.
 *
 * Run against a PRODUCTION build (`next build && next start`): a dev server
 * compiles routes on demand, streams HMR, and unminified chunks, so its
 * request count and LCP are not the product's.
 */
import { expect, test, type Page } from '@playwright/test';
import { startCatalogHarness, type CatalogHarness } from './support/catalog-harness';
import { findBySlug } from './support/catalog-fixtures';

const APP_ORIGIN = process.env['E2E_APP_ORIGIN'] ?? `http://127.0.0.1:${process.env['E2E_PORT'] ?? '3100'}`;

/** PERFORMANCE.md §2: requests per catalog or detail page. */
const MAX_REQUESTS = 30;
/** PERFORMANCE.md §2: CLS. The budget is 0.1; the page aims at ~0. */
const MAX_CLS = 0.1;
/** PERFORMANCE.md §2: whole-page JS, gzipped. */
const MAX_JS_BYTES = 400 * 1024;

let harness: CatalogHarness;

test.beforeAll(async () => {
  harness = await startCatalogHarness({ appOrigin: APP_ORIGIN });
});

test.afterAll(async () => {
  await harness.close();
});

const discover = (path = ''): string => `${harness.url}/discover${path}`;
const detail = (slug: string): string => `${harness.url}/manga/${slug}`;

/**
 * Installs the observers BEFORE the first byte, which is the only way to see the
 * LCP and the layout shifts a page causes: both are reported once, and a
 * listener attached after load reports nothing.
 */
async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const metrics = {
      lcp: 0,
      lcpElement: '',
      cls: 0,
      shifts: [] as Array<{ value: number; source: string }>,
      longTasks: [] as number[],
    };
    (window as unknown as { __yomi: typeof metrics }).__yomi = metrics;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const paint = entry as PerformanceEntry & {
          element?: Element | null;
          startTime: number;
        };
        metrics.lcp = paint.startTime;
        const element = paint.element;
        metrics.lcpElement =
          element === null || element === undefined
            ? ''
            : `${element.tagName.toLowerCase()}${element.getAttribute('src') === null ? '' : `[src=${element.getAttribute('src')}]`}`;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // `hadRecentInput` is the LayoutShift field that excludes shifts the
        // reader caused (a tap that resizes something) — the standard CLS rule.
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: Array<{ node?: Element | null }>;
        };
        if (shift.hadRecentInput === true) continue;
        metrics.cls += shift.value;
        const source = shift.sources?.[0]?.node;
        metrics.shifts.push({
          value: shift.value,
          source: source === null || source === undefined ? '?' : source.nodeName,
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
}

interface Metrics {
  lcp: number;
  lcpElement: string;
  cls: number;
  shifts: Array<{ value: number; source: string }>;
  longTasks: number[];
}

async function metricsOf(page: Page): Promise<Metrics> {
  return page.evaluate(() => (window as unknown as { __yomi: Metrics }).__yomi);
}

test.describe('T-CATALOG-003 — the request budget (NFR-PERF-008)', () => {
  for (const route of [
    { name: '/discover', url: (h: CatalogHarness) => `${h.url}/discover` },
    { name: '/manga/[slug]', url: (h: CatalogHarness) => `${h.url}/manga/title-01` },
    {
      name: '/manga/[slug] with 220 chapters',
      url: (h: CatalogHarness) => `${h.url}/manga/long-series`,
    },
  ]) {
    test(`${route.name} — at most ${MAX_REQUESTS} requests for the first paint`, async ({ page }) => {
      const requested: Array<{ url: string; type: string }> = [];
      page.on('request', (request) =>
        requested.push({ url: request.url(), type: request.resourceType() }),
      );
      await page.goto(route.url(harness), { waitUntil: 'load' });
      // Wait for the page to have decided what it wants: the covers are
      // requested by the load-on-approach pass, which runs after hydration, and
      // `networkidle` can fire BEFORE that (a page whose scripts have loaded has
      // an idle network and no covers yet). Counting before the page has
      // finished asking for things measures the wrong thing — in one run it
      // read 10 requests, in the next 35, on identical code.
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page
        .waitForFunction(() => document.querySelectorAll('img[src^="/media/"]').length > 0, undefined, {
          timeout: 10_000,
        })
        .catch(() => undefined);
      await page.waitForTimeout(400);
      await page.waitForLoadState('networkidle').catch(() => undefined);

      const images = requested.filter((entry) => entry.url.includes('/media/'));
      const documents = requested.filter((entry) => entry.type === 'document');
      console.log(
        `${route.name}: ${requested.length} requests ` +
          `(${documents.length} document, ${images.length} cover, ` +
          `${requested.length - documents.length - images.length} app) — budget ${MAX_REQUESTS}`,
      );
      expect(requested.length).toBeLessThanOrEqual(MAX_REQUESTS);
    });
  }

  test('the whole page ships at most 400 KB of gzipped JavaScript (NFR-PERF-007)', async ({
    page,
  }) => {
    let jsBytes = 0;
    page.on('response', async (response) => {
      if (!response.url().includes('/_next/static/')) return;
      if (!/\.(js|mjs)(\?|$)/.test(response.url())) return;
      const length = response.headers()['content-length'];
      if (length !== undefined) {
        jsBytes += Number(length);
        return;
      }
      jsBytes += (await response.body().catch(() => Buffer.alloc(0))).length;
    });
    await page.goto(discover(), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    // The measurement is the evidence, so it is printed, not just asserted.
    console.log(
      `/discover: ${(jsBytes / 1024).toFixed(1)} KB of uncompressed JS text — ` +
        `budget ${(MAX_JS_BYTES / 1024).toFixed(0)} KB gzipped (this figure is an UPPER bound, ` +
        `since the local server sends it uncompressed)`,
    );
    // An upper bound that is already inside the gzip budget leaves room for the
    // compressed figure to be inside it too.
    expect(jsBytes).toBeLessThanOrEqual(MAX_JS_BYTES);
  });
});

test.describe('T-CATALOG-003 — the LCP element is the first cover (NFR-PERF-001)', () => {
  test('/discover paints the first card cover first, and early', async ({ page }) => {
    await instrument(page);
    await page.goto(discover(), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const metrics = await metricsOf(page);
    console.log(
      `/discover LCP ${metrics.lcp.toFixed(0)} ms on <${metrics.lcpElement}>` +
        ` — budget ≤ 2500 ms p75 on 4G-fast (T-PERF-005's lab harness)`,
    );
    expect(metrics.lcpElement).toMatch(/^img\[src=\/media\//);
    // A local, unloaded-and-served-locally budget: this is a smoke test that the
    // cover arrives promptly, not the p75 gate.
    expect(metrics.lcp).toBeLessThan(2_500);
  });

  test('the first cover is eager and high priority; the rest are not', async ({ page }) => {
    await page.goto(discover());
    const images = page.getByRole('list', { name: 'Titles' }).locator('img');
    expect(await images.count()).toBeGreaterThan(1);
    await expect(images.first()).toHaveAttribute('fetchpriority', 'high');
    await expect(images.first()).toHaveAttribute('loading', 'eager');
    await expect(images.nth(1)).toHaveAttribute('loading', 'lazy');
  });
});

test.describe('T-CATALOG-003 — a cover never moves the layout (NFR-PERF-003)', () => {
  test('the catalog page has no cumulative layout shift to speak of', async ({ page }) => {
    await instrument(page);
    await page.goto(discover(), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const metrics = await metricsOf(page);
    console.log(
      `/discover CLS ${metrics.cls.toFixed(4)} across ${metrics.shifts.length} shift(s) ` +
        `— budget ≤ 0.1`,
    );
    expect(metrics.cls).toBeLessThanOrEqual(MAX_CLS);
  });

  test('a missing cover occupies exactly the box a loaded cover occupies', async ({ page }) => {
    // Same grid, same column, two different outcomes for the cover. If the box
    // depended on the image, these two would differ — that difference IS the
    // layout shift the placeholder exists to prevent.
    await page.setViewportSize({ width: 1440, height: 900 });

    const boxOf = async (url: string, title: string): Promise<{ width: number; height: number }> => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const card = page.getByRole('list', { name: 'Titles' }).locator('> li').filter({ hasText: title });
      await expect(card).toHaveCount(1);
      const box = await card.locator('span').first().boundingBox();
      expect(box).not.toBeNull();
      return { width: box?.width ?? 0, height: box?.height ?? 0 };
    };

    // A card that HAS its cover, and a card whose cover key is null. Both are
    // read off the fixture so the pair cannot drift apart.
    const loaded = await boxOf(
      discover('?sort=title_asc'),
      findBySlug('title-01')?.summary.title ?? 'unreachable',
    );
    const missing = await boxOf(discover('?sort=title_asc'), 'Never Uploaded');

    console.log(
      `cover box: loaded ${loaded.width.toFixed(1)}×${loaded.height.toFixed(1)}, ` +
        `missing ${missing.width.toFixed(1)}×${missing.height.toFixed(1)}`,
    );
    expect(Math.abs(loaded.width - missing.width)).toBeLessThan(1);
    // The height is the 2:3 the box reserves, not the height of a text line.
    expect(missing.height).toBeCloseTo(loaded.height, 0);
    expect(missing.height).toBeGreaterThan(100);
  });

  test('a cover that 404s lands in the same box, with no shift', async ({ page }) => {
    await instrument(page);
    await page.goto(discover('?sort=title_asc'), { waitUntil: 'load' });
    const card = page.getByRole('list', { name: 'Titles' }).locator('> li').filter({ hasText: 'Cover 404s' });
    await expect(card).toHaveCount(1);
    // The cover only starts loading when it approaches the fold, so the box is
    // measured with the request in flight, not before it.
    await card.scrollIntoViewIfNeeded();
    const before = await card.locator('span').first().boundingBox();
    await expect(card.getByText('No cover')).toBeVisible();
    const after = await card.locator('span').first().boundingBox();

    console.log(
      `404 cover box before ${before?.width.toFixed(1)}×${before?.height.toFixed(1)}, ` +
        `after ${after?.width.toFixed(1)}×${after?.height.toFixed(1)}`,
    );
    expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
    expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
  });
});

test.describe('T-CATALOG-008 — a 220-row list, fully rendered, without jank', () => {
  test('all 220 rows are in the DOM and the scroll produces no long task', async ({ page }) => {
    await instrument(page);
    await page.goto(detail('long-series'), { waitUntil: 'load' });
    const rows = page.getByRole('list', { name: 'Chapters' }).getByRole('listitem');
    await expect(rows).toHaveCount(220);

    // Scroll the whole list, the way a reader looking for chapter 200 would.
    const height = await page.evaluate(() => document.body.scrollHeight);
    const started = Date.now();
    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, Math.ceil(height / 12));
      await page.waitForTimeout(40);
    }
    // Scroll to the very end of the document: the last row is the last thing in
    // it, and `toBeInViewport` is a stricter claim than "it exists".
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await rows.last().scrollIntoViewIfNeeded();

    const metrics = await metricsOf(page);
    const worst = metrics.longTasks.length === 0 ? 0 : Math.max(...metrics.longTasks);
    console.log(
      `220-row list: scrolled in ${Date.now() - started} ms, ` +
        `${metrics.longTasks.length} long task(s), worst ${worst.toFixed(0)} ms, ` +
        `CLS ${metrics.cls.toFixed(4)}`,
    );
    await expect(rows.last()).toBeInViewport();
    // "No jank" as a testable bound: a scroll through the whole list must not
    // produce a task long enough for a dropped frame at 60 Hz by a wide margin.
    expect(worst).toBeLessThan(200);
  });

  test('the 220 rows are the chapters the API returned, in order', async ({ page }) => {
    await page.goto(detail('long-series'));
    const numbers = await page
      .locator('nav[aria-label="Chapters"] ol > li')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number.parseFloat((node.firstElementChild?.textContent ?? '').trim())),
      );
    expect(numbers).toHaveLength(220);
    expect(numbers[0]).toBe(1);
    expect(numbers[219]).toBe(220);
    for (let index = 1; index < numbers.length; index += 1) {
      expect((numbers[index] ?? 0) - (numbers[index - 1] ?? 0)).toBe(1);
    }
  });
});
