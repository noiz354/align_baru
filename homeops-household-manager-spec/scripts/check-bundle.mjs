#!/usr/bin/env node
// HomeOps — client bundle budget gate (T-PLAT-002 wiring, PERFORMANCE.md §2.2 PB-C1, §5 "Bundle
// size: build output check … fail CI over budget by >10%").
//
// Reads the *budget* from PERFORMANCE.md so the document stays authoritative, then measures the
// gzip size of each route's first-load JS from `.next/app-build-manifest.json`. Web-vitals budgets
// (PB-C2..C7) are measured with Playwright/Lighthouse from VS-4 (PERFORMANCE.md §5) — this gate is
// the part VS-0 can wire without a measurement backend.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NEXT_DIR = join(ROOT, '.next');
const TOLERANCE = 0.1; // fail when over budget by more than 10% (PERFORMANCE.md §5)

/** Routes whose first-load JS is budgeted, matched against the build manifest's route keys. */
const BUDGETED_ROUTES = ['/today'];

function fail(message) {
  console.error(`check-bundle: ${message}`);
  process.exit(1);
}

/* --------------------------------------------------------------------- budget from PERFORMANCE.md */

const performanceDoc = join(ROOT, 'PERFORMANCE.md');
if (!existsSync(performanceDoc)) fail('PERFORMANCE.md is missing — the budget source is gone');
const budgetRow = readFileSync(performanceDoc, 'utf8')
  .split('\n')
  .find((line) => line.startsWith('| PB-C1 '));
if (!budgetRow) fail('PERFORMANCE.md has no PB-C1 row');
const budgetMatch = budgetRow.match(/(\d+(?:\.\d+)?)\s*kB\s*gzip/);
if (!budgetMatch) fail(`PB-C1 does not state a gzip budget in kB: ${budgetRow.slice(0, 120)}`);
const BUDGET_BYTES = Math.round(Number.parseFloat(budgetMatch[1]) * 1024);

/* ------------------------------------------------------------------------- build output manifest */
//
// Next 16 builds with Turbopack and does not emit `app-build-manifest.json`; the per-route client
// chunk lists live in `.next/server/app/**/{page,layout}_client-reference-manifest.js`, and the
// framework runtime that every route loads is `rootMainFiles` + `polyfillFiles` in
// `.next/build-manifest.json`. First-load JS = shared runtime + the chunks of the route's own
// segment tree (root layout → group layout → page), which is what Next reports as "First Load JS".

const manifestPath = join(NEXT_DIR, 'build-manifest.json');
if (!existsSync(manifestPath)) fail('.next/build-manifest.json is missing — run `npm run build` first');
const buildManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const SHARED_FILES = [...(buildManifest.rootMainFiles ?? []), ...(buildManifest.polyfillFiles ?? [])];
if (SHARED_FILES.length === 0) fail('the build manifest lists no shared runtime chunks');

const SERVER_APP_DIR = join(NEXT_DIR, 'server/app');
if (!existsSync(SERVER_APP_DIR)) fail('.next/server/app is missing — run `npm run build` first');

function walkManifests(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    if (statSync(absolute).isDirectory()) walkManifests(absolute, out);
    else if (entry.endsWith('_client-reference-manifest.js')) out.push(absolute);
  }
  return out;
}

/** Evaluate a client-reference manifest: it assigns to `globalThis.__RSC_MANIFEST[key]`. */
function readManifestChunks(file) {
  const sandbox = {};
  // The manifest is our own build output, not user input.
  new Function('globalThis', readFileSync(file, 'utf8'))(sandbox);
  const entries = Object.values(sandbox.__RSC_MANIFEST ?? {});
  const chunks = new Set();
  for (const entry of entries) {
    for (const module of Object.values(entry.clientModules ?? {})) {
      for (const chunk of module.chunks ?? []) chunks.add(chunk);
    }
  }
  return [...chunks];
}

/** `app/(household)/today/page` → `/(household)/today/page`, i.e. the manifest's own route key. */
const routeKeyOf = (file) =>
  `/${relative(SERVER_APP_DIR, file)
    .replace(/\\/g, '/')
    .replace(/_(client-reference-manifest)\.js$/, '')
    .replace(/\/(page|layout)$/, '/$1')}`;

