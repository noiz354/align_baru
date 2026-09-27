/**
 * eslint-local/boundaries.mjs — the executable half of docs/architecture/MODULE-MAP.md (T-PLAT-006).
 *
 * A local plugin rather than a dependency: the rules are project-specific, the module map is the
 * spec, and `no-restricted-imports` alone cannot express "type-only imports across domain modules
 * are allowed, runtime imports are not" (MODULE-MAP.md §3.5).
 *
 * Every message cites the rule it enforces so a failing lint is a documentation reference, not a
 * mystery (AGENTS.md §4 "Comments explain why").
 */

const LAYERS = ['app', 'features', 'domain', 'server', 'shared'];

/** Runtime imports of these packages are forbidden outside the layer that owns them. */
const DB_PACKAGES = new Set(['drizzle-orm', 'postgres', 'drizzle-kit']);
const FRAMEWORK_PACKAGES = new Set(['next', 'react', 'react-dom']);

/**
 * The dashboard is the declared composition root for `/today` (MODULE-MAP.md §3.3, ARCHITECTURE.md
 * §8): it may read other features' read models and DTO types. Nothing may import the dashboard.
 */
const FEATURE_COMPOSITION_ROOTS = new Set(['dashboard']);

/** Domain modules that may *type-only* reference another domain module's `types.ts` (MODULE-MAP §2/§3). */
const DOMAIN_TYPE_EDGES = {
  rooms: ['chores'],
  alerts: ['chores', 'trash', 'resources', 'maintenance', 'issues', 'members'],
  maintenance: ['issues'],
  members: ['household'],
  dashboard: ['rooms', 'chores', 'trash', 'resources', 'maintenance', 'alerts'],
};

function isFrameworkPackage(name) {
  return FRAMEWORK_PACKAGES.has(name) || [...FRAMEWORK_PACKAGES].some((p) => name.startsWith(`${p}/`));
}

function isDbPackage(name) {
  return DB_PACKAGES.has(name) || [...DB_PACKAGES].some((p) => name.startsWith(`${p}/`));
}

function parseLocation(filename) {
  const rel = filename.split('/src/')[1];
  if (!rel) return null;
  const segments = rel.split('/');
  const layer = segments[0];
  if (!LAYERS.includes(layer)) return null;
  return { layer, module: segments[1], segments, rel };
}

function resolveSource(source, filename) {
  if (source.startsWith('@/')) return { kind: 'internal', path: `src/${source.slice(2)}` };
  if (source.startsWith('.')) {
    const base = filename.slice(0, filename.lastIndexOf('/'));
    const parts = `${base}/${source}`.split('/');
    const out = [];
    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    const joined = out.join('/');
    const index = joined.indexOf('src/');
    if (index === -1) return { kind: 'internal', path: joined };
    return { kind: 'internal', path: joined.slice(index) };
  }
  return { kind: 'package', name: source };
}

/** Strip a trailing extension and any `/index` so `./types` and `./types.ts` compare equal. */
function normalize(path) {
  return path.replace(/\.(ts|tsx|js|jsx|mjs)$/, '').replace(/\/index$/, '');
}

