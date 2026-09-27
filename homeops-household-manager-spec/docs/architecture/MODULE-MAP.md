# HomeOps - Module Map (normative)

**Status:** accepted (2026-09-26) · **Owner:** architecture · **Enforced by:** `T-PLAT-006` (ESLint boundaries), `T-PLAT-008` (docs gate), `tests/unit/architecture.test.ts`
**Related:** `ARCHITECTURE.md` §4-§9, `DOMAIN.md`, `docs/domain/AGGREGATES.md`, `docs/domain/INVARIANTS.md`, `CONTRIBUTING.md` §4

This file is the single list of what exists, what it may import, and what it must never import. If a PR needs a new edge, it changes this file first and the lint config second - never the reverse.

## 1. Layers

| Layer | Path | May import | Must never import |
|---|---|---|---|
| Apps / routes | `src/app/**` | `src/features/*` (read models + actions), `src/shared/*` | `src/domain/*`, `src/server/*`, `drizzle-orm`, the DB driver |
| Features (use cases) | `src/features/*` | `src/domain/*`, `src/shared/*`, `src/server/*` (ports/db/auth only via server modules) | other `src/features/*` |
| Domain (model) | `src/domain/*` | `src/shared/*` only | `next`, `react`, `drizzle-orm`, `src/server/*`, `src/features/*` |
| Server (adapters) | `src/server/*` | `src/domain/*` (implements its ports), `src/shared/*` | `src/features/*`, `src/app/*` |
| Shared (leaf) | `src/shared/*` | nothing from the layers above | all of the above |

`src/domain/*` is deterministic and side-effect free. Every function in it takes an injected `Clock` and plain data; that is what makes recurrence, thresholds, and status derivation unit-testable without a database.

## 2. Domain modules

| Module | Path | Owns (aggregate) | Public API (services) | Depends on | Tasks |
|---|---|---|---|---|---|
| Household | `src/domain/household` | Household, settings | `createHousehold`, `updateHouseholdSettings`, `getHousehold` | - | T-HH-001..019 |
| Members | `src/domain/members` | Membership, Invitation | `inviteMember`, `acceptInvitation`, `changeMemberRole`, `removeMember`, `markAway` | household | T-MEM-001..011 |
| Rooms | `src/domain/rooms` | Room, status derivation | `deriveRoomStatus`, `applyRoomStatusOverride`, `findExpiredOverrides`, `archiveRoom`, `listRoomStatuses` | chores (read-only: overdue/due evidence) | T-ROOM-001..012 |
| Chores | `src/domain/chores` | ChoreDefinition, ChoreOccurrence | `calculateNextOccurrence`, `calculateNextAfterCompletion`, `validateRecurrenceRule`, `describeRecurrence`, `materialiseNextOccurrence`, `completeOccurrence`, `skipOccurrence`, `snoozeOccurrence`, `reassignOccurrence` | - | T-CHORE-001..026 |
| Trash | `src/domain/trash` | TrashContainer, state events | `applyTrashTransition`, `resetAfterCollection`, `scheduleCollectionReminder` | - | T-TRASH-001..012 |
| Resources | `src/domain/resources` | Resource, thresholds, shopping items | `classifyLevel`, `computeThresholds`, `detectCrossings`, `restockToTarget`, `addToShoppingList` | - | T-RES-001..020 |
| Shopping | *inside* `src/domain/resources` | ShoppingItem | `addToShoppingList`, `completeShoppingItem` | resources | T-SHOP-001..006 |
| Maintenance | `src/domain/maintenance` | Asset, MaintenancePlan, ServiceRecord | `calculateNextServiceAt`, `describeFrequency`, `recordService`, `pausePlan` | issues (link only) | T-MNT-001..016 |
| Issues | `src/domain/issues` | Issue, Comment, Attachment | `createIssue`, `transitionIssue`, `addComment`, `attachPhoto`, `linkMaintenance` | - | T-ISSUE-001..012 |
| Alerts | `src/domain/alerts` | Alert | `buildDedupeKey`, `mapPriority`, `buildAlertContent`, `resolveRecipients`, `detectConditions`, `evaluateAlerts` | all condition sources (see below) | T-ALERT-001..035 |
| Activity | `src/domain/activity` | ActivityEvent | `recordActivity`, `listActivity` | - | T-ACT-001..006 |

Shopping is deliberately **not** its own module: a shopping item is a supply in a different state, and splitting it would create a resources↔shopping cycle for no benefit (DECISIONS.md 2026-09-25, "shopping stays inside resources").

## 3. Dependency direction

```
                      dashboard (feature, read-only)
                                |
        +-----------+-----------+-----------+------------+
        |           |           |           |            |
      rooms       chores      trash      resources   maintenance
        |           |           |           |            |
        +-----------+-----+-----+-----------+------------+
                          |
                       alerts  (pure detector; consumes condition
                          |     snapshots handed to it as plain data)
                          |
                       activity  (append-only sink)
```

Rules:

