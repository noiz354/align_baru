/**
 * Which database dialect a DSN selects.
 *
 * PGlite is the dev/test fallback: it runs Postgres in-process, so no daemon and no Docker
 * are needed, but it has no `pg_trgm` extension and takes a directory rather than a network
 * host. Several places need that decision — the driver in `client.ts`, the migrator in
 * `migrations.ts`, and the index definitions in `schema.ts` — and each of them used to carry
 * its own copy of the prefix list. They drifted: the schema copy omitted `memory:` and
 * `:memory:`, so an in-memory DSN got a GIN/trgm index that PGlite cannot create.
 *
 * One definition, imported by all three.
 */

/** DSN prefixes and suffixes that mean "PGlite", not a network Postgres. */
const PGLITE_PREFIXES = ['pglite://', 'file:', 'memory:', '/tmp/', './'] as const;

/**
 * True when the DSN selects the in-process PGlite fallback rather than a real Postgres.
 * An absent DSN is not PGlite: callers decide separately whether it is configured at all.
 */
export function isPgliteDsn(url: string | undefined | null): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === '') return false;
  return trimmed === ':memory:' || trimmed.endsWith('.db') || PGLITE_PREFIXES.some((p) => trimmed.startsWith(p));
}