const manifests = walkManifests(SERVER_APP_DIR).map((file) => ({
  key: routeKeyOf(file),
  isPage: file.endsWith('page_client-reference-manifest.js'),
  chunks: readManifestChunks(file),
}));
if (manifests.length === 0) fail('the build output contains no client-reference manifests');

const pageManifests = manifests.filter((entry) => entry.isPage);

function gzipSize(file) {
  // Chunk paths in the manifests are public URLs (`/_next/static/...`); map them into `.next`.
  const relativePath = file.replace(/^\/_next\//, '').replace(/^\.next\//, '');
  const absolute = join(NEXT_DIR, relativePath);
  if (!existsSync(absolute)) return null;
  return gzipSync(readFileSync(absolute)).length;
}

/** Chunks of the segment tree above a page: root layout, group layouts, then the page itself. */
function segmentPrefixes(pageKey) {
  const segments = pageKey
    .replace(/\/page$/, '')
    .split('/')
    .filter(Boolean);
  const prefixes = ['/layout'];
  for (let index = 0; index < segments.length; index += 1) {
    prefixes.push(`/${segments.slice(0, index + 1).join('/')}/layout`);
  }
  prefixes.push(pageKey);
  return prefixes;
}

function measure(pageKey) {
  const wanted = new Set(segmentPrefixes(pageKey));
  const files = new Set(SHARED_FILES);
  for (const entry of manifests) {
    if (wanted.has(entry.key)) for (const chunk of entry.chunks) files.add(chunk);
  }
  const problems = [];
  let bytes = 0;
  for (const file of files) {
    const size = gzipSize(file);
    if (size === null) problems.push(`${pageKey}: manifest lists ${file}, which is not on disk`);
    else bytes += size;
  }
  return { bytes, files: files.size, problems };
}

const problems = [];
const rows = [];
for (const page of pageManifests) {
  const route = `/${page.key.replace(/^\//, '').replace(/\/page$/, '')}`;
  // Route groups are not part of the URL, and the root page's key is `/page`.
  const publicRoute = route.replace(/\([^)]*\)\//g, '').replace(/^\/page$/, '/');
  const measured = measure(page.key);
  problems.push(...measured.problems);
  rows.push({
    route: publicRoute,
    files: measured.files,
    bytes: measured.bytes,
    overBy: (measured.bytes - BUDGET_BYTES) / BUDGET_BYTES,
    budgeted: BUDGETED_ROUTES.includes(publicRoute),
  });
}

for (const route of BUDGETED_ROUTES) {
  if (!rows.some((row) => row.budgeted && row.route === route)) {
    problems.push(`route ${route} is budgeted by PB-C1 but is absent from the build output`);
  }
  for (const row of rows.filter(
    (entry) => entry.budgeted && entry.route === route && entry.overBy > TOLERANCE,
  )) {
    problems.push(
      `${route}: first-load JS is ${kb(row.bytes)} gzip, over the PB-C1 budget of ${kb(BUDGET_BYTES)} by ${(row.overBy * 100).toFixed(1)}% (> ${TOLERANCE * 100}% tolerance)`,
    );
  }
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

rows.sort((a, b) => b.bytes - a.bytes);
console.log(`check-bundle: PB-C1 budget ${kb(BUDGET_BYTES)} gzip per route, tolerance +${TOLERANCE * 100}%`);
for (const row of rows) {
  const flag = !row.budgeted ? 'info' : row.overBy > TOLERANCE ? 'FAIL' : row.overBy > 0 ? 'over' : 'ok';
  console.log(
    `  ${flag.padEnd(4)} ${row.route.padEnd(42)} ${kb(row.bytes).padStart(10)} (${row.files} file(s))`,
  );
}
console.log(
  `check-bundle: ${rows.length} route(s) measured; ${rows.filter((row) => row.budgeted).length} budgeted by PB-C1`,
);

if (problems.length > 0) {
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('check-bundle: within budget.');
