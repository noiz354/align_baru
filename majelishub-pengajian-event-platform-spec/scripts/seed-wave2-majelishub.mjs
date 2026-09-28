#!/usr/bin/env node
// Deterministic seed for MajelisHub wave2: Jakarta + Bandung tenants
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/server/db/schema/index.ts";
import { sql } from "drizzle-orm";

function deterministicUuid(ns, key) {
  const h = createHash("sha256").update(`${ns}:${key}`).digest("hex");
  const raw = "594f4d49" + h.slice(8, 32);
  const ch = raw.split("");
  ch[12] = "7";
  const v = parseInt(ch[19], 16);
  ch[19] = ((v & 0x3) | 0x8).toString(16);
  return `${ch.slice(0,8).join("")}-${ch.slice(8,12).join("")}-${ch.slice(12,16).join("")}-${ch.slice(16,20).join("")}-${ch.slice(20,32).join("")}`;
}

const DB_URL = process.env.DATABASE_URL || "pglite:///tmp/majelishub-pglite";
let dataDir;
if (DB_URL.startsWith("pglite://")) dataDir = DB_URL.slice("pglite://".length) || undefined;
else if (DB_URL.startsWith("file:")) dataDir = DB_URL.slice("file:".length);
else if (DB_URL.startsWith("/tmp/") || DB_URL.startsWith("./") ) dataDir = DB_URL;
else dataDir = undefined;

const pglite = new PGlite(dataDir);
const db = drizzle(pglite, { schema });