function moduleOf(path) {
  const segments = path.split('/');
  return { layer: segments[1], module: segments[2], segments };
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce the HomeOps layer and module boundaries from docs/architecture/MODULE-MAP.md',
    },
    schema: [],
    messages: {
      layerForbidden: 'MODULE-MAP §1: `{{from}}/**` must never import `{{to}}` ({{reason}}).',
      featureCrossImport:
        'MODULE-MAP §3.3: two features never import each other — move shared logic to `domain` (pure) or `server` (adapter).',
      dashboardIsASink:
        'MODULE-MAP §3.3: nothing may import `features/dashboard` — the composition root has no consumers.',
      dbDriverLeak:
        'MODULE-MAP §4: only `src/server/db` may import the database driver (`{{name}}`). Tenancy, transactions, and the query budget are audited in one place.',
      domainFramework:
        'MODULE-MAP §4: `domain/**` must not import `{{name}}` — domain logic has to run in tests and jobs, not only inside a request.',
      domainRuntimeCrossModule:
        "MODULE-MAP §3.5: runtime imports between domain modules are forbidden. Pass plain values in, or use `import type` from the other module's `types.ts`.",
      domainTypeEdgeNotAllowed:
        'MODULE-MAP §3.5: `domain/{{from}}` may not type-import `domain/{{to}}`. Declared edges: {{allowed}}.',
      deepImport:
        "MODULE-MAP §4: a feature may only import another module's public surface (`types.ts`, `ports.ts`, `services.ts`) — not `{{target}}`.",
      clientServerImport:
        'MODULE-MAP §4 / ARCHITECTURE §4.1 L-8: a `"use client"` file must not import `{{target}}` (bundling risk and tenancy bypass).',
      sharedUpward:
        'MODULE-MAP §1: `shared/**` is a leaf — it imports nothing from app, features, domain, or server.',
      newDateInDomain:
        'AGENTS.md §4 (Time): never call `new Date()` in domain or feature code — take an injected `Clock` (I-XA-005).',
      explicitAny: 'AGENTS.md §4 (Language): no `any` — use `unknown` plus narrowing.',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const location = parseLocation(filename);
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const isClient = (() => {
      const text = sourceCode.getText();
      return /^\s*(['"])use client\1/m.test(text.slice(0, 400));
    })();

    function checkImport(node, source) {
      if (!source || !location) return;
      const resolved = resolveSource(source, filename);
      const from = location.layer;

      if (resolved.kind === 'package') {
        if (isDbPackage(resolved.name) && !filename.includes('/src/server/db/')) {
          context.report({ node, messageId: 'dbDriverLeak', data: { name: resolved.name } });
        }
        if (
          (from === 'domain' || from === 'shared') &&
          isFrameworkPackage(resolved.name) &&
          from === 'domain'
        ) {
          context.report({ node, messageId: 'domainFramework', data: { name: resolved.name } });
        }
        return;
      }

      const target = normalize(resolved.path);
      const targetInfo = moduleOf(target);
      const to = targetInfo.layer;

      if (isClient && (to === 'server' || to === 'domain')) {
        const typeOnly =
          node.importKind === 'type' || (node.specifiers ?? []).every((s) => s.importKind === 'type');
        if (!(typeOnly && to === 'domain' && target.endsWith('/types'))) {
          context.report({ node, messageId: 'clientServerImport', data: { target } });
        }
        return;
      }

      if (from === 'shared' && ['app', 'features', 'domain', 'server'].includes(to)) {
        context.report({ node, messageId: 'sharedUpward' });
        return;
      }

      if (from === 'app' && (to === 'domain' || to === 'server')) {
        context.report({
          node,
          messageId: 'layerForbidden',
          data: {
            from,
            to,
            reason: 'routes coordinate and render; logic belongs in a feature action or query',
          },
        });
        return;
      }

      if (from === 'domain' && (to === 'server' || to === 'features' || to === 'app')) {
        context.report({
          node,
          messageId: 'layerForbidden',
          data: { from, to, reason: 'the domain knows nothing about HTTP, SQL, or React' },
        });
        return;
      }

      if (from === 'server' && (to === 'features' || to === 'app')) {
        context.report({
          node,
          messageId: 'layerForbidden',
          data: { from, to, reason: 'adapters satisfy domain ports; they never reach upward' },
        });
        return;
      }

      if (
        to === 'features' &&
        targetInfo.module === 'dashboard' &&
        !(from === 'features' && location.module === 'dashboard')
      ) {
        context.report({ node, messageId: 'dashboardIsASink' });
        return;
      }

      if (from === 'features') {
        if (to === 'features' && targetInfo.module !== location.module) {
          if (!FEATURE_COMPOSITION_ROOTS.has(location.module)) {
            context.report({ node, messageId: 'featureCrossImport' });
            return;
          }
          // The composition root may read another feature's read model or DTO shapes only.
          const leaf = target.split('/').pop() ?? '';
          if (!['queries', 'dto'].includes(leaf)) {
            context.report({ node, messageId: 'deepImport', data: { target } });
          }
          return;
        }
        if (target.startsWith('src/server/db')) {
          context.report({
            node,
            messageId: 'layerForbidden',
            data: {
              from,
              to: 'server/db',
              reason:
                'features receive repositories through the unit of work, never by importing the adapter',
            },
          });
          return;
        }
        if (to === 'domain' && targetInfo.module !== location.module) {
          const leaf = target.split('/').pop() ?? '';
          if (!['types', 'ports', 'services'].includes(leaf)) {
            context.report({ node, messageId: 'deepImport', data: { target } });
          }
        }
        return;
      }

      if (from === 'domain' && to === 'domain' && targetInfo.module !== location.module) {
        const allowed = DOMAIN_TYPE_EDGES[location.module] ?? [];
        const isTypeOnly =
          node.importKind === 'type' || (node.specifiers ?? []).every((s) => s.importKind === 'type');
        if (!isTypeOnly) {
          context.report({ node, messageId: 'domainRuntimeCrossModule' });
          return;
        }
        if (!allowed.includes(targetInfo.module) || !target.endsWith('/types')) {
          context.report({
            node,
            messageId: 'domainTypeEdgeNotAllowed',
            data: { from: location.module, to: targetInfo.module, allowed: allowed.join(', ') || '(none)' },
          });
        }
      }
    }

    return {
      ImportDeclaration(node) {
        checkImport(node, node.source?.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkImport(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        checkImport(node, node.source?.value);
      },
      ImportExpression(node) {
        if (node.source?.type === 'Literal' && typeof node.source.value === 'string') {
          checkImport(node, node.source.value);
        }
      },
      // Deterministic time: the clock is injected, never read (I-XA-005).
      NewExpression(node) {
        if (!location) return;
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Date') return;
        if (location.layer !== 'domain' && location.layer !== 'features') return;
        // `new Date(value)` (parsing an injected instant) is fine; `new Date()` reads the wall clock.
        if (node.arguments.length === 0) context.report({ node, messageId: 'newDateInDomain' });
      },
      TSAnyKeyword(node) {
        context.report({ node, messageId: 'explicitAny' });
      },
    };
  },
};

/* The normative tables are exported so tests/unit/architecture.test.ts asserts against the same
 * data the lint rule enforces — one source of truth, two independent scanners (AST vs file walk). */
export const BOUNDARY_TABLES = {
  LAYERS,
  DB_PACKAGES: [...DB_PACKAGES],
  FRAMEWORK_PACKAGES: [...FRAMEWORK_PACKAGES],
  FEATURE_COMPOSITION_ROOTS: [...FEATURE_COMPOSITION_ROOTS],
  DOMAIN_TYPE_EDGES,
};

export const boundaries = {
  rules: {
    boundaries: rule,
  },
};

export default boundaries;
