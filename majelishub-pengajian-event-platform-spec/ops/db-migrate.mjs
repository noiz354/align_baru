/**
 * ops/db-migrate.mjs — apply the reviewed SQL migrations in `drizzle/` to a target database.
 *
 * Owning task: T-SEC-007 (the audit migration is the first one that cannot be applied by hand) ·
 * Specification: ADR-0020 (no schema change at application boot), STACK-2026 §5 ("migrations as
 * reviewed SQL"), DATA_MODEL.md.
 *
 * Why this exists instead of `drizzle-kit migrate`: `drizzle-kit` replays the entries in
 * `drizzle/meta/_journal.json`, and this repository's migrations are hand-reviewed SQL files that are
 * not journalled (drizzle-kit is used to *generate and diff* schema, not to own the applied history).
 * Running `drizzle-kit migrate` here would apply nothing.
 *
 * What it does:
 *   1. creates `schema_migrations` if absent (name, applied_at, sha256 of the file);
 *   2. applies every `drizzle/*.sql` in filename order that is not yet recorded;
 *   3. applies each file inside its own transaction, so a failure leaves the database at the last
 *      successfully applied file;
 *   4. refuses to run when an already-applied file changed on disk (a rewritten migration is a review
 *      problem, not something to re-apply silently).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node ops/db-migrate.mjs            # apply pending migrations
 *   DATABASE_URL=postgres://... node ops/db-migrate.mjs --status    # report pending/applied, apply nothing
 *
 * Exit codes: 0 clean · 1 failure or a changed file that was already applied.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "drizzle");
const STATUS_ONLY = process.argv.includes("--status");

/** sha256 of a file's content - recorded with the name so a rewritten migration is detected. */
export function checksumOf(content) {
  return createHash("sha256").update(content).digest("hex");
}

/** Reads `drizzle/` in filename order. Exported so the planning logic is unit-tested. */
export function readMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name), "utf8");
      return { name, sql, checksum: checksumOf(sql) };
    });
}

/**
 * Decides what to do, given the files on disk and what the database already recorded.
 *
 * @param files `{ name, checksum }[]` in application order
 * @param applied `Map<name, checksum>` from `schema_migrations`
 * @returns `{ pending, changed }` - `changed` non-empty means "stop, this needs a review"
 */
export function planMigrations(files, applied) {
  const pending = [];
  const changed = [];
  for (const file of files) {
    const recorded = applied.get(file.name);
    if (recorded === undefined) pending.push(file.name);
    else if (recorded !== file.checksum) changed.push(file.name);
  }
  return { pending, changed };
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    log("DATABASE_URL is required (see .env.example). Nothing was applied.");
    return 1;
  }

  const files = readMigrations();
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Map(
      (await client.query("SELECT name, checksum FROM schema_migrations ORDER BY name")).rows.map((row) => [
        row.name,
        row.checksum,
      ]),
    );

    const plan = planMigrations(files, applied);
    if (plan.changed.length > 0) {
      for (const name of plan.changed) {
        log(`REFUSING: ${name} was already applied with a different checksum. Add a new migration instead.`);
      }
      return 1;
    }

    const pendingNames = new Set(plan.pending);
    const pending = files.filter((file) => pendingNames.has(file.name));
    if (STATUS_ONLY) {
      for (const file of files) {
        log(`${applied.has(file.name) ? "applied " : "pending "} ${file.name}`);
      }
      log(`${files.length} file(s), ${pending.length} pending.`);
      return 0;
    }

    for (const file of pending) {
      log(`applying ${file.name} …`);
      await client.query("BEGIN");
      try {
        await client.query(file.sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          file.name,
          file.checksum,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        log(`FAILED ${file.name}: ${error.message}`);
        log("The database is at the last successfully applied migration.");
        return 1;
      }
    }

    log(pending.length === 0 ? "Nothing to apply: schema is up to date." : `Applied ${pending.length} migration(s).`);
    return 0;
  } finally {
    await client.end();
  }
}

// Only act when invoked directly, so `tests/unit/ops/db-migrate.test.ts` can import the planners.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      log(`db-migrate failed: ${error.message}`);
      process.exitCode = 1;
    });
}
