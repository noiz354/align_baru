import { PGlite } from "@electric-sql/pglite";
function seedId(n){return `00000000-0000-4000-8000-00000000${n.toString(16).padStart(4,'0')}`;}
const dataDir = process.env.DATABASE_URL?.startsWith("pglite://") ? process.env.DATABASE_URL.slice("pglite://".length) : "/tmp/homeops-pglite";
const pglite = new PGlite(dataDir || "/tmp/homeops-pglite");
console.log(`[seed-wave3-homeops] dataDir=${dataDir}`);
const HH_MAIN = seedId(1);
const SARI_USER='seed-user-hh-main-sari';
const SARI_MEMBER=seedId(101);
const BUDI_USER='seed-user-hh-main-budi';
const BUDI_MEMBER=seedId(102);
const DITA_USER='seed-user-hh-main-dita';
const DITA_MEMBER=seedId(103);
const ANDI_USER='seed-user-hh-main-andi';
const ANDI_MEMBER=seedId(104);
// users
for (const [uid, name, email] of [
  [SARI_USER,'Sari','sari@homeops.test'],
  [BUDI_USER,'Budi','budi@homeops.test'],
  [DITA_USER,'Dita','dita@homeops.test'],
  [ANDI_USER,'Andi','andi@homeops.test'],
]) {
  await pglite.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1,$2,$3,true, now(), now()) ON CONFLICT (id) DO NOTHING`, [uid,name,email]);
}
console.log("users inserted");
// household
await pglite.query(`INSERT INTO household (id, name, timezone, week_starts_on, created_by, created_by_member_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6, now(), now()) ON CONFLICT (id) DO NOTHING`, [HH_MAIN,'HH_MAIN','Asia/Jakarta','MONDAY',SARI_USER,SARI_MEMBER]);
console.log("household",HH_MAIN);
// household_member
for (const [mid, uid, role, displayName] of [
  [SARI_MEMBER,SARI_USER,'OWNER','Sari'],
  [BUDI_MEMBER,BUDI_USER,'ADMIN','Budi'],
  [DITA_MEMBER,DITA_USER,'MEMBER','Dita'],
  [ANDI_MEMBER,ANDI_USER,'HELPER','Andi'],
]) {
  await pglite.query(`INSERT INTO household_member (id, household_id, user_id, role, display_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [mid, HH_MAIN, uid, role, displayName]);
}
console.log("members inserted");
// household_settings
await pglite.query(`INSERT INTO household_settings (household_id, maintenance_lead_days, snooze_max_hours, info_expiry_days, daily_cap_ceiling, room_override_max_hours, created_at, updated_at) VALUES ($1,7,24,14,10,168, now(), now()) ON CONFLICT (household_id) DO NOTHING`, [HH_MAIN]);
// room: ensure at least one room for chore
const ROOM_ID = seedId(900);
await pglite.query(`INSERT INTO room (id, household_id, name, group_label, sort_order, not_in_use, created_at, updated_at) VALUES ($1,$2,$3,$4,0,false, now(), now()) ON CONFLICT (id) DO NOTHING`, [ROOM_ID, HH_MAIN, 'Ruang Keluarga', 'LIVING']);
console.log("room",ROOM_ID);
// clear previous Buang sampah definitions/occurrences for deterministic test
await pglite.query(`DELETE FROM chore_occurrence WHERE household_id=$1 AND title_snapshot='Buang sampah'`, [HH_MAIN]);
await pglite.query(`DELETE FROM chore_definition WHERE household_id=$1 AND title='Buang sampah'`, [HH_MAIN]);
console.log("cleared Buang sampah");
const check = await pglite.query(`SELECT id, name FROM household WHERE id=$1`, [HH_MAIN]);
console.log(check.rows);
await pglite.close();
console.log("[seed-wave3-homeops] done");
