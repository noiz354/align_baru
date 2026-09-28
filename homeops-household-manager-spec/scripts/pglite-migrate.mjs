import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
const dataDir = process.env.PGLITE_DIR || (process.env.DATABASE_URL?.startsWith("pglite://") ? process.env.DATABASE_URL.slice("pglite://".length) : "/tmp/homeops-pglite");
const migDir = join(process.cwd(), "migrations");
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const files = readdirSync(migDir).filter(f=>f.endsWith(".sql")).sort();
console.log(`[pglite-migrate-homeops] dataDir=${dataDir} files=${files.join(",")}`);
const pglite = new PGlite(dataDir);
for (const f of files) {
  const content = readFileSync(join(migDir, f), "utf8");
  const stmts = content.split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean);
  console.log(`[migrate] ${f} ${stmts.length} stmts`);
  for (let i=0;i<stmts.length;i++) {
    let sql = stmts[i];
    if (!sql) continue;
    // skip empty comment
    try {
      await pglite.exec(sql);
    } catch(e) {
      const msg = String(e.message||e);
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        console.log(`  ignore exists ${f}:${i} ${msg.slice(0,100)}`);
        continue;
      }
      console.error(`  FAIL ${f} ${i}: ${msg.slice(0,400)}`);
      if (sql.toUpperCase().includes("CREATE TABLE") || sql.toUpperCase().includes("CREATE TYPE")) throw e;
    }
  }
}
console.log("[pglite-migrate-homeops] done");
await pglite.close();