// Ensure tables exist (for PGlite dev, run migrations via pglite.exec, skipping RLS role grants)
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, "..", "drizzle");
async function ensureTables() {
  // Try to run each drizzle/*.sql via pglite, ignoring RLS/role errors for PGlite
  const files = readdirSync(drizzleDir).filter(f=>f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(join(drizzleDir, file), "utf8");
    // Skip the complex RLS file's role-specific parts for PGlite by just exec and ignore errors about missing role
    try {
      await pglite.exec(sql);
      console.log(`  migration ${file} applied (or already exists)`);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("already exists") || msg.includes("majelishub_app") || msg.includes("role") || msg.includes("422")) {
        console.log(`  migration ${file} skipped (PGlite: ${msg.slice(0,120)})`);
        continue;
      }
      // For other errors, try to create just the tables we need
      if (file === "0004_kajian_events.sql") {
        console.log("  fallback: creating kajian_events directly");
        await pglite.exec(`
          CREATE TABLE IF NOT EXISTS "kajian_events" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
            "mosque_id" uuid NOT NULL REFERENCES "mosques"("id") ON DELETE CASCADE,
            "slug" text NOT NULL,
            "title" text NOT NULL,
            "description" text,
            "status" text NOT NULL DEFAULT 'DRAFT',
            "starts_at" timestamp with time zone,
            "ends_at" timestamp with time zone,
            "created_by" text,
            "created_at" timestamp with time zone NOT NULL DEFAULT now(),
            "updated_at" timestamp with time zone NOT NULL DEFAULT now()
          );
        `);
      } else {
        console.log(`  migration ${file} error ignored: ${msg.slice(0,200)}`);
      }
    }
  }
  // Ensure kajian_events exists even if migration skipped
  const res = await pglite.query(`SELECT to_regclass('public.kajian_events') as tbl`);
  const exists = res.rows[0]?.tbl !== null;
  if (!exists) {
    console.log("Creating kajian_events table fallback...");
    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS "kajian_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "mosque_id" uuid NOT NULL REFERENCES "mosques"("id") ON DELETE CASCADE,
        "slug" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "status" text NOT NULL DEFAULT 'DRAFT',
        "starts_at" timestamp with time zone,
        "ends_at" timestamp with time zone,
        "created_by" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "kajian_events_org_slug_unique" ON "kajian_events" ("organization_id","slug");
    `);
  }
}

await ensureTables();

// Deterministic IDs
const jakartaOrgId = deterministicUuid("org", "Majelis Demo Jakarta");
const bandungOrgId = deterministicUuid("org", "Majelis Demo Bandung");
const jakartaMosqueId = deterministicUuid("mosque", "Masjid Al Demo Jakarta");
const bandungMosqueId = deterministicUuid("mosque", "Masjid Demo Bandung");
const jakartaEventId = deterministicUuid("event", "Kajian Akhir Pekan Jakarta");
const jakartaAdminId = "majelishub-jakarta-admin";
const jakartaOrganizerId = "majelishub-jakarta-organizer";
const bandungAdminId = "majelishub-bandung-admin";

// Insert organizations via raw SQL for PGlite compatibility
async function insertOrg(id, slug, name) {
  await pglite.query(`INSERT INTO organizations (id, slug, name, kind, timezone, is_published) VALUES ($1,$2,$3,'COMMUNITY','Asia/Jakarta',true) ON CONFLICT DO NOTHING`, [id, slug, name]);
}
await insertOrg(jakartaOrgId, "majelis-demo-jakarta", "Majelis Demo Jakarta");
await insertOrg(bandungOrgId, "majelis-demo-bandung", "Majelis Demo Bandung");

async function insertUser(id, name, email) {
  await pglite.query(`INSERT INTO users (id, name, email, email_verified) VALUES ($1,$2,$3,true) ON CONFLICT DO NOTHING`, [id, name, email]);
}
await insertUser(jakartaAdminId, "Jakarta Admin", "admin@majelis.demo.test");
await insertUser(jakartaOrganizerId, "Jakarta Organizer", "organizer@majelis.demo.test");
await insertUser(bandungAdminId, "Bandung Admin", "admin@bandung.demo.test");

async function insertMember(id, orgId, userId, roles) {
  // roles as array literal: '{"ORGANIZER","MOSQUE_ADMIN"}'
  const rolesStr = `{${roles.map(r=>`"${r}"`).join(",")}}`;
  await pglite.query(`INSERT INTO organization_members (id, organization_id, user_id, roles, status) VALUES ($1,$2,$3,$4::text[],'ACTIVE') ON CONFLICT DO NOTHING`, [id, orgId, userId, rolesStr]);
}
await insertMember(deterministicUuid("member", `jakarta-admin-${jakartaOrgId}`), jakartaOrgId, jakartaAdminId, ["ORGANIZER","MOSQUE_ADMIN"]);
await insertMember(deterministicUuid("member", `jakarta-org-${jakartaOrgId}`), jakartaOrgId, jakartaOrganizerId, ["ORGANIZER"]);
await insertMember(deterministicUuid("member", `bandung-admin-${bandungOrgId}`), bandungOrgId, bandungAdminId, ["ORGANIZER","MOSQUE_ADMIN"]);

// Mosques
async function insertMosque(id, orgId, slug, name) {
  await pglite.query(`INSERT INTO mosques (id, organization_id, slug, name, kind, timezone, is_active) VALUES ($1,$2,$3,$4,'MASJID','Asia/Jakarta',true) ON CONFLICT DO NOTHING`, [id, orgId, slug, name]);
}
await insertMosque(jakartaMosqueId, jakartaOrgId, "masjid-al-demo", "Masjid Al Demo");
await insertMosque(bandungMosqueId, bandungOrgId, "masjid-demo-bandung", "Masjid Demo Bandung");

// Events
const now = new Date();
const startsAt = new Date(now.getTime() + 7*24*60*60*1000);
const endsAt = new Date(startsAt.getTime() + 2*60*60*1000);
await pglite.query(`INSERT INTO kajian_events (id, organization_id, mosque_id, slug, title, description, status, starts_at, ends_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,'SCHEDULED',$7,$8,$9) ON CONFLICT DO NOTHING`, [jakartaEventId, jakartaOrgId, jakartaMosqueId, "kajian-akhir-pekan", "Kajian Akhir Pekan", "Kajian rutin akhir pekan di Masjid Al Demo", startsAt.toISOString(), endsAt.toISOString(), jakartaOrganizerId]);

// Audit entry for event creation (hash-chained)
const existing = await pglite.query(`SELECT * FROM audit_events WHERE organization_id = $1`, [jakartaOrgId]);
if (existing.rows.length === 0) {
  const prevHash = null;
  const chainPosition = 1;
  const payload = JSON.stringify({ v:1, org:jakartaOrgId, pos:chainPosition, prevHash, action:"event.write", scope:"ORG", actor:jakartaOrganizerId, targetType:"kajian_event", targetId:jakartaEventId });
  const hash = createHash("sha256").update(payload).digest("hex");
  await pglite.query(`INSERT INTO audit_events (id, organization_id, chain_position, action_key, scope_kind, actor_user_id, actor_role, target_type, target_id, request_id, prev_hash, hash) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [jakartaOrgId, chainPosition, "event.write", "ORG", jakartaOrganizerId, "ORGANIZER", "kajian_event", jakartaEventId, deterministicUuid("req", "seed-majelishub"), prevHash, hash]);
}

console.log("Seed done:");
console.log(`  Jakarta org ${jakartaOrgId} slug majelis-demo-jakarta`);
console.log(`  Bandung org ${bandungOrgId} slug majelis-demo-bandung`);
console.log(`  Jakarta mosque ${jakartaMosqueId} Masjid Al Demo`);
console.log(`  Jakarta event ${jakartaEventId} Kajian Akhir Pekan`);
console.log(`  Users: ${jakartaAdminId} (admin@majelis.demo.test), ${jakartaOrganizerId} (organizer@majelis.demo.test), ${bandungAdminId} (admin@bandung.demo.test)`);
console.log(`  PGlite dir ${dataDir || "(memory)"}`);

await pglite.close();
