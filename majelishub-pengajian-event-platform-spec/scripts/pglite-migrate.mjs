#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const dataDir = process.env.PGLITE_DIR || (process.env.DATABASE_URL?.startsWith("pglite://") ? process.env.DATABASE_URL.slice("pglite://".length) : "/tmp/majelis-pglite");
const drizzleDir = join(process.cwd(), "drizzle");

async function main() {
  const files = readdirSync(drizzleDir).filter(f=>f.endsWith(".sql")).sort();
  console.log(`[pglite-migrate] dataDir=${dataDir} files=${files.join(",")}`);
  const pglite = new PGlite(dataDir);
  try {
    for (const fname of files) {
      const content = readFileSync(join(drizzleDir, fname), "utf8");
      const stmts = content.split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean);
      console.log(`[pglite-migrate] ${fname} ${stmts.length} statements`);
      for (let i=0;i<stmts.length;i++) {
        let sql = stmts[i].trim();
        if (!sql) continue;
        // skip comments-only
        if (sql.startsWith("--") && !sql.includes("CREATE TABLE")) continue;
        // skip extensions, roles, RLS, policies
        const upper = sql.toUpperCase();
        if (upper.includes("CREATE EXTENSION")) { console.log(`  skip CREATE EXTENSION`); continue; }
        if (upper.trimStart().startsWith("DO $$") || upper.trimStart().startsWith("DO\n$$")) { console.log(`  skip DO block`); continue; }
        if (upper.trimStart().startsWith("GRANT") || upper.trimStart().startsWith("REVOKE") || upper.trimStart().startsWith("ALTER ROLE") || upper.trimStart().startsWith("ALTER DEFAULT")) { console.log(`  skip GRANT/ROLE`); continue; }
        if (upper.includes("ENABLE ROW LEVEL SECURITY") || upper.includes("CREATE POLICY")) { console.log(`  skip RLS/POLICY`); continue; }
        // skip advisory lock related?
        if (upper.includes("SELECT PG_ADVISORY")) { console.log(`  skip advisory`); continue; }
        // skip COMMENT? allow
        try {
          await pglite.exec(sql);
          // console.log(`  ok ${i+1}/${stmts.length}`);
        } catch (e) {
          const msg = String(e.message||e);
          // ignore "already exists"
          if (msg.includes("already exists") || msg.includes("duplicate")) {
            console.log(`  ignore already exists: ${msg.slice(0,120)}`);
            continue;
          }
          // ignore role does not exist etc.
          if (msg.includes("role \"majelishub_app\" does not exist")) {
            console.log(`  ignore role not exist for ${fname}:${i}`);
            continue;
          }
          console.error(`  FAIL ${fname} stmt ${i+1}: ${msg.slice(0,500)}\nSQL:${sql.slice(0,300)}`);
          // for CREATE TABLE failures, fail
          if (upper.includes("CREATE TABLE") || upper.includes("CREATE INDEX") || upper.includes("CREATE UNIQUE INDEX")) {
            throw e;
          }
          // otherwise continue
        }
      }
    }
    console.log("[pglite-migrate] done");
  } finally {
    await pglite.close();
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
