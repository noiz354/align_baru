/**
 * Generic transition-table types - machines are DATA, not if-statements.
 *
 * Where this belongs: shared/contracts, because every machine file in `src/domain/<entity>/` is a value
 * of these types and the tests iterate over them (exhaustive transition coverage, TESTING.md §4.1).
 * Specification: STATE_MACHINE.md §11.
 *
 * Invariants:
 *   1. Every machine enumerates its states and its transitions; `test.todo` coverage walks all pairs.
 *   2. Guards are referenced by id (data); guard *implementations* are `Not implemented: <task>` until
 *      their task lands, so a transition cannot silently become permissive.
 *   3. Side effects are referenced by id and are emitted as domain events (EVENTS.md), never performed
 *      implicitly inside the table.
 */
export interface Transition<TState extends string, TTrigger extends string> {
  readonly from: TState | readonly TState[];
  readonly to: TState;
  readonly trigger: TTrigger;
  readonly guardId: string;
  readonly sideEffectIds: readonly string[];
  /** Machine-specific note for reviewers; part of the specification, not decoration. */
  readonly note?: string;
}

export interface TransitionTable<TState extends string, TTrigger extends string> {
  readonly machine: string;
  readonly states: readonly TState[];
  /** States from which no transition is possible (`⌛` in STATE_MACHINE.md). */
  readonly terminalStates: readonly TState[];
  readonly transitions: readonly Transition<TState, TTrigger>[];
}

/** Guard and side-effect implementations are ported in by their owning task. */
export type GuardFn<TContext> = (context: TContext) => { readonly allowed: true } | { readonly allowed: false; readonly reason: string };
