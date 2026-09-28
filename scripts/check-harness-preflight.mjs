#!/usr/bin/env node
/**
 * check-harness-preflight — what can this machine actually run right now?
 *
 * Why this exists
 * ---------------
 * The sandbox audit in MVP_AUDIT/RUNTIME_COMMANDS.md was written by hand, on one
 * machine, on one day. It recorded facts that will silently rot: which Node version
 * was actually present, whether the Playwright CDN was reachable, whether a lockfile
 * existed, how much memory was free. A reader six weeks later cannot tell which parts
 * of that document still hold.
 *
 * So this script does not encode the audit's answers. It probes. Every row in its
 * output was measured a moment ago on this machine, and each one carries the reason
 * for its status so a reader can judge it rather than trust it.
 *
 * The three rules it follows
 * --------------------------
 * 1. SKIPPED is not PASSED. A capability that cannot run is reported as unavailable
 *    with the reason, never folded into a green summary.
 * 2. Derive, do not hardcode. Node requirements are read from each project's own
 *    package.json `engines`, so this file cannot go stale when a project changes.
 * 3. A warning does not fail the build, but it is never hidden. The sandbox runs
 *    Node 22 against projects that ask for >=24 and they boot, so an engines
 *    mismatch is reported as a warning with that evidence attached.
 *
 * Usage
 * -----
 *   node scripts/check-harness-preflight.mjs
 *   node scripts/check-harness-preflight.mjs --json
 *   node scripts/check-harness-preflight.mjs --project yomi-manga-reader-arch-skeleton
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cpus, totalmem, freemem, platform, arch, tmpdir } from 'node:os';
import { connect } from 'node:net';
import { execFileSync } from 'node:child_process';
import { request } from 'node:https';

const REPO_ROOT = new URL('..', import.meta.url).pathname;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const projectFilterIndex = args.indexOf('--project');
const projectFilter = projectFilterIndex !== -1 ? args[projectFilterIndex + 1] : null;

const OK = 'OK';
const WARN = 'WARN';
const FAIL = 'FAIL';
const ABSENT = 'ABSENT';

const rows = [];
function record(scope, check, status, detail) {
  rows.push({ scope, check, status, detail });
}

/* ------------------------------------------------------------------ helpers */

function findProjects() {
  const projects = [];
  for (const entry of readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = join(REPO_ROOT, entry.name);
    const hasPackageJson = existsSync(join(dir, 'package.json'));
    const hasPyproject = existsSync(join(dir, 'pyproject.toml'));
    if (!hasPackageJson && !hasPyproject) continue;
    projects.push({
      name: entry.name,
      kind: hasPackageJson ? 'node' : 'python',
      dir,
    });
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Extract the minimum Node major from a range like ">=24 <25". */
function minimumNodeMajor(range) {
  const match = />=\s*(\d+)/.exec(String(range));
  return match ? parseInt(match[1], 10) : null;
}

function directorySizeMb(dir) {
  let total = 0;
  const walk = (d, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === '.next') continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else {
        try {
          total += statSync(full).size;
        } catch {
          /* raced away */
        }
      }
    }
  };
  walk(dir, 0);
  return Math.round(total / (1024 * 1024));
}

/** Probe a TCP port without hanging: a refused connection is instant and decisive. */
function probePort(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (reachable, reason) => {
      socket.destroy();
      resolve({ reachable, reason });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true, 'accepted'));
    socket.once('timeout', () => done(false, 'timed out'));
    socket.once('error', (error) =>
      done(false, error.code === 'ECONNREFUSED' ? 'connection refused — nothing listening' : error.code ?? 'error'),
    );
  });
}

/** HEAD a URL with a hard timeout. Used only to characterise reachability. */
function probeUrl(url, timeoutMs = 2500) {
  const parsed = new URL(url);
  return new Promise((resolve) => {
    const req = request(
      { host: parsed.hostname, path: parsed.pathname, method: 'HEAD', timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve({ reachable: true, reason: `HTTP ${res.statusCode}` });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ reachable: false, reason: 'timed out' });
    });
    req.on('error', (error) => resolve({ reachable: false, reason: error.code ?? 'error' }));
    req.end();
  });
}

/* ------------------------------------------------------------------ machine */

