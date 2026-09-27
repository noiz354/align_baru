import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// The boundary tables live in a plain .mjs ESLint plugin; `allowJs` lets TypeScript infer them.
import { BOUNDARY_TABLES } from '../../eslint-local/boundaries.mjs';

// Layer and boundary assertions that CI enforces (docs/architecture/MODULE-MAP.md).
// These tests are the executable half of the module map: the lint rule walks the AST, this walks the
// file tree, and both read the same normative tables, so a rule cannot be satisfied by editing one.
//
// T-PLAT-006 (structure) and T-PLAT-004 (schema/migration agreement).

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');

const TABLES = BOUNDARY_TABLES as {
  LAYERS: readonly string[];
  DB_PACKAGES: readonly string[];
  FRAMEWORK_PACKAGES: readonly string[];
  FEATURE_COMPOSITION_ROOTS: readonly string[];
  DOMAIN_TYPE_EDGES: Readonly<Record<string, readonly string[]>>;
};

type ImportEdge = {
  readonly from: string; // absolute file
  readonly source: string; // as written
  readonly resolved: string | null; // absolute file, or null for a package
  readonly typeOnly: boolean;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC);

/** Every static import / re-export in a file, with `import type` detected separately. */
function importsOf(file: string): ImportEdge[] {
  const text = readFileSync(file, 'utf8');
  const edges: ImportEdge[] = [];
  const pattern = /(import|export)\s+(type\s+)?[\s\S]*?from\s*['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(pattern)) {
    const source = match[3];
    if (!source) continue;
    const typeOnly = Boolean(match[2]) || /^\s*import\s+type\b/.test(match[0]);
    edges.push({ from: file, source, resolved: resolveSource(file, source), typeOnly });
  }
  // Side-effect imports (`import './globals.css'`) carry no bindings but are still edges.
  for (const match of text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) {
    const source = match[1];
    if (!source) continue;
    edges.push({ from: file, source, resolved: resolveSource(file, source), typeOnly: false });
  }
  return edges;
}

function resolveSource(file: string, source: string): string | null {
  if (!source.startsWith('.')) return null; // a package, not an internal edge
  const base = resolve(dirname(file), source);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return base; // unresolved (e.g. a .css asset): still recorded, layer checks ignore it
}

function locationOf(file: string) {
  const rel = relative(SRC, file).split('/');
  return { layer: rel[0], module: rel[1], rel: relative(ROOT, file) };
}

const ALL_EDGES = FILES.flatMap(importsOf);

