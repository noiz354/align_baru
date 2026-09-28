#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || '');
process.env.FONTCONFIG_PATH = '/tmp/fonts';
process.env.HOME = '/tmp';
const execPath = '/tmp/chromium';
console.log('Chromium', execPath);
const browser = await puppeteer.launch({ executablePath: execPath, args: [...chromium.args], headless: 'shell' });

async function capture(base, route, file, desc) {
  const url = base + route;
  const dir = file.substring(0, file.lastIndexOf('/'));
  const { mkdirSync } = await import('fs');
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setBypassCSP(true);
  await page.setViewport({width:1440,height:1000});
  console.log(`→ ${url} → ${file} (${desc})`);
  try {
    await page.goto(url, {waitUntil:'networkidle2', timeout:15000});
    await new Promise(r=>setTimeout(r,2000));
    await page.screenshot({path: file, fullPage:true});
    const content = await page.content();
    if (content.includes('Not implemented')) console.log('  ⚠ Not implemented');
    if (content.includes('The catalog is unavailable')) console.log('  ⚠ Catalog unavailable');
    if (content.includes('We cannot find that page')) console.log('  ⚠ NotFound');
    if (content.length < 5000) console.log(`  ⚠ short content ${content.length}`);
    console.log('  ✓ saved');
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    try { await page.screenshot({path:file, fullPage:true}); console.log('  retry saved'); } catch(e2){ console.log(' retry fail', e2.message)}
  }
  await page.close();
}

// Re-capture strangerlink with bypass
await capture('http://localhost:3105','/','/home/user/align_baru/MVP_AUDIT/screenshots/strangerlink/01-landing.png','landing');
await capture('http://localhost:3105','/start','/home/user/align_baru/MVP_AUDIT/screenshots/strangerlink/02-start-age-gate.png','age gate');
await capture('http://localhost:3105','/queue','/home/user/align_baru/MVP_AUDIT/screenshots/strangerlink/03-queue.png','queue');
await capture('http://localhost:3105','/chat/test','/home/user/align_baru/MVP_AUDIT/screenshots/strangerlink/04-chat.png','chat');
await capture('http://localhost:3105','/safety','/home/user/align_baru/MVP_AUDIT/screenshots/strangerlink/05-safety.png','safety');

// Majelishub - need to ensure it's running
await capture('http://localhost:3102','/','/home/user/align_baru/MVP_AUDIT/screenshots/majelishub/01-home.png','home');
await capture('http://localhost:3102','/kajian','/home/user/align_baru/MVP_AUDIT/screenshots/majelishub/02-kajian.png','kajian list fallback');
await capture('http://localhost:3102','/masjid','/home/user/align_baru/MVP_AUDIT/screenshots/majelishub/03-masjid.png','masjid');
// Also retry homeops with bypass to confirm skeleton
await capture('http://localhost:3101','/sign-in','/home/user/align_baru/MVP_AUDIT/screenshots/homeops/02-sign-in.png','sign-in recheck');
await capture('http://localhost:3101','/today','/home/user/align_baru/MVP_AUDIT/screenshots/homeops/03-today.png','today recheck');

await browser.close();
console.log('done');