async function checkMachine() {
  const nodeVersion = process.versions.node;
  record('machine', 'node', OK, `v${nodeVersion} (${process.platform} ${arch()})`);
  record('machine', 'cpus', cpus().length >= 4 ? OK : WARN, `${cpus().length} logical`);

  const freeMb = Math.round(freemem() / (1024 * 1024));
  const totalMb = Math.round(totalmem() / (1024 * 1024));
  // Next.js dev plus a Playwright browser is the heaviest thing here. Under ~1.5 GB
  // free, a dev server and a browser will fight over memory and the failure looks like
  // a product bug, so this is worth a warning rather than a shrug.
  const memoryStatus = freeMb < 768 ? FAIL : freeMb < 1536 ? WARN : OK;
  record(
    'machine',
    'memory-free',
    memoryStatus,
    `${freeMb} MB free of ${totalMb} MB${freeMb < 1536 ? ' — thin for dev server + browser' : ''}`,
  );

  const home = process.env.HOME ?? '(unset)';
  if (home === '/tmp') {
    record(
      'machine',
      'HOME',
      WARN,
      'HOME=/tmp — tool caches and credential lookups will not persist between runs',
    );
  } else {
    record('machine', 'HOME', OK, home);
  }

  // A real probe, because whether a Docker socket exists changes which gates are even
  // expressible here. Not an assumption dressed up as a check.
  const dockerSocket = '/var/run/docker.sock';
  const dockerCli = ['docker', 'podman'].find((bin) => {
    try {
      execFileSync('which', [bin], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });
  const hasSocket = existsSync(dockerSocket);
  if (hasSocket || dockerCli) {
    record('machine', 'container-runtime', OK, `${dockerCli ?? 'docker'} present (socket ${hasSocket ? 'found' : 'not found'})`);
  } else {
    record(
      'machine',
      'container-runtime',
      ABSENT,
      'no docker socket and no docker/podman binary — Docker-based gates cannot run here',
    );
  }
}

/* ------------------------------------------------------------------ browser */

async function checkBrowser() {
  const candidates = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(process.env.HOME ?? tmpdir(), '.cache', 'ms-playwright'),
    join(tmpdir(), 'ms-playwright'),
  ].filter(Boolean);

  let found = null;
  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      found = dir;
      break;
    }
  }

  if (found) {
    const sizeMb = directorySizeMb(found);
    record('browser', 'playwright-cache', OK, `${found} (${sizeMb} MB)`);
  } else {
    record(
      'browser',
      'playwright-cache',
      ABSENT,
      `not found in ${candidates.join(' or ')} — E2E cannot run until installed`,
    );
  }

  // The audit recorded the Playwright CDN and apt as unreachable from the sandbox while
  // the npm registry stayed reachable. That shapes browser acquisition, so it is probed
  // rather than assumed — and it is a network characterisation, not a gate.
  const registry = await probeUrl('https://registry.npmjs.org/');
  record(
    'browser',
    'npm-registry',
    registry.reachable ? OK : FAIL,
    registry.reachable
      ? `reachable (${registry.reason}) — npm-based installs available`
      : `UNREACHABLE (${registry.reason}) — no installs, no gates that need packages`,
  );

  const cdn = await probeUrl('https://cdn.playwright.dev/');
  record(
    'browser',
    'playwright-cdn',
    cdn.reachable ? OK : WARN,
    cdn.reachable
      ? `reachable (${cdn.reason}) — npx playwright install can fetch browsers`
      : `unreachable (${cdn.reason}) — "playwright install" will fail; use a registry-sourced browser`,
  );
}

/* ----------------------------------------------------------------- services */

async function checkServices() {
  const services = [
    { name: 'postgres', host: '127.0.0.1', port: 5432, neededFor: 'drizzle migrations, seed, real-PG integration' },
    { name: 'redis', host: '127.0.0.1', port: 6379, neededFor: 'rate-limit store (majelishub, homeops)' },
    { name: 's3/rustfs', host: '127.0.0.1', port: 9000, neededFor: 'object storage (yomi S3 adapter)' },
  ];

  for (const service of services) {
    const result = await probePort(service.host, service.port);
    record(
      'service',
      service.name,
      result.reachable ? OK : ABSENT,
      result.reachable
        ? `listening on ${service.port} (${service.neededFor})`
        : `nothing on ${service.port} (${result.reason}) — ${service.neededFor} must be skipped or use a fallback`,
    );
  }
}

