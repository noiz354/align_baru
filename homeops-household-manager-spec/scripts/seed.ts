#!/usr/bin/env tsx
// HomeOps — development seed CLI (T-PLAT-018, docs/testing/TEST-DATA.md §11).
//
// Refuses to run against anything that is not obviously a development database: the database name
// must contain `dev` or `test`, and a production-looking host is refused outright. Synthetic data
// only — see src/server/db/seed/fixtures.ts for the "rule zero" note.

import { seedDevelopmentData, describeSeededHouseholds } from '../src/server/db/seed/run';
import { PENDING_SEED_SECTIONS, looksLikeProductionHost } from '../src/server/db/seed/fixtures';
import { closeDb, isDatabaseConfigured } from '../src/server/db/client';

type Refusal = { readonly ok: false; readonly reason: string };
type Target = { readonly ok: true; readonly database: string; readonly host: string };

/** The guard is exported-shaped so the integration suite can test it without a database. */
export function inspectTarget(rawUrl: string | undefined): Refusal | Target {
  if (!rawUrl) return { ok: false, reason: 'DATABASE_URL is not set' };
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'DATABASE_URL is not a valid URL' };
  }
  const database = url.pathname.replace(/^\//, '');
  if (looksLikeProductionHost(url.hostname)) {
    return { ok: false, reason: `host "${url.hostname}" looks like production; seeding is refused` };
  }
  if (!/(^|[_-])(dev|test|local)([_-]|$)/.test(database) && !/(dev|test|local)/.test(database)) {
    return {
      ok: false,
      reason: `database "${database}" does not contain "dev" or "test"; seeding is refused`,
    };
  }
  return { ok: true, database, host: url.hostname };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const sections = args
    .filter((arg) => arg.startsWith('--section='))
    .flatMap((arg) => arg.slice('--section='.length).split(','))
    .filter((value) => value.length > 0);

  const target = inspectTarget(process.env.DATABASE_URL);
  if (!target.ok) {
    console.error(`seed: refused — ${target.reason}`);
    return 2;
  }
  if (!isDatabaseConfigured()) {
    console.error('seed: refused — the database client is not configured');
    return 2;
  }

  console.log(`seed: target ${target.database}@${target.host}`);
  console.log(
    `seed: sections requested — ${sections.length > 0 ? sections.join(', ') : '(identity & tenancy only)'}`,
  );
  for (const pending of PENDING_SEED_SECTIONS) {
    console.log(`seed: pending — ${pending.section} (${pending.owningTask}): ${pending.unlocks}`);
  }

  try {
    const result = await seedDevelopmentData(sections.length > 0 ? { sections } : {});
    console.log(
      `seed: users +${result.usersInserted}, households +${result.householdsInserted} ` +
        `(skipped ${result.householdsSkipped}), members +${result.membersInserted}, settings ${result.settingsUpserted}`,
    );
    for (const row of await describeSeededHouseholds()) {
      console.log(`seed:   ${row.name} — ${row.members} member(s)`);
    }
    return 0;
  } catch (error) {
    console.error(`seed: failed — ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await closeDb();
  }
}

process.exitCode = await main();
