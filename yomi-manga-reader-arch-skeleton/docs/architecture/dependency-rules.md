# Dependency Rules

Machine-enforceable rules (ESLint, T-FOUND-011) + their rationale. Violation = CI failure, not style.

## 1. The Rules (normative)

| # | Rule | Enforced by |
|---|---|---|
| D1 | `features/*` must not import from `server/*` | ESLint no-restricted-imports |
| D2 | Only `server/db/**` may import `drizzle-orm`, `drizzle-zod` (if used), the PG driver | ESLint no-restricted-imports |
| D3 | Only `server/storage/**` may import `@aws-sdk/*` | ESLint no-restricted-imports |
| D4 | Only `server/telemetry/**` may import `@opentelemetry/sdk-*`, `@opentelemetry/exporter-*`; all other code may import `@opentelemetry/api` and the shared logger facade only | ESLint no-restricted-imports |
| D5 | `shared/*` must not import from `features/*`, `server/*`, or `app/**` (leaf layer) | ESLint |
| D6 | `app/**` must not import `drizzle-orm` or S3 SDKs directly; infra is reached via composition exports | ESLint |
| D7 | RSC/client boundary: `"use client"` files must not import server-only modules (composition, repositories); server components must not import client-state modules (reader store) | Next.js `server-only`/`client-only` packages + lint |
| D8 | `shared/ui` must not import from `features/*` (ui is leaf-ish; features may use ui) | ESLint |
| D9 | No feature may import another feature's **implementation internals** — only its public surface (re-exports from the feature's index + shared contracts) | ESLint (feature subpaths) |
| D10 | Tests may import anything (they are the outside world) — but integration tests must use the same public entrypoints (composition) as the app | convention + review |

## 2. The Feature Dependency Graph (allowed edges)

```
                 shared/*  (leaf — everyone may depend on it)
                    ▲
  ┌─────────────────┼─────────────────────────────┐
  │                 │                             │
features/auth       │            features/manga   │
  │  ▲              │              ▲    ▲         │
  │  │              │              │    │         │
  │  │ features/catalog ──────────┘    │         │
  │  │   (uses auth guards? NO — guards │         │
  │  │    live in web/route layer)     │         │
  │  │              │              │    │         │
  │  │  features/chapters ─────────┘    │         │
  │  │       │                          │         │
  │  │       ▼                          │         │
  │  │  features/reader ────────────────┤         │
  │  │       │  (reader → chapters, progress)     │
  │  │       ▼                                 │
  │  └──► features/progress ◄──────────────────┘
  │           ▲
  │           │
  └──► features/library (library → progress, manga)
        features/search (search → manga vocab via port only)
        features/admin (admin → manga, chapters, uploads, auth guards)
        features/uploads (uploads → chapters, manga, media/storage ports)
```

Allowed feature→feature edges (complete list — anything else is a D9 violation):

| From | May depend on |
|---|---|
| catalog | manga, chapters, progress (read side) |
| chapters | manga |
| reader | chapters, progress (read+write ports) |
| progress | (none — defines its own ports; used by others) |
| library | progress (read), manga |
| search | (none — SearchRepository port abstracts vocab) |
| admin | manga, chapters, uploads, auth (guards only) |
| uploads | chapters, manga (+ ports: storage, media, audit) |
| auth | (none) |
| manga | (none) |

**No cycles exist in this graph** (it's a DAG; verify in review when adding a feature). Note the deliberate absence: `catalog` does **not** depend on `auth` — the route layer (web) applies guards; the service receives an optional caller context (typed in shared) so catalog logic stays pure.

## 3. Web Layer Edges

| From | May depend on |
|---|---|
| route handlers (app/api) | composition (services), shared (validation, contracts, errors), features (public services) |
| RSC pages | composition (services), shared/ui, features (public read services) |
| client components (reader, forms) | shared/ui, shared/contracts (types), features (pure client-safe modules: reader state, window, index — these are client-safe by construction; server-only services are marked and excluded by D7) |
| middleware | features/auth (presence-check only) |

## 4. Infra Layer Edges

| From | May depend on |
|---|---|
| server/db | shared/contracts, feature port definitions (to implement them), drizzle+driver (D2) |
| server/storage | shared/contracts, S3 SDK (D3) |
| server/media | shared/contracts, sharp (planned), (uses storage port — not the SDK) |
| server/auth | shared/contracts, PG via server/db's connection helper (same process; import from server/db allowed infra→infra) |
| server/telemetry | shared/contracts, OTel API+SDK (D4), pino |
| server/composition | all of server/* + shared |

Infra→infra is allowed (server/auth uses server/db's pool). Features never see infra. Web never imports infra directly (D6).

## 5. Data Flow at Boundaries (types only)

- Feature → port: domain input types (from shared/contracts) only.
- Port impl → feature: domain output types (DTOs from shared/contracts). Repository impls map DB rows → DTOs at the boundary (server/db owns the mapping; drizzle row types never leak).
- Web → feature: validated, typed inputs (Zod output).
- Feature → web: DTOs + typed `AppError`.

## 6. Enforcement Details (T-FOUND-011)

- ESLint config: `no-restricted-imports` patterns per rule (glob-based), plus `server-only`/`client-only` imports in the sensitive modules.
- Self-test: a deliberately wrong import in a CI fixture fails the build (proves the rules are live).
- Review: PRs adding new dependencies between modules must update this file (it is the map; an unlisted edge is a spec bug).
