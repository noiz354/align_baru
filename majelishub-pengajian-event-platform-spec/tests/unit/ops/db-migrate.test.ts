/**
 * UNIT TEST - ops/db-migrate.test.ts
 * Layer: unit · Owning task: T-SEC-007 · Requirement(s): FR-AUDIT-001 (migrations must be applicable)
 * Specification: ADR-0020 (no schema change at boot), STACK-2026 §5 (migrations as reviewed SQL)
 *
 * What this covers: the DECISIONS the migration runner makes - order, what is pending, and the refusal
 * to re-apply a file that changed after it was applied. The database round trip itself needs a
 * PostgreSQL server (T-OPS-002 / `INTEGRATION_DATABASE_URL`); the SQL files it applies are exercised in
 * full by `tests/support/db.ts` in every integration suite.
 *
 * Delivered 2026-09-27 (T-SEC-007).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
// @ts-expect-error - the runner is a plain ESM script; it has no type declarations.
import { checksumOf, planMigrations, readMigrations } from "../../../ops/db-migrate.mjs";

const tempDirs: string[] = [];

function writeDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "db-migrate-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("db-migrate planning", () => {
  test("reads drizzle/ in filename order and checksums each file", () => {
    const dir = writeDir({
      "0001_second.sql": "SELECT 2;",
      "0000_first.sql": "SELECT 1;",
      "not-a-migration.txt": "ignored",
    });

    const files = readMigrations(dir);
    expect(files.map((file: { name: string }) => file.name)).toEqual(["0000_first.sql", "0001_second.sql"]);
    expect(files[0].checksum).toBe(checksumOf("SELECT 1;"));
    expect(files[0].checksum).not.toBe(files[1].checksum);
  });

  test("applies only what is missing, and keeps the order", () => {
    const files = [
      { name: "0000_first.sql", checksum: "a" },
      { name: "0001_second.sql", checksum: "b" },
      { name: "0002_third.sql", checksum: "c" },
    ];
    const plan = planMigrations(files, new Map([["0000_first.sql", "a"]]));
    expect(plan.pending).toEqual(["0001_second.sql", "0002_third.sql"]);
    expect(plan.changed).toEqual([]);
  });

  test("refuses to continue when an applied file changed on disk", () => {
    const files = [
      { name: "0000_first.sql", checksum: "rewritten" },
      { name: "0001_second.sql", checksum: "b" },
    ];
    const plan = planMigrations(files, new Map([["0000_first.sql", "original"]]));
    expect(plan.changed).toEqual(["0000_first.sql"]);
    // Nothing is reported as pending: the runner stops before touching the database.
    expect(plan.pending).toEqual(["0001_second.sql"]);
  });

  test("the repository's own migrations include the audit migration and its append-only grants", () => {
    const files = readMigrations();
    const names = files.map((file: { name: string }) => file.name);
    expect(names).toContain("0002_audit_events.sql");
    const audit = files.find((file: { name: string }) => file.name === "0002_audit_events.sql");
    expect(audit.sql).toContain("GRANT SELECT, INSERT ON \"audit_events\" TO majelishub_app");
    expect(audit.sql).not.toContain("GRANT UPDATE");
    expect(audit.sql).not.toContain("GRANT DELETE");
  });
});