/* ----------------------------------------------------------------- projects */

async function checkProjects() {
  const projects = findProjects().filter((p) => !projectFilter || p.name === projectFilter);

  for (const project of projects) {
    if (project.kind === 'node') {
      const manifest = readJson(join(project.dir, 'package.json'));
      if (!manifest) {
        record(project.name, 'package.json', FAIL, 'present but unparseable');
        continue;
      }

      const hasLock = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].some((f) =>
        existsSync(join(project.dir, f)),
      );
      record(
        project.name,
        'lockfile',
        hasLock ? OK : WARN,
        hasLock
          ? 'present — install is reproducible'
          : 'ABSENT — npm install will resolve fresh versions on every run',
      );

      const required = minimumNodeMajor(manifest.engines?.node);
      const running = parseInt(process.versions.node.split('.')[0], 10);
      if (required === null) {
        record(project.name, 'engines', OK, 'no engines field declared');
      } else if (running >= required) {
        record(project.name, 'engines', OK, `node ${running} satisfies ${manifest.engines.node}`);
      } else {
        // Recorded as a warning with the sandbox evidence attached, because the audit
        // shows these projects boot on the older Node with only an npm warning.
        record(
          project.name,
          'engines',
          WARN,
          `running node ${running}, package asks ${manifest.engines.node} — audit shows it boots with a warning`,
        );
      }

      const scripts = Object.keys(manifest.scripts ?? {});
      const hasUnit = scripts.some((s) => /^test(:unit)?$/.test(s));
      const hasE2e = scripts.some((s) => /e2e/.test(s));
      const hasBuild = scripts.includes('build');
      record(
        project.name,
        'scripts',
        hasUnit ? OK : WARN,
        [
          hasUnit ? 'test' : 'NO test script',
          hasE2e ? 'e2e' : 'no e2e',
          hasBuild ? 'build' : 'no build',
        ].join(', '),
      );

      const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
      const pglite = '@electric-sql/pglite' in deps;
      record(
        project.name,
        'db-fallback',
        pglite ? OK : ABSENT,
        pglite
          ? '@electric-sql/pglite present — in-process Postgres, no Docker needed'
          : 'no in-process Postgres — persistence tests need a real database or must skip',
      );

      const sizeMb = directorySizeMb(project.dir);
      record(
        project.name,
        'size',
        sizeMb > 200 ? WARN : OK,
        `${sizeMb} MB tracked (excluding .next)${sizeMb > 200 ? ' — heavy for a tight sandbox' : ''}`,
      );
    } else {
      const hasNodeModules = existsSync(join(project.dir, 'node_modules'));
      record(
        project.name,
        'install',
        OK,
        'python stdlib only — no install step',
      );
      if (hasNodeModules) {
        record(project.name, 'node_modules', WARN, 'present in a stdlib-only project — dead weight');
      }
      record(project.name, 'size', OK, `${directorySizeMb(project.dir)} MB tracked`);
    }
  }
}

/* -------------------------------------------------------------------- output */

async function main() {
  await checkMachine();
  await checkBrowser();
  await checkServices();
  await checkProjects();

  const failures = rows.filter((r) => r.status === FAIL);
  const warnings = rows.filter((r) => r.status === WARN);

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        { node: process.versions.node, failures: failures.length, warnings: warnings.length, rows },
        null,
        2,
      )}\n`,
    );
    process.exit(failures.length > 0 ? 1 : 0);
  }

  const width = Math.max(...rows.map((r) => `${r.scope} / ${r.check}`.length), 24);
  console.log('check-harness-preflight — measured on this machine, just now\n');
  let lastScope = null;
  for (const row of rows) {
    if (row.scope !== lastScope) {
      console.log(`\n[${row.scope}]`);
      lastScope = row.scope;
    }
    const label = `${row.scope} / ${row.check}`.padEnd(width);
    console.log(`  ${row.status.padEnd(6)} ${label}  ${row.detail}`);
  }

  const absent = rows.filter((r) => r.status === ABSENT);
  console.log(
    `\n${rows.length} checks — ${failures.length} FAIL, ${warnings.length} WARN, ${absent.length} unavailable.`,
  );
  if (absent.length) {
    console.log(
      `${absent.length} capability/capabilities are UNAVAILABLE here. Anything depending on\n` +
        'them must report as skipped-with-reason, never as passing.',
    );
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
