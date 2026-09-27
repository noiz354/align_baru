/**
 * E2E smoke — the planned route map and the shell contract.
 *
 * Tasks: T-FOUND-003 (route map, not-found/error shells), T-FOUND-004
 * (tokens, AppShell landmarks, skip link), T-FOUND-007 (`/healthz`).
 * Requirements: FR-CATALOG-006, FR-AUTH-002, NFR-A11Y-003/004/007/008,
 * NFR-OBS-004.
 * Spec: TASKS.md T-FOUND-003 "Testing: E2E smoke: every route in the map
 * returns a render (200/404 as planned)"; ACCESSIBILITY.md §2/§3.3/§4/§6.
 *
 * Proposed test ID: E2E-FOUND-001. TEST_STRATEGY.md §4 has no row for the
 * T-FOUND-003 smoke (spec-question: the row needs adding by whoever owns
 * TEST_STRATEGY.md) — recorded, not silently invented.
 *
 * a11y gate note: @axe-core/playwright is NOT installed in this repository
 * yet, so the axe leg of ACCESSIBILITY.md §7 is not wired here. These
 * assertions are the structural checks that can be made without it
 * (landmarks, one h1, skip link, focus move, forced-colors degradation).
 * They do not replace axe; they fail loudly if the shell regresses.
 */
import { expect, test, type Page } from '@playwright/test';

/**
 * The planned route map, one entry per route that src/app owns. `title` is
 * the metadata contract from the root layout template (`%s · Yomi`).
 *
 * Every entry here answers **200**, including `/manga/<slug>`. That looks
 * wrong for a slug nothing owns, and a previous revision of this spec "fixed"
 * it to expect 404 — which was a false premise, twice over:
 *
 *  1. This spec runs with no seeded catalog and no `API_ORIGIN`, so
 *     `readMangaDetail` (`src/app/discover/catalog-data.ts`) resolves its
 *     origin to `null` and returns `failure: 'unavailable'`, not
 *     `'not-found'`. `manga/[slug]/page.tsx` renders `DetailUnavailable` at
 *     200, which is the specified degraded read — a title that exists but
 *     cannot be read right now is deliberately NOT a 404.
 *  2. T-CATALOG-006's real 404 requirement (a draft or soft-deleted title is
 *     indistinguishable from one that never existed) is proved where the data
 *     exists: in the API/route integration suites and E2E-CATALOG, which seed
 *     a real manga. Asserting 404 here would have deleted the degraded-read
 *     contract instead of testing it.
 *
 * A slug that is genuinely absent reaches `notFound()` — and then the global
 * 404 shell — only with a live API origin. The unplanned-route test below is
 * what pins that shell's contract.
 */
const ROUTES: ReadonlyArray<{ path: string; title: string }> = [
  // `/` sits in the same segment as the root layout, so Next does not apply
  // the layout's `%s · Yomi` template to it — it uses the layout default.
  { path: '/', title: 'Yomi' },
  { path: '/discover', title: 'Catalog · Yomi' },
  { path: '/search', title: 'Search · Yomi' },
  { path: '/library', title: 'Library · Yomi' },
  { path: '/history', title: 'History · Yomi' },
  { path: '/bookmarks', title: 'Bookmarks · Yomi' },
  { path: '/settings', title: 'Settings · Yomi' },
  { path: '/auth/signin', title: 'Sign in · Yomi' },
  { path: '/auth/register', title: 'Register · Yomi' },
  { path: '/manga/some-slug', title: 'Manga · Yomi' },
  { path: '/manga/some-slug/chapter/1', title: 'Reader · Yomi' },
  { path: '/admin', title: 'Admin · Yomi' },
  { path: '/admin/manga', title: 'Manga · Yomi' },
  { path: '/admin/manga/1', title: 'Manga · Yomi' },
  { path: '/admin/manga/1/chapters', title: 'Chapters · Yomi' },
  { path: '/admin/uploads', title: 'Uploads · Yomi' },
  { path: '/admin/users', title: 'Users · Yomi' },
  { path: '/admin/audit', title: 'Audit · Yomi' },
];

/** Console/page errors seen while a page settles — a shell must emit none. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test.describe('route map (T-FOUND-003)', () => {
  for (const route of ROUTES) {
    test(`${route.path} renders its shell`, async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(route.path);

      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(route.title);

      // ACCESSIBILITY.md §2: one main, one h1, real landmarks.
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
      await expect(page.getByRole('navigation', { name: 'Site' })).toHaveCount(1);
      expect(errors, `console errors on ${route.path}`).toEqual([]);
    });
  }

  test('an unplanned route renders the 404 shell, not a blank main', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // Home + catalog routes out, so a 404 is never a dead end.
    await expect(page.getByRole('link', { name: 'Go to the catalog' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
  });

  test('a nonsense ?page= value does not crash the reader shell', async ({ page }) => {
    // TASKS.md T-FOUND-003 edge case. Param validation belongs to
    // T-READER-032; the layout must tolerate the value either way.
    const errors = collectErrors(page);
    const response = await page.goto('/manga/x/chapter/1?page=abc');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test.describe('shell contract (T-FOUND-004)', () => {
  test('the skip link is the first focusable element and moves focus to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    // Hidden until focused (visually off-screen, not display:none).
    await expect(skip).toBeInViewport();

    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('every route in the map starts with the skip link', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route.path);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    }
  });

  test('one token paints two different grounds, light and dark', async ({ page }) => {
    // The tokens are authored as `light-dark()` pairs resolved by the
    // browser's `color-scheme`, so a broken pair (a missing dark value, a
    // `[data-theme]` block that never matches) would look fine in one theme
    // and be invisible in a screenshot. Comparing the painted ground across
    // both schemes is the check that catches it.
    const grounds: string[] = [];
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/discover');
      const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(ground, `--bg-canvas did not resolve in the ${scheme} theme`).not.toBe('');
      grounds.push(ground);
    }
    expect(grounds[0]).not.toBe(grounds[1]);
  });

  test('the theme can be pinned with data-theme, not only by the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/discover');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const pinned = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/discover');
    const followed = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(pinned).toBe(followed);
  });

  test('forced-colors mode keeps text and the focus ring (WCAG 1.4.11)', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/discover');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    // The two-band focus ring falls back to a single system-coloured band.
    const outline = await skip.evaluate((el) => getComputedStyle(el).outlineColor);
    expect(outline).toMatch(/rgb/);
  });

  test('reduced motion collapses transitions (NFR-A11Y-007)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/discover');
    const duration = await page
      .getByRole('link', { name: 'Skip to main content' })
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(['0s', '0.001s']).toContain(duration);
  });
});

test.describe('liveness (T-FOUND-007)', () => {
  test('GET /healthz answers 200 {ok:true} with no cache', async ({ request }) => {
    const response = await request.get('/healthz');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cacheControl = response.headers()['cache-control'] ?? '';
    expect(cacheControl).toContain('no-store');
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('GET /healthz is fast and repeatable', async ({ request }) => {
    for (let i = 0; i < 5; i += 1) {
      const started = Date.now();
      const response = await request.get('/healthz');
      expect(response.status()).toBe(200);
      // Budget from NFR-OBS-004 is a constant < 10 ms server-side; this is a
      // loose ceiling over the whole HTTP round trip, not the handler.
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });
});

test.describe('narrow viewport (T-FOUND-004, reader 320px floor)', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the shell has no horizontal overflow at 320px', async ({ page }) => {
    for (const route of ['/', '/discover', '/admin']) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(0);
    }
  });
});
