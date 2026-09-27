/**
 * classNames — the one way a class list is assembled in this product.
 *
 * Requirements: NFR-A11Y-004 (a class is a behaviour contract, not a string).
 * Tasks: T-FOUND-004 (primitives), T-CATALOG-003/004/005/006/008 (the surfaces
 * that consume it).
 *
 * ── Why it exists ──────────────────────────────────────────────────────────
 * Three problems it removes, all of which the primitives hit:
 *   1. `noUncheckedIndexedAccess` makes `styles.card` — a CSS Modules index
 *      signature — type as `string | undefined`, and `exactOptionalPropertyTypes`
 *      then refuses to hand that to an optional `className`. The value is never
 *      actually missing at runtime; the type is being careful. This helper takes
 *      the possibly-undefined values and returns a definite string.
 *   2. Conditional classes (`cls && 'x'`, ternaries in an array) have four
 *      different shapes in this codebase already. One shape is one less thing to
 *      misread in review.
 *   3. Falsy values are dropped rather than stringified, so a class list never
 *      ships the literal "false" or "undefined" to the DOM.
 *
 * It is deliberately NOT a `clsx` clone: no nested arrays, no object syntax, no
 * dependency. A 10-line function that everyone can read beats a 200-line one
 * nobody has to.
 *
 * Usage:
 *   className={classNames('card', pending && 'card--pending')}
 *   className={classNames(styles.stack, wide ? styles.wide : undefined)}
 */
export type ClassNameInput = string | false | null | undefined;

/** Joins the truthy class names with a single space. */
export function classNames(...names: readonly ClassNameInput[]): string {
  let out = '';
  for (const name of names) {
    if (name === undefined || name === null || name === false || name === '') continue;
    out = out === '' ? name : `${out} ${name}`;
  }
  return out;
}

export default classNames;
