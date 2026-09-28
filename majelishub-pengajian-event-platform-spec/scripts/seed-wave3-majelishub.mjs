#!/usr/bin/env node
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
function deterministicUuid(ns, key) {
  const h = createHash("sha256").update(`${ns}:${key}`).digest("hex");
  const raw = "594f4d49" + h.slice(8, 32);
  const ch = raw.split("");
  ch[12] = "7";
  const v = parseInt(ch[19], 16);
  ch[19] = ((v & 0x3) | 0x8).toString(16);
  return `${ch.slice(0,8).join("")}-${ch.slice(8,12).join("")}-${ch.slice(12,16).join("")}-${ch.slice(16,20).join("")}-${ch.slice(20,32).join("")}`;
}
const DB_URL = process.env.DATABASE_URL || "pglite:///tmp/majelis-pglite";
let dataDir;
if (DB_URL.startsWith("pglite://")) dataDir = DB_URL.slice("pglite://".length) || undefined;
else if (DB_URL.startsWith("file:")) dataDir = DB_URL.slice("file:".length);
else if (DB_URL.startsWith("/tmp/") || DB_URL.startsWith("./")) dataDir = DB_URL;
else dataDir = undefined;
const pglite = new PGlite(dataDir);
const jakartaOrgId = deterministicUuid("org", "Majelis Demo Jakarta");
const bandungOrgId = deterministicUuid("org", "Majelis Demo Bandung");
const bandungMosqueId = deterministicUuid("mosque", "Masjid Demo Bandung");
const bandungEventId = deterministicUuid("event", "Kajian Bandung Demo");
const bandungAdminId = "majelishub-bandung-admin";
const attendeeId = "majelishub-attendee";
console.log(`[seed-wave3] dataDir=${dataDir}`);
await pglite.query(`INSERT INTO users (id, name, email, email_verified) VALUES ($1,$2,$3,true) ON CONFLICT (id) DO NOTHING`, [attendeeId, "Attendee Demo", "attendee@majelis.demo.test"]);
console.log(`[seed-wave3] attendee ${attendeeId} attendee@majelis.demo.test`);
const now = new Date();
const startsAt = new Date(now.getTime() + 7*24*60*60*1000);
const endsAt = new Date(startsAt.getTime() + 2*60*60*1000);
await pglite.query(`INSERT INTO kajian_events (id, organization_id, mosque_id, slug, title, description, status, starts_at, ends_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,'SCHEDULED',$7,$8,$9) ON CONFLICT DO NOTHING`, [bandungEventId, bandungOrgId, bandungMosqueId, "kajian-bandung-demo", "Kajian Bandung Demo", "Kajian Bandung untuk isolasi tenant", startsAt.toISOString(), endsAt.toISOString(), bandungAdminId]);
console.log(`[seed-wave3] bandung event ${bandungEventId}`);
// Clear any existing registrations/attendance for deterministic test
await pglite.query(`DELETE FROM event_attendance WHERE event_id IN ($1,$2)`, [deterministicUuid("event", "Kajian Akhir Pekan Jakarta"), bandungEventId]);
await pglite.query(`DELETE FROM event_registrations WHERE event_id IN ($1,$2)`, [deterministicUuid("event", "Kajian Akhir Pekan Jakarta"), bandungEventId]);
console.log(`[seed-wave3] cleared registrations/attendance for both events`);
const check = await pglite.query(`SELECT id, slug, title, organization_id FROM kajian_events WHERE id IN ($1,$2)`, [deterministicUuid("event", "Kajian Akhir Pekan Jakarta"), bandungEventId]);
console.log(check.rows);
await pglite.close();
console.log("[seed-wave3] done");
