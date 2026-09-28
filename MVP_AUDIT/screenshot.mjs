#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const execPath = '/tmp/chromium'; // pre-inflated
// ensure libs extracted
process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || '');
process.env.FONTCONFIG_PATH = '/tmp/fonts';
process.env.HOME = '/tmp';

console.log('Chromium executable:', execPath);
console.log('Chromium args:', chromium.args.slice(0,3));
console.log('LD_LIBRARY_PATH:', process.env.LD_LIBRARY_PATH);

const browser = await puppeteer.launch({
  executablePath: execPath,
  args: [...chromium.args],
  headless: 'shell',
  defaultViewport: { width: 1440, height: 1000 },
});

const projects = [
  { name: 'homeops', base: 'http://localhost:3101', pages: [
    { route: '/', file: '01-root-redirect.png', desc: 'root redirect to sign-in' },
    { route: '/sign-in', file: '02-sign-in.png', desc: 'sign-in page' },
    { route: '/today', file: '03-today.png', desc: 'today dashboard (requires auth)' },
    { route: '/chores', file: '04-chores.png', desc: 'chores list' },
    { route: '/rooms', file: '05-rooms.png', desc: 'rooms' },
    { route: '/issues', file: '06-issues.png', desc: 'issues' },
    { route: '/resources', file: '07-resources.png', desc: 'resources' },
    { route: '/maintenance', file: '08-maintenance.png', desc: 'maintenance' },
    { route: '/settings/members', file: '09-members.png', desc: 'members settings' },
  ]},
  { name: 'majelishub', base: 'http://localhost:3102', pages: [
    { route: '/', file: '01-home.png', desc: 'home' },
  ]},
  { name: 'yomi', base: 'http://localhost:3103', pages: [
    { route: '/', file: '01-home.png', desc: 'home catalog preview' },
    { route: '/discover', file: '02-discover.png', desc: 'discover catalog' },
    { route: '/manga/sample-notfound', file: '03-manga-404.png', desc: 'manga detail (expected missing without seed)' },
    { route: '/library', file: '04-library.png', desc: 'library' },
    { route: '/history', file: '05-history.png', desc: 'history' },
    { route: '/search', file: '06-search.png', desc: 'search' },
  ]},
  { name: 'minimal', base: 'http://localhost:3104', pages: [
    { route: '/', file: '01-home.png', desc: 'home - licensed manga reader' },
    { route: '/discover', file: '02-discover.png', desc: 'discover catalog with sample manga' },
    { route: '/manga/sample-manga/chapter/1', file: '03-reader-ch1.png', desc: 'chapter 1 reader' },
    { route: '/manga/sample-manga/chapter/1?mode=double', file: '04-reader-double.png', desc: 'double mode' },
  ]},
  { name: 'strangerlink', base: 'http://localhost:3105', pages: [
    { route: '/', file: '01-landing.png', desc: 'landing' },
    { route: '/start', file: '02-start-age-gate.png', desc: 'age gate + safety notice + mode selection' },
    { route: '/queue', file: '03-queue.png', desc: 'queue/matchmaking' },
    { route: '/chat/test', file: '04-chat.png', desc: 'chat session' },
    { route: '/safety', file: '05-safety.png', desc: 'safety page' },
  ]},
  { name: 'siomayops', base: 'http://localhost:3106', pages: [
    { route: '/', file: '01-home.png', desc: 'home HQ' },
    { route: '/sell', file: '02-sell.png', desc: 'sell POS - menu cart' },
    { route: '/stock', file: '03-stock.png', desc: 'stock inventory' },
    { route: '/shift', file: '04-shift.png', desc: 'shift' },
    { route: '/expenses', file: '05-expenses.png', desc: 'expenses' },
    { route: '/hq', file: '06-hq.png', desc: 'HQ dashboard' },
    { route: '/locations', file: '07-locations.png', desc: 'locations' },
  ]},
];

for (const proj of projects) {
  const dir = join('/home/user/align_baru/MVP_AUDIT/screenshots', proj.name);
  mkdirSync(dir, { recursive: true });
  console.log(`\n=== ${proj.name} @ ${proj.base} ===`);
  for (const page of proj.pages) {
    const url = proj.base + page.route;
    const filePath = join(dir, page.file);
    try {
      const pg = await browser.newPage();
      await pg.setViewport({ width: 1440, height: 1000 });
      console.log(`→ ${url} → ${page.file}`);
      await pg.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      // wait a bit for hydration
      await new Promise(r => setTimeout(r, 1500));
      await pg.screenshot({ path: filePath, fullPage: true });
      console.log(`  ✓ saved ${filePath}`);
      const title = await pg.title().catch(()=> '');
      const content = await pg.content();
      // quick check for "Not implemented" or error
      if (content.includes('Not implemented')) console.log(`  ⚠ Contains "Not implemented"`);
      if (content.includes('We cannot find that page')) console.log(`  ⚠ Not-found page`);
      if (content.includes('Application error')) console.log(`  ⚠ Application error`);
      await pg.close();
    } catch (e) {
      console.error(`  ✗ failed ${url}: ${e.message}`);
      try {
        const pg2 = await browser.newPage();
        await pg2.setViewport({ width: 1440, height: 1000 });
        await pg2.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r=>setTimeout(r,1000));
        await pg2.screenshot({ path: filePath, fullPage: true });
        console.log(`  ✓ retry saved ${filePath}`);
        await pg2.close();
      } catch (e2) {
        console.error(`  ✗ retry failed: ${e2.message}`);
      }
    }
  }
  // mobile capture for one important page
  try {
    const mobilePage = proj.pages[0];
    const pg = await browser.newPage();
    await pg.setViewport({ width: 390, height: 844 });
    const url = proj.base + mobilePage.route;
    console.log(`→ mobile ${url} → mobile-${mobilePage.file}`);
    await pg.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));
    const dir = join('/home/user/align_baru/MVP_AUDIT/screenshots', proj.name);
    await pg.screenshot({ path: join(dir, `mobile-${mobilePage.file}`), fullPage: true });
    await pg.close();
    console.log(`  ✓ mobile saved`);
  } catch (e) {
    console.error(`  ✗ mobile failed: ${e.message}`);
  }
}

await browser.close();
console.log('\nDone');