1. **Downward only.** A module may call a module below it; a lower module never calls upward. `alerts` may read the *state* of rooms/chores/trash/resources/maintenance/issues, but only through plain value objects passed in by the caller (`evaluateAlerts(input)`), never by importing their repositories. This is what keeps the detector pure and testable.
2. **No cycles, no exceptions.** `rooms -> chores` exists; `chores -> rooms` does not (a chore carries a `roomId` value, it never queries rooms). The cycle check in `tests/unit/architecture.test.ts` walks every relative import; a cycle fails CI.
3. **Features are leaves of the feature layer.** Two features never import each other; shared logic between features moves down into `domain` (pure) or `server` (adapter). **One declared exception:** `features/dashboard` is the composition root for the `/today` read model (ARCHITECTURE.md §8) and may import other features' *read models (`queries.ts`) and DTO types (`dto.ts`)* — never their actions, components, or internals. Nothing may import `features/dashboard`: it is a sink.
4. **`src/shared` never depends on a layer above it.** It is types, clocks, errors, validation primitives, and three cross-cutting UI primitives.
5. **Type-only imports are the one permitted cross-module reference.** A domain module may `import type` another module's `types.ts` (never its `ports.ts` or `services.ts`), because sharing a value shape is cheaper and less error-prone than duplicating it. The only current example is `src/domain/alerts/recipients.ts` importing the `Recipient` shape from `src/domain/members/types.ts`. Runtime imports between domain modules are zero today, and an architecture test asserts that (a `import {` line crossing modules fails CI).
6. **Only `src/server/db` touches the database.** Repositories implement ports declared in `src/domain/*/ports.ts`. Port methods are household-scoped by construction: `householdId` first, or an aggregate root that declares `householdId`, with the single discovery call `findMembershipHousehold(memberId)` as the documented exception (I-XA-001/I-XA-001a) - so an unscoped query cannot be written by accident.

## 4. Forbidden edges (with reasons)

| Forbidden | Why | Enforced by |
|---|---|---|
| `domain/**` importing `react` / `next` | Domain logic must run in tests and jobs, not just in a request | ESLint `no-restricted-imports`, architecture test |
| `domain/**` importing `drizzle-orm` or `postgres` | The model must not know the persistence shape; that is the anti-corruption boundary | ESLint, `T-PLAT-005` |
| Any file outside `src/server/db` importing the DB driver | Single place to audit tenancy, transactions, and query budget | ESLint |
| `features/a/**` importing `features/b/**` | Prevents an accidental god-feature; forces explicit interfaces | ESLint, architecture test |
| anything importing `features/dashboard/**` | The dashboard is a sink: the composition root has no consumers | ESLint, architecture test |
| `app/**` importing `domain/**` or `server/**` | Routes coordinate and render; logic belongs in a feature action/query | ESLint |
| Deep import into another module's internals (`@/domain/chores/recurrence`) from a feature | Keeps each module's public surface intentional | ESLint path rule; public surface is `services.ts` / `ports.ts` / `types.ts` |
| `src/shared/ui` growing past cross-cutting primitives | A shared component with one caller belongs in that feature | Review + `T-PLAT-015` grep gate for hard-coded colours |
| Client component importing a `server` module | Bundling risk and tenancy bypass | ESLint `no-restricted-imports` + `'use client'` analysis |

## 5. Non-domain concerns and where they live

| Concern | Lives in | Why not a domain module |
|---|---|---|
| Notification policy (who, what, when, cap, quiet hours) | `src/features/notifications/policy.ts` | It is pure, but it is *application* policy over alert state rather than household truth; keeping it out of `domain/alerts` keeps the detector free of channel concerns (DECISIONS.md) |
| Delivery adapters (Web Push, email, in-app) | `src/server/notifications/*` | External I/O belongs to adapters |
| Attachments (storage, validation, serving) | `src/server/attachments/storage.ts` | Infrastructure; the domain only holds a reference value |
| Tenancy context and authorization | `src/server/auth/*` | Minted once per request; the domain receives a `HouseholdContext` value |
| Scheduler, locks, jobs | `src/server/scheduler/*` | Operational shell around pure domain services |
| Telemetry (logs, metrics, traces) | `src/server/telemetry/*` | Cross-cutting, and constrained by a typed allow-list |

## 6. Verification

- `T-PLAT-006` - ESLint `no-restricted-imports` per layer + the path rules above.
- `tests/unit/architecture.test.ts` - cycle check (runtime edges), layer violations, and schema↔migration agreement (the Drizzle `pgTable` set must equal the `CREATE TABLE` set; the migration SQL stays authoritative, ARCHITECTURE.md §9).
- `T-PLAT-008` - fails CI when a doc references a module path that does not exist.
- `T-SEC-002` isolation sweep - one negative test per repository port; the map stays honest because an unscoped port cannot pass it.

## 7. Adding a module

1. Justify it in `DOMAIN.md` §2 and this file (a new aggregate, not a new folder).
2. Add the boundary rationale to the forbidden-edge table if it changes any edge.
3. Create `types.ts`, `ports.ts`, `services.ts`; every unimplemented body throws `Not implemented: T-XXX-NNN`.
4. Add the module to `docs/domain/INVARIANTS.md` with enforcement points and to `docs/TRACEABILITY.md` via `scripts/build-traceability.mjs`.
5. Only then write code.
