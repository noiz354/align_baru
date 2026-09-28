#!/usr/bin/env node
/**
 * Capture the wave-3 evidence screenshots for yomi.
 *
 * The previous captures were taken with no database reachable, so the catalog rendered its
 * "unavailable" state and the reader-owned pages rendered bare headings — the screenshots
 * documented the failure modes rather than the product. This script takes a base URL that is
 * expected to have a migrated, seeded database, waits for the catalog to actually answer, and
 * refuses to write evidence that shows a degraded state without saying so.
 *
 * Capture against a PRODUCTION build, not `next dev`. Measured, not assumed: on Next 16.3.6 a
 * 404 raised by `notFound()` from inside a dynamic route returns an empty document under the dev
 * server, while the same request against `next build && next start` returns the real 404 page
 * (recorded in tests/e2e/catalog-journey.e2e.spec.ts). A dev-server capture therefore shows a
 * blank page that no reader would ever see, and the E2E 404 assertions fail against it.
 *
 * Usage:
 *   npm run build && npm run start -- --port 3199
 *   node MVP_AUDIT/screenshot-yomi.mjs http://127.0.0.1:3199
 *
 * `playwright-core` is resolved through the yomi workspace's own node_modules
 * rather than by bare specifier. This file sits at the repo root, which has no
 * node_modules at all, and Node resolves an ESM bare import relative to the
 * importing FILE — not the working directory — so the usage line above used to
 * fail with ERR_MODULE_NOT_FOUND no matter which directory it was run from.
 * Requiring the workspace package.json makes the documented invocation work and
 * states which project's dependency is being borrowed.
 *
 * Requires a reachable app (see HARNESS.md §3) with DATABASE_URL pointing at a migrated,
 * seeded PostgreSQL and STORAGE reachable. Nothing here is captured from a guessed state: each
 * page is fetched, the response status is recorded, and the file is written afterwards.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'screenshots', 'yomi');
const BASE = process.argv[2] ?? 'http://127.0.0.1:3199';

const YOMI_WORKSPACE = join(HERE, '..', 'yomi-manga-reader-arch-skeleton');
const require_ = createRequire(join(YOMI_WORKSPACE, 'package.json'));
const { chromium } = require_('playwright-core');

const PAGES = [
  { route: '/', file: '01-home.png', what: 'home — continue-reading section and catalog preview' },
  { route: '/discover', file: '02-discover.png', what: 'catalog — seeded grid with genre filters' },
  { route: '/manga/does-not-exist', file: '03-manga-404.png', what: 'unknown title — the 404 state' },
  { route: '/library', file: '04-library.png', what: 'library — not built, names its blocker' },
  { route: '/history', file: '05-history.png', what: 'history — not built, names its blocker' },
  { route: '/search', file: '06-search.png', what: 'search — not built, names its blocker' },
  { route: '/settings', file: '07-settings.png', what: 'settings — not built, names its blocker' },
  { route: '/auth/signin', file: '08-signin.png', what: 'sign in — not built, names its blocker' },
];

const SUSPICIOUS_TEXT_CHARS = 40;

const VIEWPORTS = [
  { suffix: '', width: 1440, height: 1000, name: 'desktop' },
  { suffix: '-mobile', width: 390, height: 844, name: 'mobile' },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  // A page that never settles is a capture that lies, so the console is watched and reported.
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
  });

  for (const target of PAGES) {
    // The mobile set only re-captures the landing and the catalog: a second copy of every
    // placeholder state is evidence of nothing new.
    if (viewport.suffix === '-mobile' && !['/', '/discover'].includes(target.route)) continue;

    const response = await page.goto(new URL(target.route, BASE).toString(), {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    const status = response?.status() ?? 0;
    const file = target.file.replace(/\.png$/, `${viewport.suffix}.png`);
    await page.screenshot({ path: join(OUT_DIR, file), fullPage: true });
    // A page that returns 404 but renders almost nothing is the dev-server signature noted
    // above; a screenshot of it looks like a product fault, so it is refused rather than filed.
    const textLength = (await page.locator('main').innerText().catch(() => '')).trim().length;
    const thin = textLength < SUSPICIOUS_TEXT_CHARS;
    results.push({ viewport: viewport.name, route: target.route, file, status, textLength, thin, what: target.what });
    console.log(
      `  ${viewport.name.padEnd(7)} ${target.route.padEnd(20)} ${status}  ` +
        `${String(textLength).padStart(5)} chars  ${file}${thin ? '  <-- THIN' : ''}`,
    );
  }

  if (consoleErrors.length) {
    console.log(`  console errors on ${viewport.name}:`);
    for (const e of [...new Set(consoleErrors)].slice(0, 5)) console.log(`    - ${e}`);
  }
  await context.close();
}

await browser.close();

const degraded = results.filter((r) => r.status >= 500);
const thin = results.filter((r) => r.thin);
if (degraded.length) {
  console.error(`\n${degraded.length} page(s) returned 5xx — the captures are not usable as evidence.`);
  process.exit(1);
}
if (thin.length) {
  console.error(
    `\n${thin.length} capture(s) rendered almost nothing. If the app is a dev server, that is the\n` +
      'known notFound() defect; build and start production before capturing.',
  );
  process.exit(1);
}
console.log(`\n${results.length} screenshots written to ${OUT_DIR}`);