describe('module map: import boundaries hold', () => {
  it('T-PLAT-006 structure: no file under src/domain imports react, next, or drizzle', () => {
    const forbidden = [...TABLES.FRAMEWORK_PACKAGES, ...TABLES.DB_PACKAGES];
    const violations = ALL_EDGES.filter((edge) => {
      const { layer } = locationOf(edge.from);
      if (layer !== 'domain' || edge.resolved !== null) return false;
      return forbidden.some((name) => edge.source === name || edge.source.startsWith(`${name}/`));
    }).map((edge) => `${locationOf(edge.from).rel} → ${edge.source}`);
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: no feature imports another feature (dashboard reads read models only)', () => {
    const violations: string[] = [];
    for (const edge of ALL_EDGES) {
      if (edge.resolved === null) continue;
      const from = locationOf(edge.from);
      const to = locationOf(edge.resolved);
      if (from.layer !== 'features' || to.layer !== 'features') continue;
      if (from.module === to.module) continue;
      const fromIsCompositionRoot = TABLES.FEATURE_COMPOSITION_ROOTS.includes(from.module ?? '');
      // A composition root may read another feature's read models and DTO types, never its actions
      // or components (MODULE-MAP.md §3.3, DECISIONS.md 2026-09-27).
      const allowedForRoot =
        fromIsCompositionRoot &&
        (edge.typeOnly || /(queries|dto|types)$/.test(edge.resolved.replace(/\.(ts|tsx)$/, '')));
      if (allowedForRoot) continue;
      violations.push(`${from.rel} → ${relative(ROOT, edge.resolved)}`);
    }
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: nothing imports features/dashboard (the composition root is a sink)', () => {
    const violations = ALL_EDGES.filter((edge) => {
      if (edge.resolved === null) return false;
      const to = locationOf(edge.resolved);
      const from = locationOf(edge.from);
      return (
        to.layer === 'features' &&
        TABLES.FEATURE_COMPOSITION_ROOTS.includes(to.module ?? '') &&
        from.module !== to.module
      );
    }).map((edge) => `${locationOf(edge.from).rel} → ${relative(ROOT, edge.resolved as string)}`);
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: no feature imports src/server/db directly', () => {
    const violations = ALL_EDGES.filter((edge) => {
      if (edge.resolved === null) return false;
      const from = locationOf(edge.from);
      const to = locationOf(edge.resolved);
      return from.layer === 'features' && to.layer === 'server' && to.module === 'db';
    }).map((edge) => `${locationOf(edge.from).rel} → ${relative(ROOT, edge.resolved as string)}`);
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: src/shared has no imports from layers above it', () => {
    const upward = ['app', 'features', 'domain', 'server'];
    const violations = ALL_EDGES.filter((edge) => {
      if (edge.resolved === null) return false;
      const from = locationOf(edge.from);
      const to = locationOf(edge.resolved);
      return from.layer === 'shared' && upward.includes(to.layer ?? '');
    }).map((edge) => `${locationOf(edge.from).rel} → ${relative(ROOT, edge.resolved as string)}`);
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: app/** never imports server/** (routes go through features)', () => {
    const violations = ALL_EDGES.filter((edge) => {
      if (edge.resolved === null) return false;
      const from = locationOf(edge.from);
      const to = locationOf(edge.resolved);
      return from.layer === 'app' && to.layer === 'server';
    }).map((edge) => `${locationOf(edge.from).rel} → ${relative(ROOT, edge.resolved as string)}`);
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: only src/server/db imports the database driver', () => {
    const violations = ALL_EDGES.filter((edge) => {
      if (edge.resolved !== null) return false;
      const { rel } = locationOf(edge.from);
      if (rel.startsWith('src/server/db/')) return false;
      return TABLES.DB_PACKAGES.some((name) => edge.source === name || edge.source.startsWith(`${name}/`));
    }).map((edge) => `${locationOf(edge.from).rel} → ${edge.source}`);
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: domain type-only edges are the declared ones (MODULE-MAP §3.5)', () => {
    const violations: string[] = [];
    for (const edge of ALL_EDGES) {
      if (edge.resolved === null) continue;
      const from = locationOf(edge.from);
      const to = locationOf(edge.resolved);
      if (from.layer !== 'domain' || to.layer !== 'domain' || from.module === to.module) continue;
      const declared = TABLES.DOMAIN_TYPE_EDGES[from.module ?? ''] ?? [];
      if (edge.typeOnly && declared.includes(to.module ?? '')) continue;
      violations.push(
        `${from.rel} → ${relative(ROOT, edge.resolved)} (${edge.typeOnly ? 'type-only, undeclared' : 'runtime'})`,
      );
    }
    expect(violations).toEqual([]);
  });

  it('T-PLAT-006 structure: the module graph is acyclic over runtime imports', () => {
    // Type-only edges are erased at compile time and are explicitly allowed between domain modules
    // (MODULE-MAP §3.5), so acyclicity is asserted over the runtime graph.
    const graph = new Map<string, string[]>();
    for (const edge of ALL_EDGES) {
      if (edge.typeOnly || edge.resolved === null || !existsSync(edge.resolved)) continue;
      const list = graph.get(edge.from) ?? [];
      list.push(edge.resolved);
      graph.set(edge.from, list);
    }

    const cycles: string[][] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const stack: string[] = [];

    const visit = (node: string): void => {
      const marker = state.get(node);
      if (marker === 'done') return;
      if (marker === 'visiting') {
        cycles.push([...stack.slice(stack.indexOf(node)), node].map((file) => relative(ROOT, file)));
        return;
      }
      state.set(node, 'visiting');
      stack.push(node);
      for (const next of graph.get(node) ?? []) visit(next);
      stack.pop();
      state.set(node, 'done');
    };

    for (const file of graph.keys()) visit(file);
    expect(cycles).toEqual([]);
  });

  it('T-PLAT-004 structure: the Drizzle schema module and the committed migrations agree', () => {
    // ADR-003: types are inferred from the schema module, and its stated risk is drift from the
    // migrations. The migration SQL is the authoritative shape (ARCHITECTURE.md §9), so every table
    // must exist on both sides with the same name.
    const schemaDir = join(SRC, 'server/db/schema');
    expect(existsSync(schemaDir), 'src/server/db/schema must exist from VS-0 (ADR-003)').toBe(true);

    const declared = new Set<string>();
    for (const file of walk(schemaDir)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/pgTable\(\s*'([^']+)'/g)) {
        if (match[1]) declared.add(match[1]);
      }
    }

    const migrationsDir = join(ROOT, 'migrations');
    const migrated = new Set<string>();
    for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))) {
      for (const match of readFileSync(join(migrationsDir, file), 'utf8').matchAll(
        /CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/g,
      )) {
        if (match[1]) migrated.add(match[1]);
      }
    }

    expect(declared.size, 'the schema module declares no tables').toBeGreaterThan(0);
    expect(migrated.size, 'the migrations create no tables').toBeGreaterThan(0);
    expect([...declared].filter((table) => !migrated.has(table)).sort()).toEqual([]);
    expect([...migrated].filter((table) => !declared.has(table)).sort()).toEqual([]);
  });
});
