#!/usr/bin/env node
// Deterministic wave2 seed for HomeOps: Rumah Demo (Budi/Sari, 3 rooms, 5 chores overdue/today×2/tomorrow/later)
// Mirrors yomi/majelishub wave2: PGlite file-backed, raw SQL inserts, rerunnable ON CONFLICT, no RLS bypass needed.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL || 'pglite:///tmp/homeops-pglite';

const HOUSEHOLD_ID = '594f4d49-3333-3333-3333-333333333333';
const MEMBER_BUDI_ID = '594f4d49-3333-3333-3333-333333333334';
const MEMBER_SARI_ID = '594f4d49-3333-3333-3333-333333333335';
const USER_BUDI_ID = 'user-budi-homeops';
const USER_SARI_ID = 'user-sari-homeops';

const ROOMS = [
  { id: '594f4d49-4444-1111-4444-444444444444', name: 'Dapur', sortOrder: 0 },
  { id: '594f4d49-4444-2222-4444-444444444444', name: 'Ruang Tamu', sortOrder: 1 },
  { id: '594f4d49-4444-3333-4444-444444444444', name: 'Kamar Utama', sortOrder: 2 },
];

const CHORES = [
  { id: '594f4d49-5555-1111-5555-555555555555', title: 'Bersihkan Dapur', dueOn: '2026-09-27', roomId: ROOMS[0].id, assignee: MEMBER_BUDI_ID, key: 'Bersihkan Dapur:2026-09-27' }, // overdue
  { id: '594f4d49-5555-2222-5555-555555555555', title: 'Sapu Ruang Tamu', dueOn: '2026-09-28', roomId: ROOMS[1].id, assignee: MEMBER_SARI_ID, key: 'Sapu Ruang Tamu:2026-09-28' },
  { id: '594f4d49-5555-3333-5555-555555555555', title: 'Rapikan Kamar Utama', dueOn: '2026-09-28', roomId: ROOMS[2].id, assignee: MEMBER_BUDI_ID, key: 'Rapikan Kamar Utama:2026-09-28' },
  { id: '594f4d49-5555-4444-5555-555555555555', title: 'Cuci Piring', dueOn: '2026-09-29', roomId: ROOMS[0].id, assignee: MEMBER_SARI_ID, key: 'Cuci Piring:2026-09-29' },
  { id: '594f4d49-5555-5555-5555-555555555555', title: 'Ganti Sprei', dueOn: '2026-10-03', roomId: ROOMS[2].id, assignee: MEMBER_BUDI_ID, key: 'Ganti Sprei:2026-10-03' },
];

async function ensureTablesWithPglite(pglite) {
  const dir = join(import.meta.dirname ? import.meta.dirname : '.', '..', 'migrations');
  // fallback: try relative to cwd
  const tryDirs = [join(process.cwd(), 'migrations'), dir];
  for (const d of tryDirs) {
    try {
      const files = (await readdir(d)).filter((f) => f.endsWith('.sql')).sort();
      if (files.length === 0) continue;
      for (const f of files) {
        const sql = await readFile(join(d, f), 'utf8');
        try {
          await pglite.exec(sql);
        } catch (e) {
          const msg = String(e?.message ?? e);
          // ignore already exists
          if (msg.includes('already exists') || msg.includes('duplicate key')) {
            continue;
          }
          throw e;
        }
      }
      return;
    } catch {}
  }
  throw new Error('no migrations found');
}

async function main() {
  const url = DATABASE_URL;
  const isPglite = url.startsWith('pglite://') || url.startsWith('file:') || url.includes('/tmp/');
  if (!isPglite) {
    throw new Error('This seed expects pglite:// URL for wave2 dev (got ' + url + ')');
  }
  const path = url.replace(/^pglite:\/\//, '').replace(/^file:\/\//, '') || '/tmp/homeops-pglite';
  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = new PGlite(path);
  await ensureTablesWithPglite(pglite);

  // Users: insert ON CONFLICT
  await pglite.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1,$2,$3,true,now(),now()) ON CONFLICT (id) DO NOTHING`, [USER_BUDI_ID, 'Budi', 'budi@rumah.demo.test']);
  await pglite.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1,$2,$3,true,now(),now()) ON CONFLICT (id) DO NOTHING`, [USER_SARI_ID, 'Sari', 'sari@rumah.demo.test']);

  // Household
  await pglite.query(`INSERT INTO household (id, name, timezone, week_starts_on, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [HOUSEHOLD_ID, 'Rumah Demo', 'Asia/Jakarta', 'MONDAY', USER_BUDI_ID]);

  // Household settings
  await pglite.query(`INSERT INTO household_settings (household_id) VALUES ($1) ON CONFLICT (household_id) DO NOTHING`, [HOUSEHOLD_ID]);

  // Members
  await pglite.query(`INSERT INTO household_member (id, household_id, user_id, display_name, role) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [MEMBER_BUDI_ID, HOUSEHOLD_ID, USER_BUDI_ID, 'Budi', 'ADMIN']);
  await pglite.query(`INSERT INTO household_member (id, household_id, user_id, display_name, role) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [MEMBER_SARI_ID, HOUSEHOLD_ID, USER_SARI_ID, 'Sari', 'MEMBER']);

  // update household.created_by_member_id
  await pglite.query(`UPDATE household SET created_by_member_id = $2 WHERE id = $1 AND created_by_member_id IS NULL`, [HOUSEHOLD_ID, MEMBER_BUDI_ID]);

  // Rooms
  for (const r of ROOMS) {
    await pglite.query(`INSERT INTO room (id, household_id, name, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`, [r.id, HOUSEHOLD_ID, r.name, r.sortOrder]);
  }

  // Chore occurrences: need chore_definition maybe not required, but we can insert occurrences directly
  for (const c of CHORES) {
    await pglite.query(
      `INSERT INTO chore_occurrence (id, household_id, occurrence_key, title_snapshot, room_id_snapshot, due_on, status, assignee_member_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [c.id, HOUSEHOLD_ID, c.key, c.title, c.roomId, c.dueOn, 'OPEN', c.assignee],
    );
  }

  // Verify
  const rooms = await pglite.query(`SELECT count(*)::int as n FROM room WHERE household_id = $1`, [HOUSEHOLD_ID]);
  const chores = await pglite.query(`SELECT count(*)::int as n FROM chore_occurrence WHERE household_id = $1`, [HOUSEHOLD_ID]);
  const todayChores = await pglite.query(`SELECT count(*)::int as n FROM chore_occurrence WHERE household_id = $1 AND due_on <= $2 AND status = 'OPEN'`, [HOUSEHOLD_ID, '2026-09-28']);
  console.log(`seed done: household ${HOUSEHOLD_ID}, rooms ${rooms.rows[0].n}, chores ${chores.rows[0].n}, today(2026-09-28) ${todayChores.rows[0].n}`);

  await pglite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
